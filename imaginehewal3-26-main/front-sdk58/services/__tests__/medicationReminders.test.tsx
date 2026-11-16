import { planReminders } from '../medicationReminders';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('../native', () => ({ expoModulePresent: () => false, NATIVE_NAMES: { push: 'ExpoPushTokenManager' } }));

const meds = [{ id: 1, name: 'Amlodipine', dose: '5 mg', times: ['08:00', '20:00'] }, { id: 2, name: 'Metformin', times: ['13:30'] }];
const at = (h: number, m = 0) => { const d = new Date('2026-11-14T00:00:00'); d.setHours(h, m, 0, 0); return d; };

test('a reminder fires the chosen number of minutes before each dose', () => {
  const p = planReminders(meds, new Set(), 10, at(6), 1);
  expect(p.map((x) => new Date(x.at).getHours() * 60 + new Date(x.at).getMinutes())).toEqual([7 * 60 + 50, 13 * 60 + 20, 19 * 60 + 50]);
  expect(p[0].body).toContain('Amlodipine 5 mg');
  expect(p[0].title).toBe('Medicine in 10 minutes');
});

test('at the dose time means exactly then', () => {
  const p = planReminders(meds, new Set(), 0, at(6), 1);
  expect(new Date(p[0].at).getHours()).toBe(8);
  expect(p[0].title).toBe('Time for your medicine');
});

test('doses already taken today and times already past are skipped, but tomorrow still counts', () => {
  const p = planReminders(meds, new Set(['1|08:00']), 5, at(9), 2);
  const stamps = p.map((x) => new Date(x.at));
  expect(stamps.some((d) => d.getDate() === 14 && d.getHours() === 7)).toBe(false);          // taken, and past
  expect(stamps.some((d) => d.getDate() === 14 && d.getHours() === 13 && d.getMinutes() === 25)).toBe(true);
  expect(stamps.some((d) => d.getDate() === 15 && d.getHours() === 7 && d.getMinutes() === 55)).toBe(true);   // tomorrow's 08:00 dose is not "taken"
});

test('never more than the cap, soonest first', () => {
  const many = [{ id: 9, name: 'X', times: ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'] }];
  const p = planReminders(many, new Set(), 5, at(0), 30, 60);
  expect(p).toHaveLength(60);
  expect(p[0].at).toBeLessThan(p[59].at);
});
