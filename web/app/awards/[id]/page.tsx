import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { PageHeading } from "@/components/PageHeading";
import { Tracker } from "@/components/Tracker";
import { sql } from "@/lib/db";
import { isAwardVisible } from "@/lib/permissions";
import {
  nextStep,
  statusLines,
  trackerSteps,
} from "@/lib/presentation";
import { requireSessionUser } from "@/lib/session";
import type { AwardView, MemberView, Role } from "@/lib/types";
import { WalletPanel } from "@/components/WalletPanel";

async function loadAward(id: string): Promise<(AwardView & { verifier_sync_required: boolean; program_title: string; version: number; latest_evidence_id: string | null }) | null> {
  const db = sql();
  const rows = (await db`
    select
      a.id, a.status, a.version, a.last_confirmed_ledger, a.sponsor_hold, a.verifier_hold,
      a.evidence_revision, a.evidence_digest, a.verifier_sync_required,
      p.title as program_title,
      sm.user_id as sponsor_user_id, sm.role as sponsor_role, sm.active as sponsor_active, sm.public_wallet as sponsor_wallet,
      vm.user_id as verifier_user_id, vm.role as verifier_role, vm.active as verifier_active, vm.public_wallet as verifier_wallet,
      rm.user_id as recipient_user_id, rm.role as recipient_role, rm.active as recipient_active, rm.public_wallet as recipient_wallet,
      ev.id as latest_evidence_id, ev.revision as latest_revision, ev.digest as latest_digest,
      exists(
        select 1 from chain_operation co
        where co.award_id = a.id
          and co.status in ('BUILDING','PREPARED','SIGNED','SUBMITTED','UNKNOWN')
      ) as unresolved
    from award a
    join program p on p.id = a.program_id
    join program_member sm on sm.id = a.sponsor_member_id
    join program_member vm on vm.id = a.verifier_member_id
    join program_member rm on rm.id = a.recipient_member_id
    left join lateral (
      select id, revision, digest from evidence_version
      where award_id = a.id order by revision desc limit 1
    ) ev on true
    where a.id = ${id}
    limit 1
  `) as unknown as Record<string, unknown>[];
  const row = rows[0];
  if (!row) return null;
  const member = (
    userId: string,
    role: Role,
    active: boolean,
    wallet: string,
  ): MemberView => ({
    user_id: userId,
    role,
    active,
    public_wallet: wallet,
  });
  return {
    id: String(row.id),
    status: row.status as AwardView["status"],
    version: Number(row.version ?? 0),
    last_confirmed_ledger: (row.last_confirmed_ledger as number | null) ?? null,
    sponsor_hold: Boolean(row.sponsor_hold),
    verifier_hold: Boolean(row.verifier_hold),
    evidence_revision: Number(row.evidence_revision),
    evidence_digest: String(row.evidence_digest),
    verifier_sync_required: Boolean(row.verifier_sync_required),
    program_title: String(row.program_title),
    latest_evidence_id: row.latest_evidence_id ? String(row.latest_evidence_id) : null,
    sponsor_member: member(
      String(row.sponsor_user_id),
      "SPONSOR",
      Boolean(row.sponsor_active),
      String(row.sponsor_wallet),
    ),
    verifier_member: member(
      String(row.verifier_user_id),
      "VERIFIER",
      Boolean(row.verifier_active),
      String(row.verifier_wallet),
    ),
    recipient_member: member(
      String(row.recipient_user_id),
      "RECIPIENT",
      Boolean(row.recipient_active),
      String(row.recipient_wallet),
    ),
    latest_evidence:
      row.latest_revision == null || row.latest_digest == null
        ? null
        : {
            revision: Number(row.latest_revision),
            digest: String(row.latest_digest),
          },
    unresolved_operation: Boolean(row.unresolved),
  };
}

export default async function AwardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;
  let award: Awaited<ReturnType<typeof loadAward>> = null;
  try {
    award = await loadAward(id);
  } catch {
    return (
      <AppShell username={user.username}>
        <Notice>Database is not reachable. Start Supabase and seed demo data.</Notice>
      </AppShell>
    );
  }
  if (!award || !isAwardVisible(award, user)) notFound();

  const lines = statusLines(award);
  const step = nextStep(award, user);
  const steps = trackerSteps(award);
  const isRecipient = award.recipient_member.user_id === user.id;
  const isVerifier = award.verifier_member.user_id === user.id;
  const isSponsor = award.sponsor_member.user_id === user.id;

  return (
    <AppShell username={user.username}>
      <p className="lead">
        <Link href="/programs">← Programs</Link>
      </p>
      <PageHeading
        title={`${award.program_title}`}
        lead={`Award ${award.id.slice(0, 8)} · 20 Testnet XLM · no real monetary value`}
      />
      <Notice>
        <strong>{lines[0]}</strong>
        <div style={{ marginTop: "0.5rem" }}>{step}</div>
      </Notice>

      {isRecipient ? (
        <section style={{ margin: "1.5rem 0" }}>
          <h2 style={{ fontSize: "1.05rem" }}>Add a new evidence revision</h2>
          <p className="lead">
            Upload one to three PDF/JPEG/PNG files (max 5 MiB each), then sign
            submission from Wallet actions.
          </p>
          <Link className="button" href={`/awards/${award.id}/evidence`}>
            Open evidence upload
          </Link>
        </section>
      ) : null}

      {isVerifier ? (
        <section style={{ margin: "1.5rem 0" }}>
          <h2 style={{ fontSize: "1.05rem" }}>Review revision</h2>
          <p className="lead">
            Check the original source before requesting approval or changes.
          </p>
          <Link className="button" href={`/awards/${award.id}/review`}>
            Open review
          </Link>
        </section>
      ) : null}

      <section style={{ margin: "1.5rem 0" }}>
        <h2 style={{ fontSize: "1.05rem" }}>Progress</h2>
        <Tracker steps={steps} />
      </section>

      <section style={{ margin: "1.5rem 0" }}>
        <h2 style={{ fontSize: "1.05rem" }}>Wallet actions</h2>
        <WalletPanel
          awardId={award.id}
          isSponsor={isSponsor}
          isRecipient={isRecipient}
          isVerifier={isVerifier}
          hasLedger={Boolean(award.last_confirmed_ledger)}
          expectedVersion={String(award.version)}
          evidenceId={award.latest_evidence_id}
          assignedWallet={
            isSponsor
              ? award.sponsor_member.public_wallet
              : isVerifier
                ? award.verifier_member.public_wallet
                : isRecipient
                  ? award.recipient_member.public_wallet
                  : null
          }
        />
      </section>

      <p>
        <Link className="button quiet" href={`/awards/${award.id}/audit`}>
          View audit
        </Link>
      </p>
    </AppShell>
  );
}
