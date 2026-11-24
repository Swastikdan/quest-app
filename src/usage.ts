import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueue, type Connection } from './api';

type UsageEvent = { kind: 'android_usage' | 'android_lock'; time: number };
export const usage = Platform.OS === 'android' ? requireOptionalNativeModule<{
  hasAccess(): Promise<boolean>;
  openSettings(): Promise<void>;
  read(from: number, to: number): Promise<UsageEvent[] | null>;
}>('QuestUsage') : null;

export async function syncUsage(connection: Connection, device: string) {
  if (!usage || !await usage.hasAccess()) {
    await AsyncStorage.removeItem('quest.usage.cursor');
    return;
  }
  if (await AsyncStorage.getItem('quest.usage.enabled') !== 'yes') return;
  const to = Date.now() - 1000;
  const cursor = Number(await AsyncStorage.getItem('quest.usage.cursor'));
  const from = Math.max(cursor || to - 5 * 60_000, to - 48 * 3_600_000);
  if (from >= to) return;
  const evidence = await usage.read(from, to);
  if (!evidence) return;
  for (let index = 0; index < evidence.length; index += 150) {
    const result = await enqueue(connection, '/api/activity', 'POST', {
      device_id: device,
      events: evidence.slice(index, index + 150).map(event => ({
        event_id: `${device}:${event.kind}:${event.time}`, kind: event.kind, occurred_at: new Date(event.time).toISOString(),
      })),
    });
    if (!result.startsWith('Saved')) throw new Error(result);
  }
  const result = await enqueue(connection, '/api/activity', 'POST', {
    device_id: device, events: [], coverage: { from: new Date(from).toISOString(), to: new Date(to).toISOString() },
  });
  if (!result.startsWith('Saved')) throw new Error(result);
  await AsyncStorage.setItem('quest.usage.cursor', String(to));
}
