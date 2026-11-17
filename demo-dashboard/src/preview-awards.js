import { participants } from './data.js';

const awardIdByParticipantName = {
  'Mara Santos': 'award-mara-santos',
  'Alex Chen': 'award-alex-chen',
  'Tessa Cruz': 'award-tessa-cruz',
  'Daniel Ortiz': 'award-daniel-ortiz',
  'Jules Kim': 'award-jules-kim',
  'Priya Nair': 'award-priya-nair',
  'Noah Williams': 'award-noah-williams',
  'Sofia Reyes': 'award-sofia-reyes',
  'Ethan Park': 'award-ethan-park',
  'Amara Johnson': 'award-amara-johnson',
};

const previewFundingAndPaymentById = {
  'award-mara-santos': { fundingState: 'confirmed', paymentState: 'ready' },
  'award-alex-chen': { fundingState: 'unverified', paymentState: 'not-ready' },
  'award-tessa-cruz': { fundingState: 'confirmed', paymentState: 'check' },
  'award-daniel-ortiz': { fundingState: 'confirmed', paymentState: 'paid' },
  'award-jules-kim': { fundingState: 'confirmed', paymentState: 'not-ready' },
  'award-priya-nair': { fundingState: 'confirmed', paymentState: 'not-ready' },
  'award-noah-williams': { fundingState: 'unverified', paymentState: 'not-ready' },
  'award-sofia-reyes': { fundingState: 'unverified', paymentState: 'not-ready' },
  'award-ethan-park': { fundingState: 'confirmed', paymentState: 'not-ready' },
  'award-amara-johnson': { fundingState: 'confirmed', paymentState: 'not-ready' },
};

export const previewAwards = participants.map((participant) => {
  const id = awardIdByParticipantName[participant.name];
  const states = previewFundingAndPaymentById[id];

  if (!id || !states) {
    throw new Error(`Missing preview award state for ${participant.name}`);
  }

  return { ...participant, id, ...states };
});

const reviewStatuses = new Set(['Submitted', 'In review']);

export function summarizeAwards(awards) {
  const confirmedAwards = awards.filter(({ fundingState }) => fundingState === 'confirmed');
  const participants = awards.length;
  const confirmedFunded = confirmedAwards.length;

  return {
    participants,
    confirmedFunded,
    unverifiedFunding: awards.filter(({ fundingState }) => fundingState === 'unverified').length,
    committedAmount: confirmedAwards.reduce((total, { amount }) => total + amount, 0),
    fundingPercent: participants ? Math.round((confirmedFunded / participants) * 100) : 0,
    awaitingReview: awards.filter(({ status }) => reviewStatuses.has(status)).length,
    readyForPayment: awards.filter(({ paymentState }) => paymentState === 'ready').length,
    paymentStatusChecks: awards.filter(({ paymentState }) => paymentState === 'check').length,
  };
}
