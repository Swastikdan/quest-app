import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import type { Day } from './types';

export type ReminderMode = 'notification' | 'alarm';

export type Reminder = {
  id: string;
  key: string;
  title: string;
  body: string;
  time: string;
  actions: Array<[string, string]>;
  mode: ReminderMode;
  enabled: boolean;
  date: string | null;
  custom: boolean;
};

const CONFIG_KEY = 'quest.reminders.v2';
const CUSTOM_KEY = 'quest.reminders.custom';
const LEGACY_ENABLED_KEY = 'quest.reminders';

export const defaultReminders: Reminder[] = [
  { id: 'wake-start', key: 'wake', title: 'Morning', body: 'Up already? Check in whenever you’re moving.', time: '06:45', actions: [['wake', 'I’m up']], mode: 'notification', enabled: false, date: null, custom: false },
  { id: 'wake-end', key: 'wake', title: '45 min left to check in', body: 'Still time for your wake quest, or log a late start.', time: '09:15', actions: [['wake', 'Check in'], ['late', 'Late start']], mode: 'notification', enabled: false, date: null, custom: false },
  { id: 'breakfast', key: 'breakfast', title: 'Breakfast check', body: 'Home food, or skip it. No penalty either way.', time: '08:15', actions: [['breakfast', 'Log breakfast']], mode: 'notification', enabled: false, date: null, custom: false },
  { id: 'lunch', key: 'lunch', title: 'Lunch check', body: 'A photo or a quick description is enough.', time: '13:15', actions: [['lunch', 'Log lunch']], mode: 'notification', enabled: false, date: null, custom: false },
  { id: 'move', key: 'gym', title: 'Evening movement', body: 'Gym tonight, or is today a 20-min walk kind of day?', time: '18:30', actions: [['gym', 'Going'], ['walk', 'Swap to walk']], mode: 'notification', enabled: false, date: null, custom: false },
  { id: 'dinner', key: 'dinner', title: 'Dinner check', body: 'Home food keeps the day green. Skipping is free.', time: '19:45', actions: [['dinner', 'Log dinner']], mode: 'notification', enabled: false, date: null, custom: false },
  { id: 'sleep', key: 'sleep', title: 'Time to wind down', body: 'Put the phone down within 50 min to lock in tonight’s sleep.', time: '22:10', actions: [['sleep', 'Turning in']], mode: 'notification', enabled: false, date: null, custom: false }
];

export const reminders = defaultReminders;

type Config = Partial<Pick<Reminder, 'enabled' | 'mode' | 'time' | 'date' | 'title' | 'body'>>;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

export async function loadReminders(): Promise<Reminder[]> {
  const [configs, customs, legacy] = await Promise.all([
    readJson<Record<string, Config>>(CONFIG_KEY, {}),
    readJson<Reminder[]>(CUSTOM_KEY, []),
    readJson<Record<string, boolean>>(LEGACY_ENABLED_KEY, {})
  ]);
  const merged = defaultReminders.map((reminder) => {
    const config = configs[reminder.id] ?? {};
    return {
      ...reminder,
      enabled: config.enabled ?? legacy[reminder.id] ?? reminder.enabled,
      mode: config.mode ?? reminder.mode,
      time: config.time ?? reminder.time,
      date: config.date ?? reminder.date,
      title: config.title ?? reminder.title,
      body: config.body ?? reminder.body
    };
  });
  return [...merged, ...customs.map((item) => ({ ...item, custom: true }))];
}

export async function updateReminder(id: string, patch: Config): Promise<void> {
  const configs = await readJson<Record<string, Config>>(CONFIG_KEY, {});
  configs[id] = { ...configs[id], ...patch };
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(configs));
}

