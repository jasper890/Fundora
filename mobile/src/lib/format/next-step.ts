import type { Award } from '@/lib/api/schemas';

/** What the primary button on an award does. */
export type NextAction = 'add-evidence' | 'web' | 'review' | 'sign' | null;

/** `sign` is the chain action the phone wallet signs; absent on a `sign` step means "resume the open one". */
export type NextStep = { text: string; action: NextAction; sign?: 'SUBMIT' | 'PAY' };

type Role = Award['my_roles'][number];

// Same precedence as web/lib/presentation.ts roleFor.
export function primaryRole(award: Award): Role | null {
  return (['SPONSOR', 'VERIFIER', 'RECIPIENT'] as const).find((r) => award.my_roles.includes(r)) ?? null;
}

function hasUnsignedEvidence(award: Award): boolean {
  const latest = award.latest_evidence;
  if (latest === null) return false;
  if (award.verifier_sync_required || !award.last_confirmed_ledger) return true;
  return !(
    award.evidence_revision === latest.revision &&
    award.evidence_digest === latest.digest &&
    ['SUBMITTED', 'APPROVED', 'REJECTED', 'PAID', 'REFUNDED'].includes(award.status)
  );
}

// Missing deadlines (older server) count as open; the server re-checks every deadline anyway.
const before = (deadline: string | undefined, now: number) => !deadline || now <= new Date(deadline).getTime();

/** Same order and states as the website's nextStep, plus which button the phone offers for it. */
export function nextStep(award: Award, now = Date.now()): NextStep {
  const role = primaryRole(award);
  const status = award.status;
  const claimOpen = before(award.deadlines?.claim, now);

  if (!award.last_confirmed_ledger) {
    if (role === 'SPONSOR') return { text: 'Review award deployment on the web.', action: 'web' };
    return { text: 'Waiting for the sponsor to fund this award on Testnet.', action: null };
  }
  if (award.sponsor_hold || award.verifier_hold) {
    if (role === 'SPONSOR' || role === 'VERIFIER') {
      return { text: 'Review the hold on the web. Payment stays blocked until it is cleared.', action: 'web' };
    }
    return { text: 'Payment is blocked by a review hold.', action: null };
  }
  if (award.unresolved_operation) {
    // Only the member who opened the transaction can check or finish it.
    return award.my_open_operation
      ? { text: 'Your transaction is not confirmed yet. Check it before starting another.', action: 'sign' }
      : { text: 'Outcome not confirmed. We are checking Stellar.', action: null };
  }
  if (status === 'CREATED') {
    if (role === 'SPONSOR') return { text: 'Review funding on the web. Signing is not confirmation.', action: 'web' };
    return { text: 'Waiting for the sponsor to fund this award.', action: null };
  }
  if ((status === 'FUNDED' || status === 'SUBMITTED') && hasUnsignedEvidence(award)) {
    if (role !== 'RECIPIENT') return { text: 'Waiting for the recipient to sign the submission.', action: null };
    return claimOpen
      ? { text: 'Review and sign your evidence submission.', action: 'sign', sign: 'SUBMIT' }
      : { text: 'The submission deadline has passed.', action: null };
  }
  if (status === 'FUNDED') {
    if (role !== 'RECIPIENT') return { text: 'Waiting for the recipient to add completion evidence.', action: null };
    return claimOpen
      ? { text: 'Add completion evidence.', action: 'add-evidence' }
      : { text: 'The submission deadline has passed.', action: null };
  }
  if (status === 'SUBMITTED' && award.changes_requested) {
    if (role === 'VERIFIER') return { text: 'You requested changes. Waiting for a new evidence revision.', action: null };
    if (role !== 'RECIPIENT') {
      return { text: 'The verifier requested changes. Waiting for a new evidence revision.', action: null };
    }
    return claimOpen
      ? { text: 'Changes requested. Read the note, then add a new evidence revision.', action: 'add-evidence' }
      : { text: 'Changes were requested, but the submission deadline has passed.', action: null };
  }
  if (status === 'SUBMITTED') {
    if (role !== 'VERIFIER') return { text: 'Waiting for verifier review.', action: null };
    return before(award.deadlines?.review, now)
      ? { text: 'Check the original source, then approve or request changes.', action: 'review' }
      : { text: 'The review deadline has passed.', action: null };
  }
  if (status === 'APPROVED') {
    if (role !== 'SPONSOR') return { text: 'Approved. Waiting for the sponsor to release payment.', action: null };
    return before(award.deadlines?.payout, now)
      ? { text: 'Review and sign the payment release. Signing is not confirmation.', action: 'sign', sign: 'PAY' }
      : { text: 'The payout deadline has passed. You can reclaim the unpaid award on the web.', action: 'web' };
  }
  if (status === 'REJECTED') {
    if (role === 'RECIPIENT') return { text: 'Rejected. You can ask for a review of the decision.', action: null };
    if (role === 'VERIFIER') return { text: 'Rejection is recorded. You can reopen it on the web.', action: 'web' };
    return { text: 'The verifier rejected this submission.', action: null };
  }
  if (status === 'PAID') return { text: "Paid to the recipient's wallet on Testnet. Not a bank receipt.", action: null };
  if (status === 'REFUNDED') return { text: 'Unpaid funds were returned to the sponsor.', action: null };
  if (status === 'CANCELLED') return { text: 'This award was cancelled before funding.', action: null };
  return { text: 'Refresh to see the current status.', action: null };
}
