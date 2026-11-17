export const participants = [
  { name: 'Mara Santos', initials: 'MS', amount: 20, status: 'Approved', next: 'Release payment', updated: 'Nov 17, 2026 · 2:14 PM', sortTime: 202611171414, tone: 'green' },
  { name: 'Alex Chen', initials: 'AC', amount: 20, status: 'Submitted', next: 'Awaiting verifier review', updated: 'Nov 17, 2026 · 11:03 AM', sortTime: 202611171103, tone: 'blue' },
  { name: 'Tessa Cruz', initials: 'TC', amount: 20, status: 'Approved', next: 'Check payment status', updated: 'Nov 16, 2026 · 5:49 PM', sortTime: 202611161749, tone: 'green' },
  { name: 'Daniel Ortiz', initials: 'DO', amount: 20, status: 'Paid', next: 'No further action', updated: 'Nov 16, 2026 · 4:27 PM', sortTime: 202611161627, tone: 'green' },
  { name: 'Jules Kim', initials: 'JK', amount: 20, status: 'Funded', next: 'Submit evidence by Nov 24', updated: 'Nov 15, 2026 · 9:18 AM', sortTime: 202611150918, tone: 'blue' },
  { name: 'Priya Nair', initials: 'PN', amount: 20, status: 'Funded', next: 'Submit training evidence', updated: 'Nov 14, 2026 · 1:42 PM', sortTime: 202611141342, tone: 'blue' },
  { name: 'Noah Williams', initials: 'NW', amount: 20, status: 'Submitted', next: 'Awaiting verifier review', updated: 'Nov 14, 2026 · 10:26 AM', sortTime: 202611141026, tone: 'blue' },
  { name: 'Sofia Reyes', initials: 'SR', amount: 20, status: 'In review', next: 'Verifier decision due Nov 24', updated: 'Nov 13, 2026 · 3:08 PM', sortTime: 202611131508, tone: 'amber' },
  { name: 'Ethan Park', initials: 'EP', amount: 20, status: 'Funded', next: 'Submit training evidence', updated: 'Nov 12, 2026 · 8:51 AM', sortTime: 202611120851, tone: 'blue' },
  { name: 'Amara Johnson', initials: 'AJ', amount: 20, status: 'Funded', next: 'Submit training evidence', updated: 'Nov 11, 2026 · 4:35 PM', sortTime: 202611111635, tone: 'blue' },
];

export const activities = [
  { icon: 'check', title: 'Award approved for Mara Santos', detail: 'Awaiting sponsor release.', time: 'Today, 2:14 PM', tone: 'success' },
  { icon: 'file', title: 'Evidence submitted by Alex Chen', detail: 'Training evidence uploaded for review.', time: 'Today, 11:03 AM', tone: 'neutral' },
  { icon: 'check', title: 'Payment confirmed for Daniel Ortiz', detail: '20 Testnet XLM distributed.', time: 'Yesterday, 4:27 PM', tone: 'success' },
];

export const attentionItems = [
  { name: 'Mara Santos', detail: 'Award · 20 Testnet XLM', status: 'Approved', note: 'Awaiting sponsor release', action: 'Release payment', type: 'primary' },
  { name: 'Alex Chen', detail: 'Award · 20 Testnet XLM', status: 'Submitted', note: 'Awaiting verifier', action: 'Review evidence', type: 'text' },
  { name: 'Tessa Cruz', detail: 'Award · 20 Testnet XLM', status: 'Status check', note: 'Payment outcome unknown', action: 'Check status', type: 'link' },
];

export const navItems = [
  { label: 'Overview', icon: 'home' },
  { label: 'Programs', icon: 'layers' },
  { label: 'Awards', icon: 'award' },
  { label: 'Activity', icon: 'activity' },
  { label: 'Settings', icon: 'settings' },
];
