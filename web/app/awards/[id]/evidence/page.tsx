import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { PageHeading } from "@/components/PageHeading";
import { EvidenceUploadForm } from "@/components/EvidenceUploadForm";
import { requireSessionUser } from "@/lib/session";
import { sql } from "@/lib/db";

export default async function EvidencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;
  const db = sql();
  let recipientOk = false;
  let expectedRevision = 0;
  try {
    const rows = (await db`
      select rm.user_id, a.evidence_revision
      from award a
      join program_member rm on rm.id = a.recipient_member_id
      where a.id = ${id}
      limit 1
    `) as unknown as { user_id: string; evidence_revision: number }[];
    if (!rows[0]) notFound();
    recipientOk = rows[0].user_id === user.id;
    expectedRevision = Number(rows[0].evidence_revision);
  } catch {
    return (
      <AppShell username={user.username}>
        <Notice>Database unavailable.</Notice>
      </AppShell>
    );
  }
  if (!recipientOk) notFound();

  return (
    <AppShell username={user.username}>
      <p className="lead">
        <Link href={`/awards/${id}`}>← Award</Link>
      </p>
      <PageHeading
        title="Add a new evidence revision"
        lead="One to three PDF, JPEG or PNG files, up to 5 MiB each. Files stay private."
      />
      <EvidenceUploadForm awardId={id} expectedRevision={expectedRevision} />
    </AppShell>
  );
}
