// Component options only: ECMA-402 forbids combining dateStyle/timeStyle with timeZoneName.
const formatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});

/** Deadlines are stored in UTC; show them in device time with the zone labelled. */
export function formatDeadline(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : formatter.format(date);
}

export function isPast(iso: string, now = Date.now()): boolean {
  return new Date(iso).getTime() <= now;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "in 3 days", "in 5 hours", "passed" — so nobody has to do date maths. */
export function timeLeft(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (Number.isNaN(ms)) return '';
  if (ms <= 0) return 'passed';
  if (ms < DAY_MS) {
    const hours = Math.max(1, Math.round(ms / 3_600_000));
    return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const days = Math.floor(ms / DAY_MS);
  return `in ${days} day${days === 1 ? '' : 's'}`;
}
