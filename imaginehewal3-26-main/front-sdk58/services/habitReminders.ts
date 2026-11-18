/**
 * Adaptive habit reminders. The server decides WHEN (it learns from the person's own check-ins, avoids quiet hours and prayer time, slows down
 * and finally pauses if reminders are ignored: see back/app/services/reminder_plan.py). This file only turns that plan into local notifications
 * on the phone, so they arrive on time with the app closed, with no internet and with no push credentials.
 *
 * The text is generic on purpose: nothing about health appears on a lock screen.
 */
import { expoModulePresent, NATIVE_NAMES } from './native';

export type HabitReminderPlan = { enabled: boolean; time: string | null; fire_dates: string[]; frequency: string };

/** Pure: the moments (ms since epoch) a plan should fire, future only, at most `cap`. */
export function planHabitFires(plan: HabitReminderPlan, now: Date = new Date(), cap = 14): number[] {
  if (!plan.enabled || !plan.time) return [];
  const [h, m] = plan.time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return [];
  const out: number[] = [];
  for (const iso of plan.fire_dates || []) {
    const [y, mo, d] = iso.split('-').map(Number);
    const at = new Date(y, (mo || 1) - 1, d || 1, h, m, 0, 0).getTime();
    if (at > now.getTime() + 5_000) out.push(at);
  }
  return out.sort((a, b) => a - b).slice(0, cap);
}

let N: typeof import('expo-notifications') | null | undefined;
const lib = () => {
  if (N === undefined) { try { N = expoModulePresent(NATIVE_NAMES.push) ? require('expo-notifications') : null; } catch { N = null; } }
  return N;
};
export const habitRemindersAvailable = () => !!lib();

/** Replaces every scheduled habit reminder with the plan's. `ask` may raise the permission prompt (only after the person's own action). */
export async function applyHabitReminders(plan: HabitReminderPlan, text: { title: string; body: string }, opts: { ask?: boolean } = {}): Promise<'scheduled' | 'off' | 'denied' | 'unavailable'> {
  const n = lib();
  if (!n) return 'unavailable';
  try {
    const existing = await n.getAllScheduledNotificationsAsync();
    await Promise.all(existing.filter((x) => (x.content.data as any)?.type === 'habit').map((x) => n.cancelScheduledNotificationAsync(x.identifier)));
    const fires = planHabitFires(plan);
    if (!fires.length) return 'off';
    let status = (await n.getPermissionsAsync()).status;
    if (status !== 'granted' && opts.ask) status = (await n.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';
    for (const at of fires) {
      await n.scheduleNotificationAsync({
        content: { title: text.title, body: text.body, sound: 'default', data: { type: 'habit' } },
        trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId: 'reminders' } as any,
      });
    }
    return 'scheduled';
  } catch {
    return 'unavailable';
  }
}
