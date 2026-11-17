import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { PageHeading } from "@/components/PageHeading";
import { ReviewForm } from "@/components/ReviewForm";
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
  let allowed = false;
  try {
    const rows = (await db`
      select a.version, vm.user_id as verifier_user_id, ev.id as evidence_id
      from award a
      join program_member vm on vm.id = a.verifier_member_id
      left join lateral (
        select id from evidence_version
        where award_id = a.id
        order by revision desc
        limit 1
      ) ev on true
      where a.id = ${id}
      limit 1
    `) as unknown as {
      version: number;
      verifier_user_id: string;
      evidence_id: string | null;
    }[];
    if (!rows[0]) notFound();
    allowed = rows[0].verifier_user_id === user.id || user.is_staff;
    evidenceId = rows[0].evidence_id;
    expectedVersion = String(rows[0].version ?? 0);
  } catch {
    return (
      <AppShell username={user.username} roleLabel="VERIFIER" isStaff={user.is_staff}>
        <Notice>Database unavailable.</Notice>
      </AppShell>
    );
  }

  if (!allowed) notFound();

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
      <ReviewForm
        awardId={id}
        evidenceId={evidenceId}
        expectedVersion={expectedVersion}
      />
    </AppShell>
  );
}
