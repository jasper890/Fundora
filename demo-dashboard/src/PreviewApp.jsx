import React, { useState } from 'react';
import { activities } from './data.js';
import { previewAwards, summarizeAwards } from './preview-awards.js';
import { PreviewNavigation } from './PreviewNavigation.jsx';
import PreviewParticipantTable from './PreviewParticipantTable.jsx';

const summary = summarizeAwards(previewAwards);

const iconShapes = {
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

function Icon({ name, size = 18, strokeWidth = 1.75, className = '' }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconShapes[name]}</svg>;
}

function StatusBadge({ status, tone }) {
  const fallback = status === 'Paid' || status === 'Approved' || status === 'Ready' ? 'green' : status === 'In review' || status === 'Status check' ? 'amber' : 'blue';
  return <span className={`pp-status pp-status--${tone || fallback}`}><span className="pp-status-dot" />{status}</span>;
}

function BrandMark() {
  return <span className="pp-brand-mark" aria-hidden="true"><span /><i /></span>;
}

function Topbar() {
  return <header className="pp-topbar">
    <div className="pp-topbar-program"><span>PROOFPAY</span><strong>Sponsor workspace</strong></div>
    <span className="pp-topbar-divider" />
    <div className="pp-topbar-context"><Icon name="shield" size={16} /><span>Testnet preview</span></div>
    <div className="pp-account"><span className="pp-profile-avatar">SP</span><div><strong>Sam Parker</strong><small>Program sponsor</small></div></div>
  </header>;
}

function Intro({ onInvite }) {
  return <section className="pp-intro" aria-labelledby="pp-page-title">
    <div className="pp-intro-copy">
      <span className="pp-eyebrow">RIVERSIDE SKILLS FUND <i /> COMMUNITY WORKSHOP</span>
      <h1 id="pp-page-title" tabIndex="-1">Program overview</h1>
      <p>Confirmed funding, evidence review, and award payment status.</p>
    </div>
    <div className="pp-intro-actions"><span className="pp-updated">Updated Nov 17, 2026</span><button className="pp-primary-button" type="button" onClick={onInvite}><span>+</span>Invite participants</button></div>
  </section>;
}

function FinancialOverview() {
  const progressStyle = { width: `${summary.fundingPercent}%` };
  const supportingMetrics = [
    { icon: 'people', label: 'Participants', value: summary.participants, note: 'In this program' },
    { icon: 'clock', label: 'Awaiting review', value: summary.awaitingReview, note: 'Submitted or in review' },
    { icon: 'check', label: 'Ready for payment', value: summary.readyForPayment, note: 'Release eligible' },
    { icon: 'activity', label: 'Payment status check', value: summary.paymentStatusChecks, note: 'Tessa Cruz · outcome unknown' },
  ];
  return <section className="pp-financial" id="financial-overview" tabIndex="-1" aria-labelledby="pp-funding-title">
    <article className="pp-funding-feature">
      <div className="pp-funding-topline"><span>PROGRAM FUNDING</span><span className="pp-testnet-pill">TESTNET XLM</span></div>
      <div className="pp-funding-title-row"><div><h2 id="pp-funding-title" tabIndex="-1">Confirmed cohort funding</h2><p>Funding supported by explicit preview evidence states.</p></div><span className="pp-funding-spark"><Icon name="layers" size={21} /></span></div>
      <div className="pp-funding-amount"><strong>{summary.committedAmount.toLocaleString()}</strong><span>XLM</span></div>
      <div className="pp-funding-bottom"><div className="pp-funding-progress-copy"><span>{summary.confirmedFunded} of {summary.participants} confirmed funded</span><strong>{summary.fundingPercent}%</strong></div><div className="pp-funding-meter" role="progressbar" aria-label="Confirmed funded awards in this cohort" aria-valuemin="0" aria-valuemax={summary.participants} aria-valuenow={summary.confirmedFunded} aria-valuetext={`${summary.confirmedFunded} of ${summary.participants} confirmed funded`}><span style={progressStyle} /></div><p className="pp-funding-disclosure">{summary.unverifiedFunding} funding records unverified <span>· synthetic fixture interpretation</span></p></div>
    </article>
    <div className="pp-metric-ledger" aria-label="Supporting program metrics">
      {supportingMetrics.map((item) => <article className="pp-metric-row" key={item.label}>
        <span className="pp-metric-icon"><Icon name={item.icon} size={18} /></span><div className="pp-metric-copy"><span>{item.label}</span><small>{item.note}</small></div><strong>{item.value}</strong>
      </article>)}
    </div>
  </section>;
}

