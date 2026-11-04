import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'daily-lucky';
export const REMINDER_HOUR = 8;
export const REMINDER_MINUTE = 0;
const DAYS_AHEAD = 14; // one-off reminders scheduled ahead; refilled every time the app opens

export type ReminderContent = { title: string; body: string };

/** Builds the notification text for the reminder that fires at `date`. */
export type ReminderBuilder = (date: Date) => ReminderContent;

export type ReminderResult =
  | { ok: true }
  | { ok: false; reason: 'denied' }
  | { ok: false; reason: 'error'; message: string };

// Show the notification even when the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Creates our Android channel and returns its id.
 * Every field is set explicitly because Expo Go on some Android versions throws a
 * NullPointerException when optional fields are left out. If it still fails,
 * we return undefined and notifications use Expo Go's default channel instead.
 */
let channelReady: string | undefined;
async function ensureChannel(): Promise<string | undefined> {
  if (Platform.OS !== 'android') return undefined;
  if (channelReady) return channelReady;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Daily lucky numbers',
      description: 'Morning reminder with your lucky numbers for tonight',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D6402B',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
      enableLights: true,
      showBadge: false,
      bypassDnd: false,
    });
    channelReady = CHANNEL_ID;
    return CHANNEL_ID;
  } catch (e) {
    console.warn('[reminder] Custom channel failed, using default channel:', e);
    return undefined;
  }
}

// Adds channelId to a trigger only when we have a working channel
function withChannel<T extends object>(trigger: T, channelId?: string): T {
  return channelId ? { ...trigger, channelId } : trigger;
}

export async function requestPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

async function hasPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  return current.granted;
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

// Next N occurrences of 8:00 AM device-local time, starting today if it's still before 8.
function nextReminderDates(count: number): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  const first = new Date(now);
  first.setHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0);
  if (first.getTime() <= now.getTime()) first.setDate(first.getDate() + 1);
  for (let i = 0; i < count; i++) {
    const d = new Date(first);
    d.setDate(first.getDate() + i);
    dates.push(d);
  }
  return dates;
}

// Each day gets its own one-off notification, so each can carry that day's numbers.
async function scheduleAll(build: ReminderBuilder, channelId?: string) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const date of nextReminderDates(DAYS_AHEAD)) {
    const { title, body } = build(date);
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: withChannel(
        {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
        } as Notifications.DateTriggerInput,
        channelId,
      ),
    });
  }
}

/** Turns reminders on: asks for permission, then schedules the next 14 mornings. */
export async function enableReminders(build: ReminderBuilder): Promise<ReminderResult> {
  try {
    const granted = await requestPermission();
    if (!granted) return { ok: false, reason: 'denied' };
    const channelId = await ensureChannel();
    await scheduleAll(build, channelId);
    return { ok: true };
  } catch (e) {
    console.warn('[reminder] Could not schedule reminders:', e);
    return { ok: false, reason: 'error', message: errorMessage(e) };
  }
}

/**
 * Re-schedules the next 14 mornings with fresh numbers. Call this when the app
 * opens, when the day changes, and after "Draw again" or a name change.
 * Never shows a permission prompt.
 */
export async function refreshReminders(build: ReminderBuilder): Promise<void> {
  try {
    if (!(await hasPermission())) return;
    const channelId = await ensureChannel();
    await scheduleAll(build, channelId);
  } catch (e) {
    console.warn('[reminder] Refresh failed:', e);
  }
}

export async function disableReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Sends a notification 5 seconds from now. Lock the phone to see it. */
export async function sendTestNotification(content: ReminderContent): Promise<ReminderResult> {
  try {
    const granted = await requestPermission();
    if (!granted) return { ok: false, reason: 'denied' };
    const channelId = await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: { ...content, sound: 'default' },
      trigger: withChannel(
        {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 5,
        } as Notifications.TimeIntervalTriggerInput,
        channelId,
      ),
    });
    return { ok: true };
  } catch (e) {
    console.warn('[reminder] Test notification failed:', e);
    return { ok: false, reason: 'error', message: errorMessage(e) };
  }
}