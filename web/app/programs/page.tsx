import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { Notice } from "@/components/Notice";
import { PageHeading } from "@/components/PageHeading";
import { StatusPill } from "@/components/StatusPill";
import { listVisibleAwardsForUser } from "@/lib/awards/queries";
import { listProgramsForUser, programCounts } from "@/lib/awards/program";
import {
  homeCopy,
  nextStep,
  pickUpcomingAward,
  sortAwardsForHome,
  statusLines,
  userActsNow,
} from "@/lib/presentation";
import { requireSessionUser } from "@/lib/session";
import type { Role } from "@/lib/types";

export default async function ProgramsPage() {
  const user = await requireSessionUser();
  let programs: Awaited<ReturnType<typeof listProgramsForUser>> = [];
  let awards: Awaited<ReturnType<typeof listVisibleAwardsForUser>> = [];
  let dbError: string | null = null;

  try {
    programs = await listProgramsForUser(user.id);
    awards = await listVisibleAwardsForUser(user);
  } catch {
    dbError =
      "Database is not reachable yet. Start local Supabase and run the seed script.";
  }

  const primaryRole = (programs[0]?.role as Role | undefined) ?? null;
  const copy = homeCopy(primaryRole);
  const ordered = sortAwardsForHome(awards, user);
  const upcoming = pickUpcomingAward(ordered, user);
  const attentionCount = ordered.filter((a) => userActsNow(a, user)).length;
  const counts =
    programs[0] != null
      ? await programCounts(programs[0].id).catch(() => null)
      : null;

  return (
    <AppShell
      username={user.username}
      roleLabel={primaryRole ?? undefined}
      isStaff={user.is_staff}
    >
      <PageHeading title={copy.page_title} lead={programs[0]?.title} />
      {dbError ? <Notice>{dbError}</Notice> : null}

      {counts ? (
        <div className="metric-grid">
          <MetricCard label="Created" value={counts.CREATED} />
          <MetricCard label="Funded" value={counts.FUNDED} />
          <MetricCard label="Submitted" value={counts.SUBMITTED} />
          <MetricCard label="Approved" value={counts.APPROVED} />
          <MetricCard label="Paid" value={counts.PAID} featured />
          <MetricCard label="Needs you" value={attentionCount} />
        </div>
      ) : null}

      <section style={{ marginBottom: "1.75rem" }}>
        <h2 style={{ fontSize: "1.05rem" }}>{copy.upcoming_title}</h2>
        {upcoming ? (
          <div className="notice" style={{ marginTop: "0.75rem" }}>
            <StatusPill>{statusLines(upcoming)[0]}</StatusPill>
            <p style={{ margin: "0.75rem 0" }}>{nextStep(upcoming, user)}</p>
            <Link className="button" href={`/awards/${upcoming.id}`}>
              {copy.primary_label}
            </Link>
          </div>
        ) : (
          <EmptyState title={copy.upcoming_title} body={copy.empty_upcoming} />
        )}
      </section>

      <section>
        <h2 style={{ fontSize: "1.05rem" }}>{copy.register_title}</h2>
        {ordered.length === 0 ? (
          <EmptyState title={copy.register_title} body={copy.empty_register} />
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: "1rem 0 0" }}>
            {ordered.map((award) => (
              <li
                key={award.id}
                style={{
                  display: "flex",
                  gap: "1rem",
                  alignItems: "center",
                  padding: "0.9rem 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    Award {award.id.slice(0, 8)}…
                  </div>
                  <div className="lead" style={{ margin: "0.35rem 0 0" }}>
                    {statusLines(award)[0]}
                    {userActsNow(award, user) ? " · Needs your action" : ""}
                  </div>
                  <div className="lead" style={{ margin: "0.25rem 0 0" }}>
                    Next: {nextStep(award, user)}
                  </div>
                </div>
                <Link className="button secondary" href={`/awards/${award.id}`}>
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {programs[0] ? (
        <p style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {primaryRole === "SPONSOR" || primaryRole === "VERIFIER" ? (
            <>
              <a
                className="button secondary"
                href={`/api/v1/programs/${programs[0].id}/export?format=csv`}
              >
                Export CSV
              </a>
              <a
                className="button secondary"
                href={`/api/v1/programs/${programs[0].id}/export?format=json`}
              >
                Export JSON
              </a>
            </>
          ) : null}
          {primaryRole === "SPONSOR" ? (
            <Link
              className="button secondary"
              href={`/programs/${programs[0].id}/create-award`}
            >
              Create award
            </Link>
          ) : null}
          {user.is_staff ? (
            <Link className="button secondary" href="/admin">
              Admin
            </Link>
          ) : null}
        </p>
      ) : null}
    </AppShell>
  );
}
