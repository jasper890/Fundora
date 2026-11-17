import React, { useEffect, useMemo, useRef, useState } from 'react';
import './preview-register.css';

const REVIEW_STATUSES = new Set(['Submitted', 'In review']);
const FILTERS = [
  { value: 'All awards', matches: () => true },
  { value: 'Awaiting review', matches: (award) => REVIEW_STATUSES.has(award.status) },
  { value: 'Approved', matches: (award) => award.status === 'Approved' },
  { value: 'Funded', matches: (award) => award.status === 'Funded' },
  { value: 'Paid', matches: (award) => award.status === 'Paid' },
];

const recordKey = (award) => award.id ?? award.name;

function nextStepFor(award) {
  if (award.paymentState === 'ready') return 'Release payment';
  if (award.paymentState === 'check') return 'Check payment status';
  return award.next || 'No next step listed';
}

function getActionPanelId(award) {
  return `pp-register-actions-${String(recordKey(award)).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function Person({ award, compact = false }) {
  return (
    <div className={`pp-register-person${compact ? ' pp-register-person--compact' : ''}`}>
      <span className="pp-register-avatar" aria-hidden="true">{award.initials}</span>
      <span className="pp-register-person-name">{award.name}</span>
    </div>
  );
}

function RecordActions({ award, open, panelId, onToggle }) {
  return (
    <div className="pp-register-action-disclosure" data-award-actions>
      <button
        className="pp-register-action-trigger"
        type="button"
        aria-label={`${open ? 'Hide' : 'Show'} actions for ${award.name}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        data-award-action-trigger
        data-award-key={String(recordKey(award))}
        onClick={onToggle}
      >
        <span aria-hidden="true">•••</span>
      </button>
    </div>
  );
}

function EmptyState({ onReset }) {
  return (
    <div className="pp-register-empty">
      <strong>No awards match these controls</strong>
      <p>Try a different name, status, or next step.</p>
      <button type="button" onClick={onReset}>Clear search and filters</button>
    </div>
  );
}

