import { formatDeadline, isPast, timeLeft } from './date';

test('formats a UTC deadline with a time zone label and flags bad input', () => {
  expect(formatDeadline('2026-12-01T09:30:00Z')).toMatch(/2026/);
  expect(formatDeadline('2026-12-01T09:30:00Z')).toMatch(/[A-Z]{2,}|GMT|UTC/);
  expect(formatDeadline('not a date')).toBe('Unknown date');
});

test('treats the exact deadline instant as past', () => {
  expect(isPast('2026-01-01T00:00:00Z', Date.parse('2026-01-01T00:00:00Z'))).toBe(true);
  expect(isPast('2026-01-01T00:00:01Z', Date.parse('2026-01-01T00:00:00Z'))).toBe(false);
});

test('describes time left in plain words', () => {
  const now = Date.parse('2026-11-19T12:00:00Z');
  expect(timeLeft('2026-11-26T12:00:00Z', now)).toBe('in 7 days');
  expect(timeLeft('2026-11-20T11:00:00Z', now)).toBe('in 23 hours');
  expect(timeLeft('2026-11-19T12:30:00Z', now)).toBe('in 1 hour');
  expect(timeLeft('2026-11-19T11:00:00Z', now)).toBe('passed');
});