function AttentionPanel({ onAction }) {
  const queue = [
    { id: 'award-mara-santos', reason: 'Approved award · confirmed funding' },
    { id: 'award-alex-chen', reason: 'Evidence submitted · verifier review pending' },
    { id: 'award-tessa-cruz', reason: 'Approved award · payment outcome unknown' },
  ].map(({ id, reason }) => ({ ...previewAwards.find((award) => award.id === id), reason }));

  return <section className="pp-panel pp-attention-panel" id="action-queue" aria-labelledby="pp-attention-title">
    <div className="pp-panel-heading"><div><span className="pp-section-kicker">ACTION QUEUE</span><h2 id="pp-attention-title">Next actions</h2></div><a href="#participants" className="pp-panel-link" onClick={() => window.setTimeout(() => document.querySelector('#participants h2')?.focus(), 0)}>View participant awards <Icon name="arrow" size={15} /></a></div>
    <div className="pp-attention-list">
      {queue.map((award) => {
        const action = award.paymentState === 'ready' ? 'Release payment' : award.paymentState === 'check' ? 'Check payment status' : 'Review evidence';
        return <article className="pp-attention-item" key={award.id}>
          <span className="pp-person-avatar">{award.initials}</span>
          <div className="pp-attention-main"><div className="pp-attention-person"><strong>{award.name}</strong><StatusBadge status={award.status} tone={award.tone} /></div><p>{award.reason}</p></div>
          <button className={`pp-attention-action ${award.paymentState === 'ready' ? 'pp-attention-action--primary' : ''}`} type="button" onClick={() => onAction(award)}>{action}{award.paymentState === 'ready' && <Icon name="arrow" size={14} />}</button>
        </article>;
      })}
    </div>
  </section>;
}

function ActivityPanel({ expanded, onToggle }) {
  const visibleActivities = expanded ? activities : activities.slice(0, 2);
  return <section className="pp-panel pp-activity-panel" id="activity" tabIndex="-1" aria-labelledby="pp-activity-title">
    <div className="pp-panel-heading"><div><span className="pp-section-kicker">LATEST UPDATES</span><h2 id="pp-activity-title" tabIndex="-1">Recent activity</h2></div><button className="pp-text-button" type="button" aria-expanded={expanded} onClick={onToggle}>{expanded ? 'Show fewer updates' : 'Show activity log'} <Icon name="arrow" size={15} /></button></div>
    <ol className="pp-activity-list">
      {visibleActivities.map((item) => <li className="pp-activity-item" key={item.title}>
        <span className={`pp-activity-icon pp-activity-icon--${item.tone}`}><Icon name={item.icon} size={16} /></span>
        <div className="pp-activity-copy"><strong>{item.title}</strong><span>{item.detail}</span><time>{item.time}</time></div>
      </li>)}
    </ol>
  </section>;
}

function AwardProgress() {
  const steps = ['Funded', 'Evidence submitted', 'Verifier approved', 'Payment confirmed'];
  return <section className="pp-lifecycle" aria-labelledby="pp-lifecycle-title">
    <div className="pp-lifecycle-heading"><h2 id="pp-lifecycle-title">Award lifecycle</h2><span>Typical individual award journey</span></div>
    <ol className="pp-lifecycle-steps" aria-label="Typical individual award lifecycle">
      {steps.map((step, index) => <li className="pp-lifecycle-step" key={step}>
        <div className="pp-step-line"><span>{index + 1}</span>{index < steps.length - 1 && <i />}</div><strong>{step}</strong>
      </li>)}
    </ol>
  </section>;
}