export async function addCustomReminder(input: {
  title: string;
  body: string;
  time: string;
  date: string | null;
  mode: ReminderMode;
}): Promise<void> {
  const customs = await readJson<Reminder[]>(CUSTOM_KEY, []);
  const reminder: Reminder = {
    id: `custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
    key: '',
    title: input.title,
    body: input.body,
    time: input.time,
    actions: [],
    mode: input.mode,
    enabled: true,
    date: input.date,
    custom: true
  };
  await AsyncStorage.setItem(CUSTOM_KEY, JSON.stringify([...customs, reminder]));
}

export async function deleteCustomReminder(id: string): Promise<void> {
  const customs = await readJson<Reminder[]>(CUSTOM_KEY, []);
  await AsyncStorage.setItem(CUSTOM_KEY, JSON.stringify(customs.filter((item) => item.id !== id)));
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: notification.request.content.data?.mode === 'alarm',
    shouldSetBadge: false
  })
});

function wallTime(date: string, time: string, timezone: string) {
  const desired = Date.parse(date + 'T' + time + ':00Z');
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  let instant = desired;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
    instant += desired - Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`);
  }
  return new Date(instant);
}

function addDays(date: string, n: number) {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d) + n * 86_400_000);
  return next.toISOString().slice(0, 10);
}

async function ensureChannels() {
  await Notifications.setNotificationChannelAsync('quest', {
    name: 'Quest reminders',
    importance: Notifications.AndroidImportance.DEFAULT
  });
  await Notifications.setNotificationChannelAsync('quest-alarm', {
    name: 'Quest alarms',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'alarm.wav',
    vibrationPattern: [0, 400, 250, 400],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
  });
}

let scheduling = Promise.resolve();

export function syncReminders(day: Day) {
  const operation = scheduling.then(async () => {
    await ensureChannels();
    const current = await Notifications.getAllScheduledNotificationsAsync();
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    const list = await loadReminders();
    const tomorrow = addDays(day.date, 1);
    const retained = new Set<string>();

    for (const reminder of list) {
      if (!reminder.enabled) continue;
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(reminder.time)) continue;
      const dates = reminder.date ? [reminder.date] : [day.date, tomorrow];
      for (const dayId of dates) {
        const date = wallTime(dayId, reminder.time, day.timezone);
        if (date.getTime() <= Date.now()) continue;
        const isToday = dayId === day.date;
        if (isToday && reminder.key) {
          const quest = day.quests.find((item) => item.key === reminder.key);
          if (!quest) continue;
          if (!['open', 'later'].includes(quest.state)) continue;
          if (date.getTime() >= Date.parse(quest.closes_at)) continue;
        }
        const id = `quest-${reminder.id}:${dayId}`;
        const slot = date.toISOString();
        retained.add(id);
        const category = reminder.actions.length ? `quest-${reminder.id}` : undefined;
        const existing = current.find((entry) => entry.identifier === id);
        if (existing?.content.data?.slot === slot &&
            existing.content.body === reminder.body &&
            existing.content.data?.mode === reminder.mode) {
          continue;
        }
        if (existing) await Notifications.cancelScheduledNotificationAsync(id);
        if (category) {
          await Notifications.setNotificationCategoryAsync(
            category,
            reminder.actions.map(([identifier, buttonTitle]) => ({ identifier, buttonTitle }))
          );
        }
        const alarm = reminder.mode === 'alarm';
        await Notifications.scheduleNotificationAsync({
          identifier: id,
          content: {
            title: reminder.title,
            body: reminder.body,
            categoryIdentifier: category,
            sound: alarm ? 'alarm.wav' : undefined,
            priority: alarm
              ? Notifications.AndroidNotificationPriority.MAX
              : Notifications.AndroidNotificationPriority.DEFAULT,
            data: { slot, reminder: reminder.id, date: dayId, mode: reminder.mode }
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date,
            channelId: alarm ? 'quest-alarm' : 'quest'
          }
        });
      }
    }

    for (const existing of current) {
      if (existing.identifier.startsWith('quest-') && !retained.has(existing.identifier)) {
        await Notifications.cancelScheduledNotificationAsync(existing.identifier);
      }
    }
  });
  scheduling = operation.catch(() => {});
  return operation;
}
