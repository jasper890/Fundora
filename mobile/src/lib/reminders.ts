import * as Notifications from 'expo-notifications';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local, on-device reminder one day before a deadline. No push token or server involved. */
export async function remindBefore(
  awardId: string,
  kind: string,
  title: string,
  deadlineIso: string,
): Promise<Date> {
  const at = new Date(new Date(deadlineIso).getTime() - DAY_MS);
  if (at.getTime() <= Date.now()) throw new Error('This deadline is less than a day away. Check the award now.');
  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) throw new Error('Allow notifications in Settings to get reminders.');
  // Same identifier replaces an earlier reminder instead of stacking duplicates.
  await Notifications.scheduleNotificationAsync({
    identifier: `${awardId}-${kind}`,
    content: { title, body: 'The deadline is in 24 hours.', data: { url: `/awards/${awardId}` } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
  return at;
}
