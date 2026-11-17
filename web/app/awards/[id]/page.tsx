import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EvidenceHistory } from "@/components/EvidenceHistory";
import { Notice } from "@/components/Notice";
import { PageHeading } from "@/components/PageHeading";
import { SmokeContext } from "@/components/SmokeContext";
import { StatusPill } from "@/components/StatusPill";
import { Tracker } from "@/components/Tracker";
import { WalletPanel } from "@/components/WalletPanel";
import { loadReplacementVerifierOptions } from "@/lib/awards/program";
import { loadEvidenceHistoryForUser } from "@/lib/awards/queries";
import { sql } from "@/lib/db";
import { isAwardVisible } from "@/lib/permissions";
import {
  nextStep,
  safeProgramReturnHref,
  statusLines,
  trackerSteps,
  userActsNow,
} from "@/lib/presentation";
import { requireSessionUser } from "@/lib/session";
import type { AwardView, MemberView, Role } from "@/lib/types";

const singaporeDateTime = new Intl.DateTimeFormat("en-SG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Singapore",
});

type RecentOperation = {
  action: string;
  status: string;
  created_at: Date | string;
  confirmed_ledger: number | null;
  error_code: string;
  actor_role: string | null;
};

async function loadAward(id: string): Promise<(AwardView & {
  program_title: string;
  recipient_username: string;
  requirements_text: string;
  claim_deadline: string;
  review_deadline: string;
  payout_deadline: string;
  version: number;
  latest_evidence_id: string | null;
  verifier_member_id: string;
}) | null> {
  const db = sql();
  const rows = (await db`
    select
      a.id, a.program_id, a.status, a.version, a.last_confirmed_ledger, a.sponsor_hold, a.verifier_hold,
      a.evidence_revision, a.evidence_digest, a.verifier_sync_required,
      p.title as program_title, p.requirements_text, p.claim_deadline, p.review_deadline, p.payout_deadline,
      sm.user_id as sponsor_user_id, sm.role as sponsor_role, sm.active as sponsor_active, sm.public_wallet as sponsor_wallet,
      vm.id as verifier_member_id, vm.user_id as verifier_user_id, vm.role as verifier_role, vm.active as verifier_active, vm.public_wallet as verifier_wallet,
      rm.user_id as recipient_user_id, rm.role as recipient_role, rm.active as recipient_active, rm.public_wallet as recipient_wallet,
      ru.username as recipient_username,
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
    join app_user ru on ru.id = rm.user_id
    left join lateral (
      select id, revision, digest from evidence_version
      where award_id = a.id and purged_at is null order by revision desc limit 1
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
    program_id: String(row.program_id),
    status: row.status as AwardView["status"],
    version: Number(row.version ?? 0),
    last_confirmed_ledger: (row.last_confirmed_ledger as number | null) ?? null,
    sponsor_hold: Boolean(row.sponsor_hold),
    verifier_hold: Boolean(row.verifier_hold),
    evidence_revision: Number(row.evidence_revision),
    evidence_digest: String(row.evidence_digest),
    verifier_sync_required: Boolean(row.verifier_sync_required),
    program_title: String(row.program_title),
    recipient_username: String(row.recipient_username),
    requirements_text: String(row.requirements_text),
    claim_deadline: new Date(row.claim_deadline as string | Date).toISOString(),
    review_deadline: new Date(row.review_deadline as string | Date).toISOString(),
    payout_deadline: new Date(row.payout_deadline as string | Date).toISOString(),
    latest_evidence_revision: row.latest_revision == null ? null : Number(row.latest_revision),
    verifier_member_id: String(row.verifier_member_id),
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

async function loadRecentOperations(awardId: string): Promise<RecentOperation[]> {
  const db = sql();
  return (await db`
    select
      action,
      status,
      created_at,
      confirmed_ledger,
      error_code,
      intent->>'actor_role' as actor_role
    from chain_operation
    where award_id = ${awardId}
    order by created_at desc
    limit 2
  `) as unknown as RecentOperation[];
}

function formatDeadline(value: string): string {
  return singaporeDateTime.format(new Date(value)) + " SGT";
}

function formatOperationTime(value: Date | string): string {
  return singaporeDateTime.format(new Date(value)) + " SGT";
}

function actorLabel(value: string | null): string {
  if (value === "SPONSOR" || value === "VERIFIER" || value === "RECIPIENT") {
    return value[0] + value.slice(1).toLowerCase();
  }
  return "Member";
}

function evidenceProgressText(award: Awaited<ReturnType<typeof loadAward>>): string {
  if (!award || award.latest_evidence_revision == null) {
    return "No evidence revision is saved.";
  }
  if (award.verifier_sync_required) {
    return "Evidence revision " + award.latest_evidence_revision + " is waiting for synchronization.";
  }
  if (award.last_confirmed_ledger === null) {
    return "Evidence revision " + award.latest_evidence_revision + " is saved locally; chain status is not confirmed.";
  }
  if (award.latest_evidence_revision > award.evidence_revision) {
    return "Evidence revision " + award.latest_evidence_revision + " is waiting for chain submission.";
  }
  if (award.evidence_revision > 0) {
    return "Evidence revision " + award.evidence_revision + " is confirmed on-chain.";
  }
  return "Evidence is not yet confirmed on-chain.";
}

function actionDeadline(
  award: NonNullable<Awaited<ReturnType<typeof loadAward>>>,
  user: Awaited<ReturnType<typeof requireSessionUser>>,
): { label: string; value: string } | null {
  if (
    !userActsNow(award, user) ||
    award.sponsor_hold ||
    award.verifier_hold ||
    award.unresolved_operation
  ) {
    return null;
  }
  if (award.recipient_member.user_id === user.id && award.status === "FUNDED") {
    return { label: "Claim deadline", value: award.claim_deadline };
  }
  if (award.verifier_member.user_id === user.id && award.status === "SUBMITTED") {
    return { label: "Review deadline", value: award.review_deadline };
  }
  if (award.sponsor_member.user_id === user.id && award.status === "APPROVED") {
    return { label: "Payout deadline", value: award.payout_deadline };
  }
  return null;
}

export default async function AwardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;
  const query = await (searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>));
  const safeReturnHref = safeProgramReturnHref(query.from);
  const returnHref = safeReturnHref === "/programs" ? "/programs?focus=heading" : safeReturnHref;
  let award: Awaited<ReturnType<typeof loadAward>> = null;
  try {
    award = await loadAward(id);
  } catch {
    return (
      <AppShell username={user.username} isStaff={user.is_staff}>
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
  const replacementVerifierOptions = isSponsor
    ? await loadReplacementVerifierOptions(
        award.program_id,
        award.verifier_member_id,
        award.sponsor_member.user_id,
        award.recipient_member.user_id,
      )
    : [];
  const evidenceHistory = await loadEvidenceHistoryForUser(award.id, user);
  const recentOperations = await loadRecentOperations(award.id).catch(() => []);
  const hasEvidenceToSubmit =
    award.latest_evidence_revision != null &&
    (award.verifier_sync_required ||
      award.latest_evidence_revision > award.evidence_revision);
  const roleLabel = isSponsor
    ? "SPONSOR"
    : isVerifier
      ? "VERIFIER"
      : isRecipient
        ? "RECIPIENT"
        : user.is_staff
          ? "ADMIN"
          : "MEMBER";
  const assignedWallet = isSponsor
    ? award.sponsor_member.public_wallet
    : isVerifier
      ? award.verifier_member.public_wallet
      : isRecipient
        ? award.recipient_member.public_wallet
        : null;
  const currentDeadline = actionDeadline(award, user);

  return (
    <AppShell
      username={user.username}
      roleLabel={roleLabel}
      isStaff={user.is_staff}
    >
      <p className="lead award-return-link">
        <Link href={returnHref}>Back to award register</Link>
      </p>
      <PageHeading
        title={award.recipient_username}
        lead={award.program_title + " - 20 Testnet XLM - no real monetary value"}
      />
      <SmokeContext
        username={user.username}
        roleLabel={roleLabel}
        assignedWallet={assignedWallet}
        nextStepText={step}
        awardStatus={award.status}
      />

      <section className="award-section award-primary-panel" aria-labelledby="award-current-status">
        <div className="award-primary-heading">
          <div>
            <span className="eyebrow">Current award status</span>
            <h2 id="award-current-status">
              <StatusPill>{award.status}</StatusPill>
            </h2>
          </div>
          <span className="award-reference-id">Award {award.id.slice(0, 8)}</span>
        </div>
        <div className="award-current-copy">
          <strong>{lines[0]}</strong>
          <p>{step}</p>
          {lines.slice(1).map((line) => <p key={line} className="award-status-note">{line}</p>)}
          <p className="award-evidence-progress">{evidenceProgressText(award)}</p>
          {currentDeadline ? (
            <p className="award-action-deadline">
              {currentDeadline.label}: <time dateTime={currentDeadline.value}>{formatDeadline(currentDeadline.value)}</time>
            </p>
          ) : null}
        </div>

        <div className="award-progress-block">
          <h3>Progress</h3>
          <Tracker steps={steps} />
        </div>

        {isRecipient ? (
          <section className="award-role-action">
            {hasEvidenceToSubmit || award.verifier_sync_required ? (
              <>
                <h3>{hasEvidenceToSubmit ? "Submit current evidence" : "Evidence synchronization pending"}</h3>
                <p className="lead">
                  {hasEvidenceToSubmit
                    ? "Submit the current evidence revision from Wallet actions below before uploading another revision."
                    : "Wait for the award to finish synchronizing before adding new evidence. Refresh this page to check its status."}
                </p>
              </>
            ) : (
              <>
                <h3>Add a new evidence revision</h3>
                <p className="lead">
                  Upload one to three PDF/JPEG/PNG files (max 5 MiB each), then sign submission from Wallet actions.
                </p>
                <Link className="button" href={"/awards/" + award.id + "/evidence"}>
                  Open evidence upload
                </Link>
              </>
            )}
          </section>
        ) : null}

        {isVerifier ? (
          <section className="award-role-action">
            <h3>Review revision</h3>
            <p className="lead">Check the original source before requesting approval or changes.</p>
            <Link className="button" href={"/awards/" + award.id + "/review"}>
              Open review
            </Link>
          </section>
        ) : null}

        <section className="award-wallet-actions">
          <h3>Wallet actions</h3>
          <WalletPanel
            awardId={award.id}
            awardStatus={award.status}
            isSponsor={isSponsor}
            isRecipient={isRecipient}
            isVerifier={isVerifier}
            ownHold={isSponsor ? award.sponsor_hold : isVerifier ? award.verifier_hold : false}
            hasHold={award.sponsor_hold || award.verifier_hold}
            verifierSyncRequired={award.verifier_sync_required}
            claimDeadline={award.claim_deadline}
            reviewDeadline={award.review_deadline}
            payoutDeadline={award.payout_deadline}
            replacementVerifierOptions={replacementVerifierOptions}
            hasLedger={Boolean(award.last_confirmed_ledger)}
            expectedVersion={String(award.version)}
            evidenceId={hasEvidenceToSubmit ? award.latest_evidence_id : null}
            assignedWallet={assignedWallet}
          />
        </section>
      </section>

      <section className="award-section award-recent-activity" aria-labelledby="award-recent-title">
        <div className="award-section-heading">
          <div>
            <span className="eyebrow">Latest updates</span>
            <h2 id="award-recent-title">Recent activity</h2>
          </div>
          <Link className="button quiet" href={"/awards/" + award.id + "/audit"}>
            View full activity
          </Link>
        </div>
        {recentOperations.length === 0 ? (
          <p className="lead">No public operation activity has been recorded yet.</p>
        ) : (
          <ol className="award-recent-list">
            {recentOperations.map((operation, index) => (
              <li key={operation.created_at.toString() + operation.action + index}>
                <div>
                  <strong>{operation.action.toLowerCase().replace(/_/g, " ")}</strong>
                  <span> | {operation.status}</span>
                  <p>{actorLabel(operation.actor_role)} | {formatOperationTime(operation.created_at)}</p>
                </div>
                <div className="award-recent-meta">
                  {operation.confirmed_ledger ? "Ledger " + operation.confirmed_ledger : ""}
                  {operation.error_code ? " | " + operation.error_code : ""}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <details className="award-section award-reference-details">
        <summary>Program terms and deadlines</summary>
        <div className="award-reference-content">
          <p>{award.requirements_text}</p>
          <dl>
            <dt>Claim deadline</dt><dd>{formatDeadline(award.claim_deadline)}</dd>
            <dt>Review deadline</dt><dd>{formatDeadline(award.review_deadline)}</dd>
            <dt>Payout deadline</dt><dd>{formatDeadline(award.payout_deadline)}</dd>
          </dl>
          <p className="lead">All deadlines are shown in Singapore time (SGT).</p>
        </div>
      </details>

      <section className="award-section">
        <h2>Evidence history</h2>
        <EvidenceHistory versions={evidenceHistory} />
      </section>
    </AppShell>
  );
}
