export type Tone = 'neutral' | 'progress' | 'success' | 'warning' | 'danger';

const STATUS: Record<string, { label: string; tone: Tone }> = {
  CREATED: { label: 'Created', tone: 'neutral' },
  FUNDED: { label: 'Funded', tone: 'progress' },
  SUBMITTED: { label: 'Submitted for review', tone: 'progress' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  PAID: { label: 'Paid', tone: 'success' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

/** Documented award states only; anything else is shown as unknown, never guessed (A8). */
export function awardStatus(status: string): { label: string; tone: Tone } {
  return STATUS[status] ?? { label: 'Unknown — refresh', tone: 'warning' };
}
