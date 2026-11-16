/**
 * Medicine reminders. The phone itself schedules them (local notifications), so they arrive on time even when the app is closed, with no
 * internet and with no push credentials. The person chooses how early: at the dose time, or 5, 10, 15 or 30 minutes before.
 *
 * What is scheduled: every dose of every active medicine for today and the next two days, minus doses already marked taken or skipped,
 * and never more than 60 (iPhone keeps at most 64). The plan is rebuilt whenever medicines change, a dose is logged, the app opens
 * or returns to the foreground, so it never drifts from what is on the server.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { expoModulePresent, NATIVE_NAMES } from './native';

export type ReminderMed = { id: number; name: string; dose?: string | null; times: string[] };
export type Planned = { at: number; title: string; body: string; medicationId: number };
export type ReminderSettings = { enabled: boolean; leadMin: number };

export const LEAD_CHOICES = [0, 5, 10, 15, 30] as const;
const KEY = 'hewal3.medicineReminders';
const DEFAULTS: ReminderSettings = { enabled: true, leadMin: 5 };

export async function getReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    if (v && typeof v.enabled === 'boolean' && typeof v.leadMin === 'number') return { enabled: v.enabled, leadMin: v.leadMin };
  } catch { /* fall through to the defaults */ }
  return DEFAULTS;
}
export async function saveReminderSettings(s: ReminderSettings): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(s)); } catch { /* the choice lasts until the app closes */ }
}

const clock = (t: string) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };

/** Pure: which notifications should exist, in time order. `taken` holds "medicineId|HH:MM" for today's doses already dealt with. */
export function planReminders(meds: ReminderMed[], taken: Set<string>, leadMin: number, now: Date = new Date(), days = 3, cap = 60): Planned[] {
  const out: Planned[] = [];
  for (let d = 0; d < days; d++) {
    for (const m of meds) {
      for (const t of m.times || []) {
        const [h, min] = t.split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(min)) continue;
        const due = new Date(now); due.setDate(due.getDate() + d); due.setHours(h, min, 0, 0);
        if (d === 0 && taken.has(`${m.id}|${t}`)) continue;
        const fire = due.getTime() - leadMin * 60_000;
        if (fire <= now.getTime() + 5_000) continue;
        const what = `${m.name}${m.dose ? ` ${m.dose}` : ''}`;
        out.push({
          at: fire, medicationId: m.id,
          title: leadMin > 0 ? `Medicine in ${leadMin} minutes` : 'Time for your medicine',
          body: leadMin > 0 ? `${what} is due at ${clock(t)}.` : `Take ${what} now (${clock(t)}).`,
        });
      }
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, cap);
}

let N: typeof import('expo-notifications') | null | undefined;
const lib = () => {
  if (N === undefined) { try { N = expoModulePresent(NATIVE_NAMES.push) ? require('expo-notifications') : null; } catch { N = null; } }
  return N;
};
export const remindersAvailable = () => !!lib();

/** Replaces every scheduled medicine reminder with a fresh plan. `ask` lets this raise the permission prompt (only when the person turned reminders on). */
export async function applyMedicineReminders(meds: ReminderMed[], taken: Set<string>, opts: { ask?: boolean } = {}): Promise<'scheduled' | 'off' | 'denied' | 'unavailable'> {
  const n = lib();
  if (!n) return 'unavailable';
  try {
    const existing = await n.getAllScheduledNotificationsAsync();
    await Promise.all(existing.filter((x) => (x.content.data as any)?.type === 'medicine').map((x) => n.cancelScheduledNotificationAsync(x.identifier)));
    const settings = await getReminderSettings();
    if (!settings.enabled) return 'off';
    let status = (await n.getPermissionsAsync()).status;
    if (status !== 'granted' && opts.ask) status = (await n.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';
    for (const p of planReminders(meds, taken, settings.leadMin)) {
      await n.scheduleNotificationAsync({
        content: { title: p.title, body: p.body, sound: 'default', data: { type: 'medicine', medication_id: p.medicationId } },
        trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: new Date(p.at), channelId: 'reminders' } as any,
      });
    }
    return 'scheduled';
  } catch {
    return 'unavailable';
  }
}

/** Reads today's doses and the medicine list from the server and rebuilds the reminders. Used when the app opens and when a dose is logged. */
export async function refreshMedicineReminders(opts: { ask?: boolean } = {}): Promise<'scheduled' | 'off' | 'denied' | 'unavailable'> {
  if (!remindersAvailable()) return 'unavailable';
  try {
    const api = (await import('./api')).default;
    const [today, meds] = await Promise.all([api.getMedicationsToday(), api.getMedications()]);
    const done = new Set<string>((today.doses || []).filter((d: any) => d.status === 'taken' || d.status === 'skipped').map((d: any) => `${d.medication_id}|${d.time}`));
    return await applyMedicineReminders(meds as ReminderMed[], done, opts);
  } catch {
    return 'unavailable';
  }
}
