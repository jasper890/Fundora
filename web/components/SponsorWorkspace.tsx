import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { confirmedFundingSummary, confirmedAwardStatusCounts, filterSponsorWorkspaceAwards, formatTestnetXlm, nextStep, selectSponsorWorkspaceAwards, sponsorWorkspaceCounts, statusLines } from "@/lib/presentation";
import { AWARD_AMOUNT, type AppUser, type AwardListView } from "@/lib/types";
import type { ProgramSummary } from "@/lib/awards/program";
import type { SponsorRegisterFilters, SponsorRegisterStatus, SponsorWorkspaceView } from "@/lib/presentation";

const VIEWS: { value: SponsorWorkspaceView; label: string }[] = [
  { value: "needs-action", label: "Needs action" },
  { value: "awaiting-review", label: "Awaiting review" },
  { value: "all-awards", label: "All awards" },
];

const STATUS_OPTIONS: { value: SponsorRegisterStatus; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "CREATED", label: "Created" },
  { value: "FUNDED", label: "Funded" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "PAID", label: "Paid" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "ON_HOLD", label: "On hold" },
  { value: "UNRESOLVED", label: "Outcome not confirmed" },
];

const SORT_OPTIONS = [
  { value: "priority", label: "Priority" },
  { value: "participant", label: "Participant A-Z" },
  { value: "status", label: "Status" },
] as const;

type Props = {
  awards: AwardListView[];
  user: AppUser;
  program: ProgramSummary;
  programs: ProgramSummary[];
  view: SponsorWorkspaceView;
  filters: SponsorRegisterFilters;
};

function workspaceHref(
  programId: string,
  view: SponsorWorkspaceView,
  filters: SponsorRegisterFilters,
  focus?: string,
): string {
  const params = new URLSearchParams();
  params.set("program", programId);
  params.set("view", view);
  if (filters.search) params.set("q", filters.search);
  params.set("status", filters.status);
  params.set("sort", filters.sort);
  if (focus) params.set("focus", focus);
  return "/programs?" + params.toString();
}

function awardHref(
  awardId: string,
  programId: string,
  view: SponsorWorkspaceView,
  filters: SponsorRegisterFilters,
): string {
  const from = workspaceHref(programId, view, filters, awardId);
  return "/awards/" + encodeURIComponent(awardId) + "?" +
    new URLSearchParams({ from }).toString();
}

