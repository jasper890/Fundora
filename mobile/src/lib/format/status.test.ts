import { awardStatus } from './status';

test('maps documented states and refuses to guess unknown ones', () => {
  expect(awardStatus('PAID')).toEqual({ label: 'Paid', tone: 'success' });
  expect(awardStatus('PAID_MAYBE')).toEqual({ label: 'Unknown — refresh', tone: 'warning' });
});
