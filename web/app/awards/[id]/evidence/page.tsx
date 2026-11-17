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
  let verifierSyncRequired = false;
  try {
    const rows = (await db`
      select rm.user_id, a.evidence_revision, a.verifier_sync_required
      from award a
      join program_member rm on rm.id = a.recipient_member_id
      where a.id = ${id}
      limit 1
    `) as unknown as { user_id: string; evidence_revision: number; verifier_sync_required: boolean }[];
    if (!rows[0]) notFound();
    recipientOk = rows[0].user_id === user.id;
    expectedRevision = Number(rows[0].evidence_revision);
    verifierSyncRequired = rows[0].verifier_sync_required;
  } catch {
    return (
      <AppShell username={user.username} roleLabel="RECIPIENT" isStaff={user.is_staff}>
        <Notice>Database unavailable.</Notice>
      </AppShell>
    );
  }
  if (!recipientOk) notFound();

  return (
    <AppShell
      username={user.username}
      roleLabel="RECIPIENT"
      isStaff={user.is_staff}
    >
      <p className="lead">
        <Link href={`/awards/${id}`}>← Award</Link>
      </p>
      <PageHeading
        title={verifierSyncRequired ? "Submit current revision first" : "Add a new evidence revision"}
        lead={verifierSyncRequired
          ? "Wait for the current evidence commitment to synchronize before adding another revision."
          : "One to three PDF, JPEG or PNG files, up to 5 MiB each. Files stay private."}
      />
      {verifierSyncRequired ? (
        <Notice>
          {expectedRevision > 0
            ? "Submit the current evidence revision from Wallet actions before uploading another revision."
            : "This award is still synchronizing. Return to the award page and refresh before uploading evidence."}
        </Notice>
      ) : (
        <>
          <EvidenceUploadForm awardId={id} expectedRevision={expectedRevision} />
          <Notice>
            After upload finishes, return to the award and use{" "}
            <strong>Prepare submission</strong> with the Freighter account that
            matches your assigned recipient wallet.
          </Notice>
        </>
      )}
      <p className="lead" style={{ marginTop: "1rem" }}>
        <Link className="button" href={`/awards/${id}`}>
          {verifierSyncRequired ? "Back to award · submit current revision" : "Back to award · prepare submission"}
        </Link>
      </p>
    </AppShell>
  );
}
