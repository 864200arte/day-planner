import { describe, expect, it } from 'vitest';
import { blankTask, DEFAULT_SETTINGS } from '../src/lib/defaults';
import { findConflicts, occurrencesOn, occursOn, isOverdue } from '../src/lib/recur';
import { autoSchedule, energyProfile, freeSlots, priorityScore } from '../src/lib/planner';
import { computeStreaks, dayScore, habitStreak } from '../src/lib/score';
import { validateBackup, mergeInto } from '../src/lib/backup';
import { buildDue } from '../src/lib/reminders';
import type { AppData, Habit } from '../src/lib/types';
import { toMin, tsOf, addDays, todayKey, diffDays } from '../src/lib/dates';

const T = (o: Partial<ReturnType<typeof blankTask>>) => blankTask({ id: Math.random().toString(36).slice(2), title: 't', ...o });

describe('повторення', () => {
  it('щодня/щотижня/будні/щомісяця', () => {
    const d = T({ date: '2026-11-02', repeat: 'daily' });
    expect(occursOn(d, '2026-11-01')).toBe(false);
    expect(occursOn(d, '2026-11-05')).toBe(true);
    const w = T({ date: '2026-11-02', repeat: 'weekly' }); // понеділок
    expect(occursOn(w, '2026-11-09')).toBe(true);
    expect(occursOn(w, '2026-11-10')).toBe(false);
    const wd = T({ date: '2026-11-02', repeat: 'weekdays' });
    expect(occursOn(wd, '2026-11-07')).toBe(false); // субота
    expect(occursOn(wd, '2026-11-09')).toBe(true);
    const m = T({ date: '2026-01-15', repeat: 'monthly' });
    expect(occursOn(m, '2026-03-15')).toBe(true);
    expect(occursOn(m, '2026-03-16')).toBe(false);
  });
  it('винятки та дата завершення', () => {
    const d = T({ date: '2026-11-02', repeat: 'daily', exceptions: ['2026-11-04'], repeatUntil: '2026-11-06' });
    expect(occursOn(d, '2026-11-04')).toBe(false);
    expect(occursOn(d, '2026-11-07')).toBe(false);
  });
  it('конфлікти розкладу', () => {
    const a = T({ date: '2026-11-18', start: '10:00', end: '11:00' });
    const b = T({ date: '2026-11-18', start: '10:30', end: '11:30' });
    const c = T({ date: '2026-11-18', start: '12:00', end: '13:00' });
    const occ = occurrencesOn([a, b, c], '2026-11-18');
    const cf = findConflicts(occ);
    expect(cf).toHaveLength(1);
    expect([cf[0][0].task.id, cf[0][1].task.id].sort()).toEqual([a.id, b.id].sort());
  });
  it('прострочення', () => {
    const t = T({ date: '2026-11-17' });
    expect(isOverdue(t, '2026-11-18', 600)).toBe(true);
    expect(isOverdue({ ...t, doneAt: 1 }, '2026-11-18', 600)).toBe(false);
    const today = T({ date: '2026-11-18', start: '09:00', end: '10:00' });
    expect(isOverdue(today, '2026-11-18', 11 * 60)).toBe(true);
    expect(isOverdue(today, '2026-11-18', 9 * 60 + 30)).toBe(false);
  });
});