function ProgramTerms() {
  return <section className="pp-terms" id="program-terms" aria-labelledby="pp-terms-title">
    <div className="pp-terms-heading"><span className="pp-section-kicker">REFERENCE</span><h2 id="pp-terms-title">Program terms</h2><p>Key details for this training stipend.</p></div>
    <article className="pp-term-item"><span className="pp-term-icon"><Icon name="coins" size={18} /></span><div><strong>Fixed stipend</strong><p>20 Testnet XLM per participant</p></div></article>
    <article className="pp-term-item"><span className="pp-term-icon"><Icon name="people" size={18} /></span><div><strong>Program roles</strong><p><b>Participant</b> · Complete training and submit evidence</p><p><b>Verifier</b> · Review evidence and approve or reject</p><p><b>Sponsor</b> · Release payments for approved awards</p></div></article>
    <article className="pp-term-item"><span className="pp-term-icon"><Icon name="calendar" size={18} /></span><div><strong>Key deadlines</strong><ul><li><b>Claim</b> · Nov 20, 2026, 11:59 PM</li><li><b>Review</b> · Nov 24, 2026, 11:59 PM</li><li><b>Payout</b> · Dec 1, 2026, 11:59 PM</li></ul><small>Time zone unspecified.</small></div></article>
    <article className="pp-term-item"><span className="pp-term-icon"><Icon name="shield" size={18} /></span><div><strong>Refund policy</strong><p>The sponsor may reclaim unpaid funds after the payout cutoff.</p></div></article>
  </section>;
}

function PreviewApp() {
  const [toast, setToast] = useState(null);
  const [activityExpanded, setActivityExpanded] = useState(false);

  const showToast = (title, detail = '') => setToast({ title, detail });
  const handleQueueAction = (award) => {
    if (award.paymentState === 'ready' && award.fundingState === 'confirmed') {
      showToast('Payment release simulated', `${award.name} · ${award.amount} Testnet XLM. No funds moved.`);
    } else if (award.paymentState === 'check') {
      showToast('Payment status check opened', `${award.name} · this preview cannot query a payment network.`);
    } else {
      showToast('Evidence review opened', `${award.name} · no verifier decision was saved in this preview.`);
    }
  };
  const handleDemoAction = (action, award) => {
    if (action === 'export') {
      showToast('Demo export preview', `Previewing ${summary.participants} synthetic participant records. No file was downloaded.`);
    } else if (action === 'view-participant') {
      showToast('Participant details preview', `${award.name} · ${award.status} · ${award.next}`);
    } else {
      showToast('Demo update recorded', `${award.name} · this update is not saved to a program record.`);
    }
  };

  React.useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return <div className="pp-app-shell">
    <div className="pp-testnet-banner"><span aria-hidden="true">✳</span><strong>TESTNET XLM</strong><i />No real monetary value<span className="pp-banner-tag">DEMO ENVIRONMENT</span></div>
    <div className="pp-app-frame">
      <PreviewNavigation Icon={Icon} BrandMark={BrandMark} />
      <main className="pp-main" id="overview" tabIndex="-1">
        <Topbar />
        <div className="pp-content">
          <Intro onInvite={() => showToast('Demo invite prepared', 'Invitation details are ready for review. No message was sent.')} />
          <div className="pp-workspace" aria-label="Program overview and award operations">
            <FinancialOverview />
            <AttentionPanel onAction={handleQueueAction} />
            <PreviewParticipantTable awards={previewAwards} Icon={Icon} StatusBadge={StatusBadge} onDemoAction={handleDemoAction} />
            <ActivityPanel expanded={activityExpanded} onToggle={() => setActivityExpanded((current) => !current)} />
          </div>
          <AwardProgress />
          <ProgramTerms />
          <footer className="pp-page-footer"><span>PROOFPAY <b>/</b> RIVERSIDE SKILLS FUND</span><span>Community workshop · synthetic fixture data</span><a href="#overview" onClick={() => window.setTimeout(() => document.querySelector('#overview h1')?.focus(), 0)}>Back to top ↑</a></footer>
        </div>
      </main>
    </div>
    {toast && <div className="pp-toast" role="status" aria-live="polite"><span><Icon name="check" size={16} /></span><div><strong>{toast.title}</strong>{toast.detail && <small>{toast.detail}</small>}</div><button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)}><Icon name="close" size={17} /></button></div>}
  </div>;
}

export default PreviewApp;
