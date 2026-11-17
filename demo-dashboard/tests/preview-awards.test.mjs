import test from 'node:test';
import assert from 'node:assert/strict';
import { previewAwards, summarizeAwards } from '../src/preview-awards.js';

test('the demo summary distinguishes confirmed funding and payment eligibility', () => {
  assert.deepEqual(summarizeAwards(previewAwards), {
    participants: 10,
    confirmedFunded: 7,
    unverifiedFunding: 3,
    committedAmount: 140,
    fundingPercent: 70,
    awaitingReview: 3,
    readyForPayment: 1,
    paymentStatusChecks: 1,
  });
  assert.equal(previewAwards.find(({ name }) => name === 'Tessa Cruz').paymentState, 'check');
});

test('an empty roster has zero counts and zero confirmed funding progress', () => {
  assert.deepEqual(summarizeAwards([]), {
    participants: 0,
    confirmedFunded: 0,
    unverifiedFunding: 0,
    committedAmount: 0,
    fundingPercent: 0,
    awaitingReview: 0,
    readyForPayment: 0,
    paymentStatusChecks: 0,
  });
});

test('submitted evidence can have confirmed funding independently of workflow status', () => {
  const submittedAward = {
    status: 'Submitted',
    amount: 20,
    fundingState: 'confirmed',
    paymentState: 'not-ready',
  };

  const summary = summarizeAwards([submittedAward]);

  assert.equal(summary.confirmedFunded, 1);
  assert.equal(summary.committedAmount, 20);
  assert.equal(summary.fundingPercent, 100);
  assert.equal(summary.awaitingReview, 1);
  assert.equal(summary.readyForPayment, 0);
});

test('an unknown funding state does not add its award amount to confirmed XLM', () => {
  const summary = summarizeAwards([{
    status: 'Funded',
    amount: 20,
    fundingState: 'unknown',
    paymentState: 'not-ready',
  }]);

  assert.equal(summary.confirmedFunded, 0);
  assert.equal(summary.committedAmount, 0);
});

test('an approved award with a payment status check is not ready for release', () => {
  const tessa = previewAwards.find(({ name }) => name === 'Tessa Cruz');
  const summary = summarizeAwards([tessa]);

  assert.equal(tessa.status, 'Approved');
  assert.equal(tessa.paymentState, 'check');
  assert.equal(summary.readyForPayment, 0);
  assert.equal(summary.paymentStatusChecks, 1);
});