describe('Smart Planner', () => {
  const settings = { workStart: '09:00', workEnd: '18:00', bufferMin: 10, defaultDuration: 30 };
  const energy = energyProfile([], false).hours;

  it('вільні проміжки', () => {
    expect(freeSlots([{ start: 600, end: 660 }], 540, 720)).toEqual([{ start: 540, end: 600 }, { start: 660, end: 720 }]);
  });
  it('не накладається на наявні події, лишає буфер і резерв', () => {
    const meeting = T({ date: '2026-12-01', start: '10:00', end: '12:00' });
    const existing = occurrencesOn([meeting], '2026-12-01');
    const cands = [
      T({ title: 'Звіт', estimate: 120, priority: 3, date: '2026-12-01' }),
      T({ title: 'Пошта', estimate: 30, priority: 1, date: '2026-12-01' }),
      T({ title: 'Дрібниця', estimate: 15, date: '2026-12-01' }),
    ];
    const r = autoSchedule({ date: '2026-12-01', today: '2026-11-18', candidates: cands, existing, settings, energy });
    expect(r.items.length).toBe(3);
    for (const it of r.items) {
      expect(it.start >= toMin('09:00') && it.end <= toMin('18:00')).toBe(true);
      const overlapsMeeting = it.start < toMin('12:10') && it.end > toMin('10:00');
      expect(overlapsMeeting).toBe(false); // буфер 10 хв після зустрічі
    }
    for (let i = 1; i < r.items.length; i++) expect(r.items[i].start).toBeGreaterThanOrEqual(r.items[i - 1].end + 10);
    expect(r.reserveMinutes).toBeGreaterThan(0);
  });
  it('високий пріоритет потрапляє на пік енергії (до обіду)', () => {
    const r = autoSchedule({ date: '2026-12-01', today: '2026-11-18', candidates: [T({ title: 'Важлива', estimate: 60, priority: 3 })], existing: [], settings, energy });
    expect(r.items[0].start).toBeGreaterThanOrEqual(toMin('09:00'));
    expect(r.items[0].start).toBeLessThan(toMin('12:00'));
  });
  it('перевантаження → частину не розміщує і попереджає', () => {
    const cands = Array.from({ length: 6 }, (_, i) => T({ title: 'Завдання ' + i, estimate: 120, priority: 2 }));
    const r = autoSchedule({ date: '2026-12-01', today: '2026-11-18', candidates: cands, existing: [], settings, energy });
    expect(r.unplaced.length).toBeGreaterThan(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it('сьогодні не планує в минуле', () => {
    const now = new Date(2026, 10, 18, 14, 0);
    const r = autoSchedule({ date: '2026-11-18', today: '2026-11-18', now, candidates: [T({ estimate: 30, priority: 3 })], existing: [], settings, energy });
    expect(r.items[0].start).toBeGreaterThanOrEqual(14 * 60);
  });
  it('пояснення пріоритету', () => {
    const p = priorityScore(T({ priority: 3, important: true, movedCount: 2, date: '2026-11-16' }), '2026-11-18', '2026-11-16');
    expect(p.score).toBeGreaterThan(80);
    expect(p.reasons.length).toBeGreaterThan(2);
  });
});

const ctxOf = (tasks: any[], habits: Habit[] = [], sessions: any[] = [], days: any = {}) => ({ tasks, habits, sessions, days, settings: { focusGoalMin: 90, defaultDuration: 30 } });

describe('My Day Score', () => {
  const d = '2026-11-10';
  it('порожній день → немає оцінки, не вигадує числа', () => {
    expect(dayScore(d, ctxOf([])).score).toBeNull();
  });
  it('усі завдання виконано → 100; половина → 50', () => {
    const a = T({ date: d, doneAt: 1 }), b = T({ date: d, doneAt: 1 });
    expect(dayScore(d, ctxOf([a, b])).score).toBe(100);
    const c = T({ date: d, doneAt: null });
    expect(dayScore(d, ctxOf([a, c])).score).toBe(50);
  });
  it('зважує складові та перенормовує за застосовними', () => {
    const a = T({ date: d, doneAt: 1 }), b = T({ date: d });
    const days = { [d]: { id: d, date: d, top: [a.id, b.id], rating: null, results: '', startedAt: null, finishedAt: null, updatedAt: 0 } };
    // завдання 1/2 (вага 40) + цілі 1/2 (вага 20) → 50
    expect(dayScore(d, ctxOf([a, b], [], [], days)).score).toBe(50);
  });
  it('фокус враховується лише якщо таймером користувались', () => {
    const a = T({ date: d, doneAt: 1 });
    const noFocus = dayScore(d, ctxOf([a]));
    expect(noFocus.parts.find((p) => p.key === 'focus')!.value).toBeNull();
    const s = { id: 's', taskId: null, start: new Date(2026, 10, 10, 10).getTime(), minutes: 45, planned: 45, mode: '', completed: true, updatedAt: 0 };
    const withFocus = dayScore(d, ctxOf([a], [], [s]));
    expect(withFocus.parts.find((p) => p.key === 'focus')!.value).toBeCloseTo(0.5);
    expect(withFocus.score).toBe(Math.round(((40 * 1 + 15 * 0.5) / 55) * 100));
  });
});

describe('серії', () => {
  it('поточна серія, щадне правило (1 пропуск / 7 днів)', () => {
    const today = '2026-11-18';
    const tasks = [] as any[];
    // продуктивні: 12,13,14, (пропуск 15), 16,17 → серія 5 з поблажкою
    for (const k of ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-16', '2026-11-17']) tasks.push(T({ date: k, doneAt: 1 }));
    tasks.push(T({ date: '2026-11-15' })); // невиконане
    const s = computeStreaks(ctxOf(tasks), '2026-11-12', today);
    expect(s.current).toBe(5);
    expect(s.productive.has('2026-11-15')).toBe(false);
  });
  it('два пропуски поспіль обнуляють', () => {
    const today = '2026-11-18';
    const tasks = [T({ date: '2026-11-13', doneAt: 1 }), T({ date: '2026-11-14' }), T({ date: '2026-11-15' }), T({ date: '2026-11-16' }), T({ date: '2026-11-17', doneAt: 1 })];
    const s = computeStreaks(ctxOf(tasks), '2026-11-13', today);
    expect(s.current).toBe(1);
  });
  it('серія звички враховує лише активні дні', () => {
    const today = todayKey();
    const log: Record<string, number> = {};
    for (let i = 0; i < 4; i++) log[addDays(today, -i)] = 1;
    const h: Habit = { id: 'h', name: 'x', emoji: '', color: '', days: [0, 1, 2, 3, 4, 5, 6], log, createdAt: new Date(addDays(today, -10) + 'T12:00:00').getTime(), updatedAt: 0 };
    expect(habitStreak(h, today).current).toBe(4);
    expect(diffDays(today, today)).toBe(0);
  });
});

describe('нагадування', () => {
  const data = (tasks: any[]): AppData => ({
    tasks, categories: [], habits: [], goals: [], journal: [], sessions: [], energy: [], templates: [], countdowns: [], days: [],
    settings: { ...DEFAULT_SETTINGS, morningEnabled: false, eveningEnabled: false }, achievements: {},
  });
  it('нагадування за 15 і 5 хв + прострочення', () => {
    const t = T({ date: '2026-11-18', start: '15:00', end: '16:00', remind: [15, 5] });
    const from = tsOf('2026-11-18', '00:00'), to = tsOf('2026-11-19', '00:00');
    const due = buildDue(data([t]), from, to);
    expect(due.map((x) => x.kind)).toEqual(['task', 'task', 'overdue']);
    expect(due[0]!.at).toBe(tsOf('2026-11-18', '14:45'));
    expect(due[1]!.at).toBe(tsOf('2026-11-18', '14:55'));
    expect(due[2]!.at).toBe(tsOf('2026-11-18', '16:05'));
  });
  it('виконані не нагадують', () => {
    const t = T({ date: '2026-11-18', start: '15:00', end: '16:00', remind: [10], doneAt: 5 });
    expect(buildDue(data([t]), tsOf('2026-11-18', '00:00'), tsOf('2026-11-19', '00:00'))).toHaveLength(0);
  });
});

describe('резервні копії', () => {
  it('відхиляє чуже та пошкоджене, пропускає биті записи', () => {
    expect(validateBackup({ app: 'other' }).ok).toBe(false);
    expect(validateBackup(null).ok).toBe(false);
    const v = validateBackup({ app: 'day-planner', format: 1, data: { tasks: [{ id: 'a', title: 'ok' }, { id: 5 }, null] } });
    expect(v.ok).toBe(true);
    expect(v.counts.tasks).toBe(1);
    expect(v.dropped).toBe(2);
    expect(validateBackup({ app: 'day-planner', format: 99, data: {} }).ok).toBe(false);
    expect(validateBackup({ app: 'day-planner', format: 1, data: { tasks: 'x' } }).ok).toBe(false);
  });
  it('merge: перемагає новіший updatedAt', () => {
    const cur = { tasks: [{ id: '1', title: 'старе', updatedAt: 1 }, { id: '2', title: 'лише тут', updatedAt: 1 }], categories: [], habits: [], goals: [], journal: [], sessions: [], energy: [], templates: [], countdowns: [], days: [], settings: DEFAULT_SETTINGS, achievements: {} } as any;
    const m = mergeInto(cur, { tasks: [{ id: '1', title: 'нове', updatedAt: 5 } as any, { id: '3', title: 'нове 3', updatedAt: 1 } as any] });
    expect(m.tasks.find((t: any) => t.id === '1')!.title).toBe('нове');
    expect(m.tasks).toHaveLength(3);
  });
});
