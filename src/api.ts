import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type Connection = { url: string; key: string };
export type Payload = Record<string, unknown>;
type Operation = { id: string; path: string; method: string; body?: Payload };

export class RequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function loadConnection(): Promise<Connection | null> {
  if (Platform.OS === 'web') {
    const value = await AsyncStorage.getItem('quest.connection');
    return value ? JSON.parse(value) as Connection : null;
  }
  const value = await SecureStore.getItemAsync('quest.connection');
  return value ? JSON.parse(value) as Connection : null;
}

export async function saveConnection(connection: Connection) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem('quest.connection', JSON.stringify(connection));
    return;
  }
  await SecureStore.setItemAsync('quest.connection', JSON.stringify(connection), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
  });
}

export async function api<T>(connection: Connection, path: string, method = 'GET', body?: Payload | File, id?: string): Promise<T> {
  const blob = body instanceof File;
  let response: Response;
  try {
    response = await expoFetch(connection.url + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + connection.key,
        ...(body ? { 'Content-Type': blob ? (body.type || 'image/jpeg') : 'application/json' } : {}),
        ...(id ? { 'Idempotency-Key': id } : {}),
      },
      body: blob ? body : body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout?.(22000),
    });
  } catch {
    throw new RequestError('Could not reach your server. Check your connection and try again.', 0);
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new RequestError(data?.message ?? data?.hint ?? 'That change could not be saved.', response.status);
  return data as T;
}

let pending = Promise.resolve();
const queueKey = (connection: Connection) => 'quest.queue:' + connection.url;

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const result = pending.then(work);
  pending = result.then(() => {}, () => {});
  return result;
}

async function drain(connection: Connection, queue: Operation[]) {
  const rejected: string[] = [];
  while (queue.length) {
    const operation = queue[0];
    try {
      await api(connection, operation.path, operation.method, operation.body, operation.id);
    } catch (error) {
      if (!(error instanceof RequestError) || error.status === 0 || error.status === 401 || error.status >= 500) throw error;
      rejected.push(error.message);
    }
    queue.shift();
    await AsyncStorage.setItem(queueKey(connection), JSON.stringify(queue));
  }
  return rejected;
}

async function readQueue(connection: Connection): Promise<Operation[]> {
  return JSON.parse(await AsyncStorage.getItem(queueKey(connection)) ?? '[]');
}

export function flush(connection: Connection) {
  return serialize(async () => drain(connection, await readQueue(connection)));
}

export function enqueue(connection: Connection, path: string, method: string, body?: Payload) {
  return serialize(async () => {
    const queue = await readQueue(connection);
    queue.push({ id: Crypto.randomUUID(), path, method, body });
    await AsyncStorage.setItem(queueKey(connection), JSON.stringify(queue));
    try {
      const rejected = await drain(connection, queue);
      return rejected[0] ?? 'Saved';
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) throw error;
      return 'Saved on this device. It will sync when the server is available.';
    }
  });
}
