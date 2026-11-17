import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { PageHeading } from "@/components/PageHeading";
import { ReviewForm } from "@/components/ReviewForm";
import { EvidenceHistory } from "@/components/EvidenceHistory";
import { loadEvidenceHistoryForUser } from "@/lib/awards/queries";
import { requireSessionUser } from "@/lib/session";
import { sql } from "@/lib/db";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;
  const db = sql();

  let evidenceId: string | null = null;
  let expectedVersion = "0";
  let access: { allowed: boolean; exists: boolean } = { allowed: false, exists: false };
  try {
    const rows = (await db`
      select a.version, a.verifier_sync_required,
             vm.user_id as verifier_user_id, vm.role as verifier_role, vm.active as verifier_active,
             ev.id as evidence_id
      from award a
      join program_member vm on vm.id = a.verifier_member_id
      left join lateral (
        select id from evidence_version
        where purged_at is null and award_id = a.id
        order by revision desc
        limit 1
      ) ev on true
      where a.id = ${id}
      limit 1
    `) as unknown as {
      version: number;
      verifier_user_id: string;
      verifier_role: string;
      verifier_active: boolean;
      verifier_sync_required: boolean;
      evidence_id: string | null;
    }[];
    const row = rows[0];
    if (row) {
      access = {
        exists: true,
        allowed: row.verifier_user_id === user.id &&
          row.verifier_role === "VERIFIER" && row.verifier_active &&
          !row.verifier_sync_required,
      };
      if (access.allowed) {
        evidenceId = row.evidence_id;
        expectedVersion = String(row.version ?? 0);
      }
    }
  } catch {
    return (
      <AppShell username={user.username} roleLabel="VERIFIER" isStaff={user.is_staff}>
        <Notice>Database unavailable.</Notice>
      </AppShell>
    );
  }

  if (!access.exists || !access.allowed) notFound();
  const evidenceHistory = await loadEvidenceHistoryForUser(id, user);

  return (
    <AppShell username={user.username} roleLabel="VERIFIER" isStaff={user.is_staff}>
      <p className="lead">
        <Link href={`/awards/${id}`}>← Award</Link>
      </p>
      <PageHeading
        title="Review revision"
        lead="Confirm the original source before you prepare an on-chain decision."
      />
      {!evidenceId ? (
        <Notice>No evidence revision is available to review yet.</Notice>
      ) : null}
      <section className="award-section">
        <h2>Evidence history</h2>
        <EvidenceHistory versions={evidenceHistory} />
      </section>
      <ReviewForm
        awardId={id}
        evidenceId={evidenceId}
        expectedVersion={expectedVersion}
      />
    </AppShell>
  );
}
