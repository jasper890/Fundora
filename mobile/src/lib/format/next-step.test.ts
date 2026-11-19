import type { Award } from '@/lib/api/schemas';

import { nextStep } from './next-step';

const member = (user_id: string, role: string) => ({ user_id, role, active: true, public_wallet: 'G' });
const base: Award = {
  id: 'a1',
  program_id: 'p1',
  recipient_username: 'r',
  status: 'FUNDED',
  last_confirmed_ledger: 10,
  sponsor_hold: false,
  verifier_hold: false,
  evidence_revision: 0,
  evidence_digest: '',
  verifier_sync_required: false,
  sponsor_member: member('s', 'SPONSOR'),
  verifier_member: member('v', 'VERIFIER'),
  recipient_member: member('r', 'RECIPIENT'),
  latest_evidence: null,
  unresolved_operation: false,
  my_roles: ['RECIPIENT'],
};

const deadlines = { claim: '2026-12-01T00:00:00Z', review: '2026-12-08T00:00:00Z', payout: '2026-12-15T00:00:00Z' };
const before = Date.parse('2026-11-20T00:00:00Z');
const at = (iso: string) => Date.parse(iso);

test('a funded recipient is asked for evidence until the submission deadline, inclusive', () => {
  const funded = { ...base, deadlines };
  expect(nextStep(funded, before)).toEqual({ text: 'Add completion evidence.', action: 'add-evidence' });
  expect(nextStep(funded, at(deadlines.claim)).action).toBe('add-evidence');
  expect(nextStep(funded, at(deadlines.claim) + 1)).toEqual({ text: 'The submission deadline has passed.', action: null });
  // An older server sends no deadlines: the phone offers the step and the server decides.
  expect(nextStep(base, before).action).toBe('add-evidence');
});

test('uploaded but unsigned evidence asks the recipient to sign, but not after the submission deadline', () => {
  const uploaded = { ...base, deadlines, latest_evidence: { revision: 1, digest: 'd1' } };
  expect(nextStep(uploaded, before)).toEqual({
    text: 'Review and sign your evidence submission.',
    action: 'sign',
    sign: 'SUBMIT',
  });
  expect(nextStep(uploaded, at(deadlines.claim) + 1).action).toBeNull();
});

test('holds and unsettled transactions win over the status; only the owner can act on an open one', () => {
  expect(nextStep({ ...base, verifier_hold: true }, before).text).toBe('Payment is blocked by a review hold.');
  expect(nextStep({ ...base, unresolved_operation: true, my_open_operation: true }, before).action).toBe('sign');
  expect(nextStep({ ...base, unresolved_operation: true, my_open_operation: false }, before)).toEqual({
    text: 'Outcome not confirmed. We are checking Stellar.',
    action: null,
  });
});

test('a change request sends the recipient back to evidence and takes the award out of the review queue', () => {
  const asked: Award = {
    ...base,
    deadlines,
    status: 'SUBMITTED',
    evidence_revision: 1,
    evidence_digest: 'd1',
    latest_evidence: { revision: 1, digest: 'd1' },
    changes_requested: true,
  };
  expect(nextStep(asked, before)).toEqual({
    text: 'Changes requested. Read the note, then add a new evidence revision.',
    action: 'add-evidence',
  });
  expect(nextStep(asked, at(deadlines.claim) + 1).action).toBeNull();
  expect(nextStep({ ...asked, my_roles: ['VERIFIER'] }, before).action).toBeNull();
  // A new revision clears the request on the server; the recipient then signs it.
  const revised = { ...asked, changes_requested: false, latest_evidence: { revision: 2, digest: 'd2' } };
  expect(nextStep(revised, before)).toMatchObject({ action: 'sign', sign: 'SUBMIT' });
});

test('an unconfirmed award never looks funded; a bigint ledger string counts as confirmed', () => {
  expect(nextStep({ ...base, last_confirmed_ledger: null }, before).action).toBeNull();
  expect(nextStep({ ...base, last_confirmed_ledger: '1000' }, before).action).toBe('add-evidence');
});

test('verifiers review until the review deadline; sponsors release payment until the payout deadline', () => {
  const submitted = {
    ...base,
    deadlines,
    status: 'SUBMITTED',
    evidence_revision: 1,
    evidence_digest: 'd1',
    latest_evidence: { revision: 1, digest: 'd1' },
  };
  const verifier: Award = { ...submitted, my_roles: ['VERIFIER'] };
  expect(nextStep(verifier, before).action).toBe('review');
  expect(nextStep(verifier, at(deadlines.review) + 1)).toEqual({ text: 'The review deadline has passed.', action: null });
  const approved: Award = { ...base, deadlines, status: 'APPROVED', my_roles: ['SPONSOR'] };
  expect(nextStep(approved, before)).toMatchObject({ action: 'sign', sign: 'PAY' });
  expect(nextStep(approved, at(deadlines.payout) + 1).action).toBe('web');
});
