import { planHabitFires } from '../habitReminders';
jest.mock('../native', () => ({ expoModulePresent: () => false, NATIVE_NAMES: { push: 'ExpoPushTokenManager' } }));

const plan = (over: Partial<Parameters<typeof planHabitFires>[0]> = {}) => ({ enabled: true, time: '18:30', frequency: 'daily', fire_dates: ['2026-09-15', '2026-09-16', '2026-09-17'], ...over });

describe('habit reminder schedule', () => {
  const now = new Date(2026, 8, 15, 12, 0, 0);
  it('fires at the planned time on each planned day, in order, future only', () => {
    const f = planHabitFires(plan(), now);
    expect(f.length).toBe(3);
    expect(new Date(f[0]).getHours()).toBe(18);
    expect(new Date(f[0]).getMinutes()).toBe(30);
    expect(f).toEqual([...f].sort((a, b) => a - b));
    expect(planHabitFires(plan(), new Date(2026, 8, 15, 19, 0, 0)).length).toBe(2);        // today's time has passed
  });
  it('schedules nothing when the plan is off, paused or has no time', () => {
    expect(planHabitFires(plan({ enabled: false }), now)).toEqual([]);
    expect(planHabitFires(plan({ time: null }), now)).toEqual([]);
    expect(planHabitFires(plan({ fire_dates: [] }), now)).toEqual([]);
  });
  it('never schedules more than the cap', () => {
    const dates = Array.from({ length: 30 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
    expect(planHabitFires(plan({ fire_dates: dates }), now, 14).length).toBe(14);
  });
});
