import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { Notice } from "@/components/Notice";
import { PageHeading } from "@/components/PageHeading";
import { RestoreSponsorRegisterFocus } from "@/components/RestoreSponsorRegisterFocus";
import { SponsorWorkspace } from "@/components/SponsorWorkspace";
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
  type SponsorRegisterFilters,
  type SponsorRegisterStatus,
  type SponsorWorkspaceView,
} from "@/lib/presentation";
import { requireSessionUser } from "@/lib/session";
import type { Role } from "@/lib/types";
import type { ProgramSummary } from "@/lib/awards/program";

type SearchParams = Record<string, string | string[] | undefined>;

const WORKSPACE_VIEWS: SponsorWorkspaceView[] = [
  "needs-action",
  "awaiting-review",
  "all-awards",
];
const REGISTER_STATUSES: SponsorRegisterStatus[] = [
  "ALL",
  "ON_HOLD",
  "UNRESOLVED",
  "CREATED",
  "FUNDED",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "PAID",
  "REFUNDED",
  "CANCELLED",
];
function queryValue(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const user = await requireSessionUser();
  const params = await (searchParams ?? Promise.resolve({} as SearchParams));
  let programs: ProgramSummary[] = [];
  let awards: Awaited<ReturnType<typeof listVisibleAwardsForUser>> = [];
  let selectedProgram: ProgramSummary | null = null;
  let dbError: string | null = null;

  try {
    programs = await listProgramsForUser(user.id);
    const requestedProgramId = queryValue(params.program);
    selectedProgram =
      programs.find((program) => program.id === requestedProgramId) ??
      programs[0] ??
      null;
    awards =
      selectedProgram?.role === "SPONSOR"
        ? await listVisibleAwardsForUser(user, selectedProgram.id)
        : await listVisibleAwardsForUser(user);
  } catch {
    dbError =
      "Database is not reachable yet. Start local Supabase and run the seed script.";
  }

  const primaryRole = (selectedProgram?.role as Role | undefined) ?? null;
  if (primaryRole === "SPONSOR" && selectedProgram) {
    const rawView = queryValue(params.view);
    const view: SponsorWorkspaceView = WORKSPACE_VIEWS.includes(
      rawView as SponsorWorkspaceView,
    )
      ? (rawView as SponsorWorkspaceView)
      : "needs-action";
    const rawStatus = queryValue(params.status);
    const status: SponsorRegisterStatus = REGISTER_STATUSES.includes(
      rawStatus as SponsorRegisterStatus,
    )
      ? (rawStatus as SponsorRegisterStatus)
      : "ALL";
    const rawSort = queryValue(params.sort);
    const sort: SponsorRegisterFilters["sort"] =
      rawSort === "participant" || rawSort === "status" ? rawSort : "priority";
    const filters: SponsorRegisterFilters = {
      search: queryValue(params.q).slice(0, 120),
      status,
      sort,
    };

    return (
      <AppShell
        username={user.username}
        roleLabel={primaryRole}
        isStaff={user.is_staff}
      >
        {dbError ? <Notice>{dbError}</Notice> : null}
        <RestoreSponsorRegisterFocus />
        <SponsorWorkspace
          awards={awards.filter(
            (award) =>
              award.sponsor_member.user_id === user.id &&
              award.sponsor_member.active,
          )}
          user={user}
          program={selectedProgram}
          programs={programs.filter((program) => program.role === "SPONSOR")}
          view={view}
          filters={filters}
        />
      </AppShell>
    );
  }

  const copy = homeCopy(primaryRole);
  const ordered = sortAwardsForHome(awards, user);
  const upcoming = pickUpcomingAward(ordered, user);
  const attentionCount = ordered.filter((award) => userActsNow(award, user)).length;
  const counts = selectedProgram
    ? await programCounts(selectedProgram.id).catch(() => null)
    : null;

  return (
    <AppShell
      username={user.username}
      roleLabel={primaryRole ?? undefined}
      isStaff={user.is_staff}
    >
      <div className={"programs-home role-" + (primaryRole?.toLowerCase() ?? "member")}>
        <PageHeading title={copy.page_title} lead={selectedProgram?.title} />
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
                        Award {award.id.slice(0, 8)}...
                      </div>
                      <p className="home-award-meta">
                        {statusLines(award)[0]}
                        {userActsNow(award, user) ? " - Needs your action" : ""}
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

        {selectedProgram ? (
          <nav className="home-actions" aria-label="Program actions">
            <Link
              className="button secondary"
              href={"/programs/" + selectedProgram.id}
            >
              View program details
            </Link>
            {primaryRole === "SPONSOR" || primaryRole === "VERIFIER" ? (
              <>
                <a
                  className="button secondary"
                  href={"/api/v1/programs/" + selectedProgram.id + "/export?format=csv"}
                >
                  Export CSV
                </a>
                <a
                  className="button secondary"
                  href={"/api/v1/programs/" + selectedProgram.id + "/export?format=json"}
                >
                  Export JSON
                </a>
              </>
            ) : null}
            {primaryRole === "SPONSOR" ? (
              <Link
                className="button secondary"
                href={"/programs/" + selectedProgram.id + "/create-award"}
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