export default function PreviewParticipantTable({ awards = [], Icon, StatusBadge, onDemoAction }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All awards');
  const [sort, setSort] = useState('recent');
  const [openAwardKey, setOpenAwardKey] = useState(null);
  const sectionRef = useRef(null);

  const counts = useMemo(() => new Map(
    FILTERS.map(({ value, matches }) => [value, awards.filter(matches).length]),
  ), [awards]);

  const visibleAwards = useMemo(() => {
    const loweredQuery = query.trim().toLocaleLowerCase();
    const activeFilter = FILTERS.find((item) => item.value === filter) ?? FILTERS[0];
    return awards
      .filter((award) => activeFilter.matches(award))
      .filter((award) => {
        if (!loweredQuery) return true;
        const next = nextStepFor(award);
        return `${award.name} ${award.status} ${next}`.toLocaleLowerCase().includes(loweredQuery);
      })
      .slice()
      .sort((first, second) => sort === 'name'
        ? first.name.localeCompare(second.name)
        : (second.sortTime ?? 0) - (first.sortTime ?? 0));
  }, [awards, filter, query, sort]);

  useEffect(() => {
    if (openAwardKey !== null && !visibleAwards.some((award) => String(recordKey(award)) === openAwardKey)) {
      setOpenAwardKey(null);
    }
  }, [openAwardKey, visibleAwards]);

  useEffect(() => {
    if (openAwardKey === null) return undefined;
    const dismissOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpenAwardKey(null);
      const trigger = Array.from(sectionRef.current?.querySelectorAll('[data-award-action-trigger]') ?? [])
        .find((element) => element.dataset.awardKey === openAwardKey && element.getClientRects().length > 0);
      trigger?.focus();
    };
    document.addEventListener('keydown', dismissOnEscape);
    return () => document.removeEventListener('keydown', dismissOnEscape);
  }, [openAwardKey]);

  const resetQueryAndFilter = () => {
    setQuery('');
    setFilter('All awards');
  };

  const toggleActions = (award) => {
    const key = String(recordKey(award));
    setOpenAwardKey((current) => current === key ? null : key);
  };

  const runAction = (action, award) => {
    onDemoAction?.(action, award);
    setOpenAwardKey(null);
    const key = String(recordKey(award));
    const trigger = Array.from(sectionRef.current?.querySelectorAll('[data-award-action-trigger]') ?? [])
      .find((element) => element.dataset.awardKey === key && element.getClientRects().length > 0);
    trigger?.focus();
  };

  const actionProps = (award) => ({
    award,
    open: openAwardKey === String(recordKey(award)),
    onToggle: () => toggleActions(award),
  });

  const hasResults = visibleAwards.length > 0;

  return (
    <section className="pp-register" id="participants" ref={sectionRef} tabIndex={-1} aria-labelledby="pp-register-title">
      <header className="pp-register-header">
        <div className="pp-register-heading">
          <span className="pp-register-kicker">AWARD REGISTER</span>
          <h2 id="pp-register-title" tabIndex={-1}>Participant awards</h2>
          <p>Search the roster and review each award’s next step.</p>
        </div>
        <div className="pp-register-toolbar" aria-label="Award register controls">
          <label className="pp-register-search">
            {Icon && <Icon name="search" size={17} />}
            <span className="pp-register-visually-hidden">Search participant name, status, or next step</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search awards…"
            />
            {query && (
              <button className="pp-register-clear" type="button" aria-label="Clear search" onClick={() => setQuery('')}>
                {Icon ? <Icon name="close" size={16} /> : '×'}
              </button>
            )}
          </label>
          <label className="pp-register-select-control">
            <span>Show</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter participant awards">
              {FILTERS.map(({ value }) => <option value={value} key={value}>{value} ({counts.get(value) ?? 0})</option>)}
            </select>
          </label>
          <label className="pp-register-select-control pp-register-sort-control">
            <span>Sort</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort participant awards">
              <option value="recent">Most recent</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
          <button className="pp-register-export" type="button" onClick={() => onDemoAction?.('export')}>
            {Icon && <Icon name="file" size={16} />}
            <span>Export</span>
          </button>
        </div>
      </header>

      <div className="pp-register-result-line">
        <span role="status" aria-live="polite">Showing {visibleAwards.length} of {awards.length} awards</span>
        <span className="pp-register-data-note">Demo roster · synthetic records</span>
      </div>

      {hasResults ? (
        <>
          <div className="pp-register-table-wrap">
            <table className="pp-register-table">
              <thead>
                <tr>
                  <th scope="col">Participant</th>
                  <th className="pp-register-amount-cell" scope="col">Amount</th>
                  <th scope="col">Workflow status</th>
                  <th scope="col">Next step</th>
                  <th scope="col">Last update</th>
                  <th className="pp-register-actions-column" scope="col"><span className="pp-register-visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleAwards.map((award) => {
                  const key = String(recordKey(award));
                  const nextStep = nextStepFor(award);
                  const actionPanelId = `${getActionPanelId(award)}-table`;
                  const actions = actionProps(award);
                  return (
                    <React.Fragment key={key}>
                      <tr className="pp-register-row">
                        <th className="pp-register-participant-cell" scope="row"><Person award={award} /></th>
                        <td className="pp-register-amount-cell"><span className="pp-register-amount">{award.amount}<small> XLM</small></span></td>
                        <td><StatusBadge status={award.status} tone={award.tone} /></td>
                        <td className="pp-register-next-step">{nextStep}</td>
                        <td className="pp-register-updated">{award.updated}</td>
                        <td className="pp-register-actions-column">
                          <RecordActions {...actions} panelId={actionPanelId} />
                        </td>
                      </tr>
                      {actions.open && (
                        <tr className="pp-register-expanded-row">
                          <td colSpan="6">
                            <div className="pp-register-expanded-copy"><strong>Actions for {award.name}</strong><span>Preview actions use synthetic award data.</span></div>
                            <div className="pp-register-expanded-actions" id={actionPanelId} role="group" aria-label={`Actions for ${award.name}`}>
                              <button type="button" onClick={() => runAction('view-participant', award)}>View participant</button>
                              <button type="button" onClick={() => runAction('record-update', award)}>Record demo update</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="pp-register-card-list" aria-label="Participant award cards">
            {visibleAwards.map((award) => {
              const key = String(recordKey(award));
              const nextStep = nextStepFor(award);
              const actionPanelId = `${getActionPanelId(award)}-card`;
              const actions = actionProps(award);
              return (
                <article className="pp-register-card" key={key}>
                  <div className="pp-register-card-top">
                    <Person award={award} />
                    <StatusBadge status={award.status} tone={award.tone} />
                  </div>
                  <div className="pp-register-card-next"><span>Next step</span><strong>{nextStep}</strong></div>
                  <div className="pp-register-card-meta"><span className="pp-register-amount">{award.amount}<small> XLM</small></span><span>Updated {award.updated}</span></div>
                  <RecordActions {...actions} panelId={actionPanelId} />
                  {actions.open && (
                    <div className="pp-register-card-expanded" id={actionPanelId} role="group" aria-label={`Actions for ${award.name}`}>
                      <p>Preview actions use synthetic award data.</p>
                      <button type="button" onClick={() => runAction('view-participant', award)}>View participant</button>
                      <button type="button" onClick={() => runAction('record-update', award)}>Record demo update</button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <EmptyState onReset={resetQueryAndFilter} />
      )}
    </section>
  );
}
