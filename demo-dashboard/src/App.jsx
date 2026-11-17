import React, { useEffect, useMemo, useState } from 'react';
import { activities, attentionItems, navItems, participants } from './data.js';

const programMetrics = {
  participants: participants.length,
  funded: participants.filter((person) => ['Funded', 'Approved', 'Paid'].includes(person.status)).length,
  awaitingReview: participants.filter((person) => ['Submitted', 'In review'].includes(person.status)).length,
  readyForPayment: participants.filter((person) => person.status === 'Approved').length,
};
const fundingPercent = programMetrics.participants
  ? Math.round((programMetrics.funded / programMetrics.participants) * 100)
  : 0;

const iconPaths = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  award: <><circle cx="12" cy="8" r="5" /><path d="m8.5 12-1 9 4.5-2.5 4.5 2.5-1-9" /></>,
  activity: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="2.5" cy="6" r=".5" /><circle cx="2.5" cy="12" r=".5" /><circle cx="2.5" cy="18" r=".5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.8Z" transform="translate(-1 -1) scale(1.08)" /></>,
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20v-1.4A5.6 5.6 0 0 1 8.1 13h1.8a5.6 5.6 0 0 1 5.6 5.6V20M16 4.8a3.5 3.5 0 0 1 0 6.7M17 14a5 5 0 0 1 4.5 5v1" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.3 2" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  file: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  handshake: <><path d="m3 12 4-4 4 1 2-1 4 2 4-2 1 2-4 5-4 2-5-3-2 1-4-3Z" /><path d="m8 14 3 2m1-4 4 3m-2-6 3 2" /></>,
  coins: <><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v5c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 11v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
  spark: <><path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3ZM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></>,
};

