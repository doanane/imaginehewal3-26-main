import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'hewal3_offline_vitals_v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type QueuedVital = {
  capturedAt: string;
  payload: Record<string, unknown>;
};

async function readQueue(): Promise<QueuedVital[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const now = Date.now();
    return (JSON.parse(raw) as QueuedVital[]).filter((item) => now - Date.parse(item.capturedAt) <= MAX_AGE_MS);
  } catch {
    await AsyncStorage.removeItem(KEY);
    return [];
  }
}

async function writeQueue(queue: QueuedVital[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(queue));
}

export async function queueVital(payload: Record<string, unknown>): Promise<void> {
  const queue = await readQueue();
  queue.push({ capturedAt: new Date().toISOString(), payload });
  await writeQueue(queue);
}

export async function flushVitalQueue(
  send: (payload: Record<string, unknown>) => Promise<unknown>,
): Promise<number> {
  const queue = await readQueue();
  let flushed = 0;
  const remaining: QueuedVital[] = [];
  for (const item of queue) {
    try {
      await send(item.payload);
      flushed += 1;
    } catch {
      remaining.push(item);
    }
  }
  await writeQueue(remaining);
  return flushed;
}

export async function getQueuedVitalCount(): Promise<number> {
  return (await readQueue()).length;
}
