import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { PageHeading } from "@/components/PageHeading";
import { loadProgramForUser } from "@/lib/awards/program";
import { listVisibleAwardsForUser } from "@/lib/awards/queries";
import { requireSessionUser } from "@/lib/session";

const singaporeDateTime = new Intl.DateTimeFormat("en-SG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Singapore",
});

function formatDeadline(value: string): string {
  return singaporeDateTime.format(new Date(value)) + " SGT";
}

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) notFound();

  let program: Awaited<ReturnType<typeof loadProgramForUser>> = null;
  let awards: Awaited<ReturnType<typeof listVisibleAwardsForUser>> = [];
  try {
    program = await loadProgramForUser(id, user.id);
    if (!program) notFound();
    awards = await listVisibleAwardsForUser(user, id);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return (
      <AppShell username={user.username} isStaff={user.is_staff}>
        <Notice>Project information is temporarily unavailable.</Notice>
      </AppShell>
    );
  }
  if (!program) notFound();

  return (
    <AppShell username={user.username} roleLabel={program.role} isStaff={user.is_staff}>
      <p className="lead"><Link href="/programs">← Projects</Link></p>
      <PageHeading title={program.title} lead={`${program.role} project workspace`} />
      <section className="award-section">
        <h2>Project terms</h2>
        <p>{program.requirements_text}</p>
        <dl>
          <dt>Submission deadline</dt><dd>{formatDeadline(program.claim_deadline)}</dd>
          <dt>Review deadline</dt><dd>{formatDeadline(program.review_deadline)}</dd>
          <dt>Payout deadline</dt><dd>{formatDeadline(program.payout_deadline)}</dd>
        </dl>
        <p className="lead">Deadlines are stored in UTC and shown here in Singapore time (SGT).</p>
      </section>

      {program.role === "SPONSOR" ? (
        <p><Link className="button" href={`/programs/${program.id}/create-award`}>Create award</Link></p>
      ) : null}
      {program.role === "SPONSOR" || program.role === "VERIFIER" ? (
        <p><Link className="button quiet" href={`/programs/${program.id}/export?format=json`}>Export authorized awards</Link></p>
      ) : null}

      <section className="award-section">
        <h2>Your awards ({awards.length})</h2>
        {awards.length === 0 ? (
          <p className="lead">No awards are assigned to your active project role yet.</p>
        ) : (
          <ul>
            {awards.map((award) => (
              <li key={award.id}>
                <Link href={`/awards/${award.id}`}>Award {award.id.slice(0, 8)}</Link>
                {" · "}{award.status.replaceAll("_", " ")}
                {award.unresolved_operation ? " · action awaiting confirmation" : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
