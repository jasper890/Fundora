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
  const attentionCount = ordered.filter((award) => userActsNow(award, user)).length;
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
      <div className={"programs-home role-" + (primaryRole?.toLowerCase() ?? "member")}>
        <PageHeading title={copy.page_title} lead={programs[0]?.title} />
        {dbError ? <Notice>{dbError}</Notice> : null}

        {counts ? (
          <section className="home-overview" aria-label="Confirmed award activity">
            <div className="home-overview-heading">
              <div>
                <span className="eyebrow">Program activity</span>
                <h2>Confirmed award status</h2>
              </div>
            </div>
            <div className="metric-grid">
              <MetricCard label="Created" value={counts.CREATED} />
              <MetricCard label="Funded" value={counts.FUNDED} />
              <MetricCard label="Submitted" value={counts.SUBMITTED} />
              <MetricCard label="Approved" value={counts.APPROVED} />
              <MetricCard label="Paid" value={counts.PAID} featured />
              <MetricCard label="Needs you" value={attentionCount} />
            </div>
          </section>
        ) : null}

        <div className="home-columns">
          <section className="home-panel home-upcoming" aria-labelledby="upcoming-heading">
            <span className="eyebrow">Your next step</span>
            <h2 id="upcoming-heading">{copy.upcoming_title}</h2>
            {upcoming ? (
              <div className="notice">
                <StatusPill>{statusLines(upcoming)[0]}</StatusPill>
                <p style={{ margin: "0.75rem 0" }}>{nextStep(upcoming, user)}</p>
                <Link className="button" href={"/awards/" + upcoming.id}>
                  {copy.primary_label}
                </Link>
              </div>
            ) : (
              <EmptyState title={copy.upcoming_title} body={copy.empty_upcoming} />
            )}
          </section>

          <section className="home-panel home-register" aria-labelledby="register-heading">
            <span className="eyebrow">Award register</span>
            <h2 id="register-heading">{copy.register_title}</h2>
            {ordered.length === 0 ? (
              <EmptyState title={copy.register_title} body={copy.empty_register} />
            ) : (
              <ul className="home-register-list">
                {ordered.map((award) => (
                  <li key={award.id} className="home-award-row">
                    <div className="home-award-main">
                      <div className="home-award-title">
                        Award {award.id.slice(0, 8)}…
                      </div>
                      <p className="home-award-meta">
                        {statusLines(award)[0]}
                        {userActsNow(award, user) ? " · Needs your action" : ""}
                      </p>
                      <p className="home-award-meta">
                        Next: {nextStep(award, user)}
                      </p>
                    </div>
                    <Link className="button secondary" href={"/awards/" + award.id}>
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {programs[0] ? (
          <nav className="home-actions" aria-label="Program actions">
            <Link
              className="button secondary"
              href={"/programs/" + programs[0].id}
            >
              View program details
            </Link>
            {primaryRole === "SPONSOR" || primaryRole === "VERIFIER" ? (
              <>
                <a
                  className="button secondary"
                  href={"/api/v1/programs/" + programs[0].id + "/export?format=csv"}
                >
                  Export CSV
                </a>
                <a
                  className="button secondary"
                  href={"/api/v1/programs/" + programs[0].id + "/export?format=json"}
                >
                  Export JSON
                </a>
              </>
            ) : null}
            {primaryRole === "SPONSOR" ? (
              <Link
                className="button secondary"
                href={"/programs/" + programs[0].id + "/create-award"}
              >
                Create award
              </Link>
            ) : null}
            {user.is_staff ? (
              <Link className="button secondary" href="/admin">
                Admin
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </AppShell>
  );
}