function Icon({ name, size = 20, strokeWidth = 1.8, className = '' }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

function StatusBadge({ status, tone }) {
  const fallback = status === 'Paid' || status === 'Approved' || status === 'Ready' ? 'green' : status === 'In review' || status === 'Status check' ? 'amber' : 'blue';
  return <span className={`status-badge status-${tone || fallback}`}><span className="status-dot" />{status}</span>;
}

function StatCard({ icon, label, value, note, featured = false }) {
  if (featured) {
    return <article className="stat-card stat-card-featured">
      <div className="stat-featured-heading"><span className="stat-label">{label}</span><span className="stat-context">COHORT FUNDING</span></div>
      <div className="stat-featured-value"><strong>{value}</strong><span>of {programMetrics.participants} participants funded</span></div>
      <div className="stat-featured-meter" role="progressbar" aria-label="Awards funded in this cohort" aria-valuemin="0" aria-valuemax={Math.max(programMetrics.participants, 1)} aria-valuenow={programMetrics.funded} aria-valuetext={`${programMetrics.funded} of ${programMetrics.participants} awards funded`}><span style={{ width: `${fundingPercent}%` }} /></div>
      <span className="stat-note">{fundingPercent}% of participant awards funded</span>
    </article>;
  }

  return <article className="stat-card">
    <span className="stat-icon"><Icon name={icon} size={19} /></span>
    <div className="stat-copy"><strong className="stat-value">{value}</strong><span className="stat-label">{label}</span><span className="stat-note">{note}</span></div>
  </article>;
}

function Sidebar({ activeNav, onNavigate, mobileOpen, onClose }) {
  return <>
    {mobileOpen && <button className="drawer-scrim" aria-label="Close navigation" onClick={onClose} />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand">
        <a href="#overview" className="brand-lockup" aria-label="ProofPay overview" onClick={() => onNavigate('Overview')}>
          <span className="brand-symbol"><span /></span><span className="brand-name">ProofPay</span><span className="brand-flare">N/</span>
        </a>
        <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={onClose}><Icon name="close" /></button>
      </div>
      <div className="sidebar-program">
        <span className="program-mark">CW</span>
        <span><strong>Community workshop</strong><small>SPONSORED PROGRAM</small></span>
        <Icon name="more" size={18} />
      </div>
      <div className="sidebar-label">Workspace</div>
      <nav className="primary-nav" aria-label="Main navigation">
        {navItems.map((item) => <button key={item.label} className={`nav-link ${activeNav === item.label ? 'nav-active' : ''}`} onClick={() => onNavigate(item.label)} aria-current={activeNav === item.label ? 'page' : undefined}>
          <Icon name={item.icon} size={19} /><span>{item.label}</span>{item.label === 'Awards' && <span className="nav-count">{programMetrics.participants}</span>}
        </button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-help"><span className="help-icon"><Icon name="spark" size={17} /></span><span><strong>Workshop guide</strong><small>Steps for participants</small></span><Icon name="arrow" size={15} /></div>
        <div className="sidebar-profile"><div className="profile-avatar">SP</div><div className="profile-copy"><strong>Sam Parker</strong><span>Program sponsor</span></div><button className="icon-button profile-more" aria-label="Profile options"><Icon name="more" size={18} /></button></div>
        <p className="synthetic-note">CONCEPT · SYNTHETIC DATA</p>
      </div>
    </aside>
  </>;
}

function ProgressPanel() {
  const steps = [
    'Funded',
    'Evidence submitted',
    'Verifier approved',
    'Payment confirmed',
  ];
  return <section className="progress-section" aria-labelledby="progress-title">
    <div className="progress-title"><h2 id="progress-title">Award progress</h2><p>Individual award stages</p></div>
    <div className="progress-lifecycle">
      <ol className="progress-track" aria-label="Typical individual award lifecycle stages">
        {steps.map((step, index) => <li className="progress-step" key={step}>
          <div className="step-rail"><span className="step-node">{index + 1}</span>{index < steps.length - 1 && <span className="step-line" />}</div>
          <strong>{step}</strong>
        </li>)}
      </ol>
    </div>
  </section>;
}

function AttentionPanel({ onAction }) {
  return <section className="panel attention-panel" aria-labelledby="attention-title">
    <div className="panel-heading"><div><h2 id="attention-title">Needs your attention</h2></div><div className="attention-heading-actions"><span className="attention-count">{String(attentionItems.length).padStart(2, '0')}</span><button className="panel-footer-link" onClick={() => onAction('Open awards', 'Awards')}>View all award activity <Icon name="arrow" size={15} /></button></div></div>
    <div className="attention-list">
      {attentionItems.map((item, index) => <div className="attention-item" key={item.name}>
        <div className="attention-avatar" data-index={index}>{item.name.split(' ').map((part) => part[0]).join('')}</div>
        <div className="attention-main"><div className="attention-person"><strong>{item.name}</strong><StatusBadge status={item.status} /></div><span className="attention-detail">{item.detail}<span className="attention-note"> · {item.note}</span></span></div>
        <button className={`attention-action ${item.type === 'primary' ? 'button-coral' : item.type === 'link' ? 'button-link' : 'button-quiet'}`} onClick={() => onAction(item.action, item.name)}>{item.action}{item.type === 'primary' && <Icon name="arrow" size={15} />}</button>
      </div>)}
    </div>
  </section>;
}

function ActivityPanel() {
  return <section className="panel activity-panel" aria-labelledby="activity-title">
    <div className="panel-heading"><div><h2 id="activity-title">Recent activity</h2></div><button className="panel-footer-link" onClick={() => window.dispatchEvent(new CustomEvent('proofpay:toast', { detail: 'Showing the latest workshop updates.' }))}>Open activity log <Icon name="arrow" size={15} /></button></div>
    <ol className="activity-list">
      {activities.map((item) => <li className="activity-item" key={item.title}>
        <span className={`activity-icon activity-${item.tone}`}><Icon name={item.icon} size={17} /></span>
        <div className="activity-copy"><strong>{item.title}</strong><span>{item.detail}</span><time>{item.time}</time></div>
      </li>)}
    </ol>
  </section>;
}

function TableMenu({ participant, onAction }) {
  return <details className="row-menu">
    <summary aria-label={`Actions for ${participant.name}`}><Icon name="more" size={18} /></summary>
    <div className="row-menu-popover">
      <button onClick={(event) => { onAction('Opened participant details', participant.name); event.currentTarget.closest('details').open = false; }}>View participant</button>
      <button onClick={(event) => { onAction('Demo action recorded', participant.name); event.currentTarget.closest('details').open = false; }}>Record demo update</button>
    </div>
  </details>;
}

function ParticipantTable({ onAction }) {
  const [query, setQuery] = useState('');
  const [queue, setQueue] = useState('All awards');
  const [sort, setSort] = useState('recent');
  const queues = [
    { label: 'All awards', matches: () => true },
    { label: 'Awaiting review', matches: (person) => ['Submitted', 'In review'].includes(person.status) },
    { label: 'Approved', matches: (person) => person.status === 'Approved' },
    { label: 'Funded', matches: (person) => person.status === 'Funded' },
    { label: 'Paid', matches: (person) => person.status === 'Paid' },
  ].map((item) => ({ ...item, count: participants.filter(item.matches).length }));
  const visible = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    const activeQueue = queues.find((item) => item.label === queue) || queues[0];
    return participants.filter((person) => {
      const matchesQuery = !lowered || `${person.name} ${person.status} ${person.next}`.toLowerCase().includes(lowered);
      return matchesQuery && activeQueue.matches(person);
    }).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : b.sortTime - a.sortTime);
  }, [query, queue, sort]);

  return <section className="panel table-panel" aria-labelledby="participants-title">
    <div className="table-heading">
      <div className="table-title"><h2 id="participants-title">Participant awards</h2></div>
      <div className="table-actions">
        <label className="search-control"><Icon name="search" size={17} /><span className="visually-hidden">Search participants</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search participants…" /></label>
        <button className="sort-button" onClick={() => setSort((value) => value === 'recent' ? 'name' : 'recent')}><Icon name="activity" size={16} />Sort: {sort === 'recent' ? 'Recent' : 'Name'}</button>
        <button className="export-button" onClick={() => onAction('Export prepared', 'This demo does not download real payment data.')}><Icon name="file" size={16} />Export</button>
      </div>
    </div>
    <div className="queue-tabs" role="group" aria-label="Filter award records">
      {queues.map((item) => <button key={item.label} className={`queue-tab ${queue === item.label ? 'queue-tab-active' : ''}`} aria-pressed={queue === item.label} onClick={() => setQueue(item.label)}>{item.label}<span>{item.count}</span></button>)}
    </div>
    <div className="table-scroll" role="region" aria-label="Participant awards table" tabIndex="0">
      <table>
        <thead><tr><th><button className="th-sort" onClick={() => setSort((value) => value === 'name' ? 'recent' : 'name')}>Participant <span aria-hidden="true">↕</span></button></th><th>Amount</th><th>Award status</th><th>Next step</th><th>Last update</th><th aria-label="Actions" /></tr></thead>
        <tbody>
          {visible.map((person) => <tr key={person.name}>
            <td><div className="table-person"><span className="table-avatar">{person.initials}</span><strong>{person.name}</strong></div></td>
            <td><span className="amount">20 <small>XLM</small></span></td>
            <td><StatusBadge status={person.status} tone={person.tone} /></td>
            <td className={person.next.includes('payment') ? 'next-step next-action' : 'next-step'}>{person.next}</td>
            <td className="updated-cell">{person.updated}</td>
            <td className="action-cell"><TableMenu participant={person} onAction={onAction} /></td>
          </tr>)}
          {visible.length === 0 && <tr><td colSpan="6"><div className="empty-state"><span className="empty-mark"><Icon name="search" /></span><strong>No participants found</strong><span>Try a different name or award queue.</span><button onClick={() => { setQuery(''); setQueue('All awards'); }}>Clear search and filters</button></div></td></tr>}
        </tbody>
      </table>
    </div>
    <div className="table-footer"><span>Showing <strong>{visible.length}</strong> of <strong>{participants.length}</strong> participants</span><span className="table-footer-note"><Icon name="shield" size={14} /> Demo roster · synthetic records</span></div>
  </section>;
}

function TermsPanel() {
  return <aside className="panel terms-panel" aria-labelledby="terms-title">
    <div className="panel-heading terms-heading"><div><span className="eyebrow">At a glance</span><h2 id="terms-title">Program terms</h2><p>Key details for this training stipend.</p></div></div>
    <div className="term-item"><span className="term-icon"><Icon name="coins" size={19} /></span><div><strong>Fixed stipend</strong><p>20 Testnet XLM per participant</p></div></div>
    <div className="term-item"><span className="term-icon"><Icon name="people" size={19} /></span><div><strong>Program roles</strong><p><b>Participant</b> · Complete training and submit evidence</p><p><b>Verifier</b> · Review evidence and approve or reject</p><p><b>Sponsor</b> · Release payments for approved awards</p></div></div>
    <div className="term-item"><span className="term-icon"><Icon name="calendar" size={19} /></span><div><strong>Key deadlines</strong><ul><li><b>Claim</b> · Nov 20, 2026, 11:59 PM</li><li><b>Review</b> · Nov 24, 2026, 11:59 PM</li><li><b>Payout</b> · Dec 1, 2026, 11:59 PM</li></ul></div></div>
    <div className="term-item term-refund"><span className="term-icon"><Icon name="shield" size={19} /></span><div><strong>Refund policy</strong><p>The sponsor may reclaim unpaid funds after the payout cutoff.</p><span className="policy-date">CUTOFF · DEC 1, 2026</span></div></div>
    <div className="terms-bottom"><span className="terms-lock"><Icon name="shield" size={14} /></span>Demo only · no funds move</div>
  </aside>;
}

function App() {
  const [activeNav, setActiveNav] = useState('Overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [toastDetail, setToastDetail] = useState('');

  const showToast = (message, detail = '') => {
    setToast(message);
    setToastDetail(detail);
  };

  useEffect(() => {
    const onToast = (event) => showToast(event.detail);
    window.addEventListener('proofpay:toast', onToast);
    return () => window.removeEventListener('proofpay:toast', onToast);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3600);
    return () => window.clearTimeout(timer);
  }, [toast, toastDetail]);

  const navigate = (label) => {
    setActiveNav(label);
    setMobileOpen(false);
    if (label !== 'Overview') showToast(`${label} preview`, 'This concept focuses on the program overview dashboard.');
  };

  const handleAction = (action, person) => {
    const message = action === 'Release payment' ? 'Demo payment prepared' : action === 'Check status' ? 'Payment status checked' : action;
    showToast(message, `${person} · simulated only. No real funds were moved.`);
  };

  return <div className="app-shell">
    <div className="testnet-banner"><span className="banner-spark">✳</span><span>TESTNET XLM</span><i />No real monetary value<span className="banner-tag">DEMO ENVIRONMENT</span></div>
    <div className="app-body">
      <Sidebar activeNav={activeNav} onNavigate={navigate} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="main-area" id="overview">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Icon name="menu" /></button>
          <div className="topbar-program"><span className="topbar-kicker">PROGRAM</span><strong>Community workshop</strong></div>
          <div className="topbar-divider" />
          <div className="topbar-meta"><Icon name="calendar" size={17} /><span>November 17, 2026</span></div>
          <div className="topbar-divider topbar-divider-short" />
          <div className="sponsor-meta"><span className="sponsor-icon"><Icon name="handshake" size={18} /></span><span className="sponsor-caption">SPONSOR</span><strong>Riverside Skills Fund</strong></div>
          <div className="topbar-account"><div className="profile-avatar topbar-avatar">SP</div><span><strong>Sam Parker</strong><small>Sponsor</small></span><Icon name="more" size={17} /></div>
        </header>

        <div className="content-wrap">
          <section className="page-intro">
            <div><h1>Program overview</h1><p>Track each award from funding through payment.</p></div>
            <button className="primary-action" onClick={() => showToast('Invite link copied', 'Demo link copied to your clipboard preview.')}><span>+</span>Invite participants</button>
          </section>

          <section className="stats-grid" aria-label="Program statistics">
            <StatCard icon="layers" label="Funded awards" value={programMetrics.funded} featured />
            <StatCard icon="people" label="Participants" value={programMetrics.participants} note="Enrolled in this program" />
            <StatCard icon="clock" label="Awaiting review" value={programMetrics.awaitingReview} note="Submitted or in review" />
            <StatCard icon="check" label="Ready for payment" value={programMetrics.readyForPayment} note="Approved, awaiting release" />
          </section>

          <section className="overview-grid" aria-label="Program operations">
            <AttentionPanel onAction={handleAction} />
            <ActivityPanel />
          </section>

          <ProgressPanel />

          <section className="records-grid" aria-label="Program participants and terms">
            <ParticipantTable onAction={handleAction} />
            <TermsPanel />
          </section>
          <footer className="page-footer"><span>PROOFPAY <b>/</b> COMMUNITY WORKSHOP</span><span>Concept dashboard · synthetic participant data</span><a href="#overview">Back to top ↑</a></footer>
        </div>
      </main>
    </div>
    {toast && <div className="toast" role="status" aria-live="polite"><span className="toast-icon"><Icon name="check" size={16} /></span><span><strong>{toast}</strong>{toastDetail && <small>{toastDetail}</small>}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><Icon name="close" size={16} /></button></div>}
  </div>;
}

export default App;