function labelStatus(status: string): string {
  return status.toLowerCase().replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function StatusLabels({ award }: { award: AwardListView }) {
  return (
    <span className="sponsor-status-list">
      <span className={"sponsor-status sponsor-status--" + award.status.toLowerCase()}>
        {labelStatus(award.status)}
      </span>
      {award.sponsor_hold || award.verifier_hold ? (
        <span className="sponsor-status sponsor-status--warning">On hold</span>
      ) : null}
      {award.unresolved_operation ? (
        <span className="sponsor-status sponsor-status--warning">Outcome not confirmed</span>
      ) : null}
      {!award.last_confirmed_ledger ? (
        <span className="sponsor-status sponsor-status--warning">Not confirmed on-chain</span>
      ) : null}
      {statusLines(award).includes("Evidence saved. Submission not yet signed.") ? (
        <span className="sponsor-status sponsor-status--warning">Evidence not yet submitted</span>
      ) : null}
    </span>
  );
}

function Participant({ award }: { award: AwardListView }) {
  return (
    <span className="sponsor-participant">
      <span className="sponsor-avatar" aria-hidden="true">
        {award.recipient_username.slice(0, 1).toUpperCase()}
      </span>
      <span>{award.recipient_username}</span>
    </span>
  );
}

function AwardLink({
  award,
  href,
  user,
}: {
  award: AwardListView;
  href: string;
  user: AppUser;
}) {
  const step = nextStep(award, user);
  return (
    <Link
      className="button secondary sponsor-open-award"
      href={href}
      data-award-open={award.id}
      aria-label={"View award for " + award.recipient_username + ". Next step: " + step}
    >
      View award
    </Link>
  );
}

export function SponsorWorkspace({
  awards,
  user,
  program,
  programs,
  view,
  filters,
}: Props) {
  const counts = sponsorWorkspaceCounts(awards, user);
  const viewAwards = selectSponsorWorkspaceAwards(awards, user, view);
  const visibleAwards = filterSponsorWorkspaceAwards(viewAwards, filters, user);
  const statusCounts = Object.fromEntries(
    STATUS_OPTIONS.map(({ value }) => [
      value,
      filterSponsorWorkspaceAwards(
        viewAwards,
        { search: "", status: value, sort: "priority" },
        user,
      ).length,
    ]),
  ) as Record<SponsorRegisterStatus, number>;
  const summary = confirmedFundingSummary(confirmedAwardStatusCounts(awards));
  const fundedPercent = awards.length
    ? Math.min(100, Math.round((summary.fundedAwards / awards.length) * 100))
    : 0;

  const rowHref = (awardId: string) => awardHref(awardId, program.id, view, filters);
  const clearHref = workspaceHref(program.id, view, {
    search: "",
    status: "ALL",
    sort: "priority",
  });

  return (
    <div className="programs-home role-sponsor sponsor-workspace">
      <PageHeading
        title="Sponsor workspace"
        lead={program.title}
      />

      <section className="sponsor-funding-summary" aria-labelledby="sponsor-funding-title">
        <div className="sponsor-summary-heading">
          <div>
            <span className="eyebrow">Confirmed program data</span>
            <h2 id="sponsor-funding-title">Funding summary</h2>
          </div>
          <span className="sponsor-testnet-note">Testnet XLM - no real monetary value</span>
        </div>
        <dl className="sponsor-summary-facts">
          <div>
            <dt>Confirmed funding</dt>
            <dd>{formatTestnetXlm(summary.confirmedBaseUnits)} <span>Testnet XLM</span></dd>
          </div>
          <div>
            <dt>Reserved for unpaid awards</dt>
            <dd>{formatTestnetXlm(summary.reservedBaseUnits)} <span>Testnet XLM</span></dd>
          </div>
          <div>
            <dt>Awards funded</dt>
            <dd>{summary.fundedAwards} <span>of {awards.length}</span></dd>
          </div>
        </dl>
        <div
          className="sponsor-funding-progress"
          role="progressbar"
          aria-label="Awards with confirmed funding"
          aria-valuemin={0}
          aria-valuemax={Math.max(awards.length, 1)}
          aria-valuenow={summary.fundedAwards}
          aria-valuetext={summary.fundedAwards + " of " + awards.length + " awards funded"}
        >
          <span style={{ width: fundedPercent + "%" }} />
        </div>
        <p className="sponsor-summary-note">
          Only awards with a confirmed chain ledger are included in these amounts.
        </p>
      </section>

      <section className="sponsor-register" aria-labelledby="sponsor-register-title">
        <header className="sponsor-register-header">
          <div>
            <span className="eyebrow">Participant status and next step</span>
            <h2 id="sponsor-register-title" tabIndex={-1}>Award register</h2>
            <p>Review each participant award and its next eligible step.</p>
          </div>
          <a
            className="button secondary sponsor-export"
            href={"/api/v1/programs/" + encodeURIComponent(program.id) + "/export?format=csv"}
          >
            Export CSV
          </a>
        </header>

        <nav className="sponsor-register-views" aria-label="Award views">
          {VIEWS.map(({ value, label }) => (
            <Link
              key={value}
              href={workspaceHref(program.id, value, filters)}
              aria-current={view === value ? "page" : undefined}
              className={"sponsor-register-view" + (view === value ? " is-active" : "")}
            >
              <span>{label}</span>
              <span className="sponsor-view-count">{counts[value]}</span>
            </Link>
          ))}
        </nav>

        <form className="sponsor-register-filters" method="get" action="/programs">
          <label>
            <span>Program</span>
            <select name="program" defaultValue={program.id}>
              {programs.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
          </label>
          <label className="sponsor-search">
            <span>Search participant, status, or next step</span>
            <input
              type="search"
              name="q"
              value={filters.search}
              maxLength={120}
              placeholder="Search awards"
            />
          </label>
          <label>
            <span>Status</span>
            <select name="status" defaultValue={filters.status}>
              {STATUS_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label} ({statusCounts[value]})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select name="sort" defaultValue={filters.sort}>
              {SORT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <input type="hidden" name="view" value={view} />
          <button className="button sponsor-apply-filters" type="submit">Apply filters</button>
        </form>

        <div className="sponsor-register-result" role="status" aria-live="polite">
          Showing {visibleAwards.length} of {viewAwards.length} awards in this view
        </div>

        {visibleAwards.length ? (
          <>
            <div className="sponsor-table-wrap">
              <table className="sponsor-award-table">
                <thead>
                  <tr>
                    <th scope="col">Participant</th>
                    <th scope="col" className="sponsor-amount-cell">Amount</th>
                    <th scope="col">Status</th>
                    <th scope="col">Next step</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAwards.map((award) => (
                    <tr key={award.id}>
                      <th scope="row"><Participant award={award} /></th>
                      <td className="sponsor-amount-cell">
                        {formatTestnetXlm(AWARD_AMOUNT)} <span>Testnet XLM</span>
                      </td>
                      <td><StatusLabels award={award} /></td>
                      <td className="sponsor-next-step">
                        <p>{nextStep(award, user)}</p>
                        <AwardLink award={award} href={rowHref(award.id)} user={user} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="sponsor-award-cards" aria-label="Participant awards">
              {visibleAwards.map((award) => (
                <li key={award.id} className="sponsor-award-card">
                  <div className="sponsor-card-heading">
                    <Participant award={award} />
                    <strong>{formatTestnetXlm(AWARD_AMOUNT)} <span>Testnet XLM</span></strong>
                  </div>
                  <StatusLabels award={award} />
                  <p className="sponsor-card-next-label">Next step</p>
                  <p>{nextStep(award, user)}</p>
                  <AwardLink award={award} href={rowHref(award.id)} user={user} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="sponsor-register-empty">
            <strong>No awards match these controls.</strong>
            <p>Try another participant, status, or view.</p>
            <Link className="button secondary" href={clearHref}>Clear search and status filter</Link>
          </div>
        )}
      </section>

      <nav className="home-actions sponsor-program-actions" aria-label="Program actions">
        <Link className="button secondary" href={"/programs/" + program.id}>View program details</Link>
        <a className="button secondary" href={"/api/v1/programs/" + program.id + "/export?format=json"}>Export JSON</a>
        <Link className="button secondary" href={"/programs/" + program.id + "/create-award"}>Create award</Link>
        {user.is_staff ? <Link className="button secondary" href="/admin">Admin</Link> : null}
      </nav>
    </div>
  );
}
