// My Day Score 0–100 і серії. Усе рахується з реальних даних.
import type { DayInfo, FocusSession, Habit, Settings, Task } from './types';
import { addDays, diffDays, rangeDays, todayKey, tsOf, weekday, toMin } from './dates';
import { doneTs, occurrencesOn } from './recur';

export interface ScorePart { key: string; label: string; weight: number; value: number | null; detail: string }
export interface DayScore { score: number | null; parts: ScorePart[]; applicable: number }

export interface ScoreCtx {
  tasks: Task[]; habits: Habit[]; sessions: FocusSession[]; days: Record<string, DayInfo>;
  settings: Pick<Settings, 'focusGoalMin' | 'defaultDuration'>;
  everFocused?: boolean;
}

export const habitScheduled = (h: Habit, k: string) => !h.archived && h.days.includes(weekday(k)) && k >= localKey(h.createdAt);
const localKey = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export const focusMinutesOn = (sessions: FocusSession[], k: string) =>
  Math.round(sessions.filter((s) => localKey(s.start) === k).reduce((a, s) => a + s.minutes, 0));

export const FORMULA = 'Оцінка = Σ(вага × виконання) ÷ Σ(ваг), лише для складових, що застосовні в цей день';

export const dayScore = (k: string, c: ScoreCtx): DayScore => {
  const today = todayKey();
  const occs = occurrencesOn(c.tasks, k, c.settings.defaultDuration);
  const parts: ScorePart[] = [];

  // 1. Виконані завдання (40)
  const planned = occs.length;
  const done = occs.filter((o) => o.done).length;
  parts.push({ key: 'tasks', label: 'Виконані завдання', weight: 40, value: planned ? done / planned : null, detail: planned ? `${done} з ${planned}` : 'немає завдань на день' });

  // 2. Головні цілі дня (20)
  const info = c.days[k];
  const top = (info?.top ?? []).filter((id) => occs.some((o) => o.task.id === id) || c.tasks.some((t) => t.id === id));
  const topDone = top.filter((id) => { const t = c.tasks.find((x) => x.id === id); return t ? (t.repeat === 'none' ? t.doneAt != null : !!t.doneDates[k]) : false; }).length;
  parts.push({ key: 'top', label: 'Головні цілі дня', weight: 20, value: top.length ? topDone / top.length : null, detail: top.length ? `${topDone} з ${top.length}` : 'цілі дня не обрано' });

  // 3. Дотримання розкладу (15) — завдання з часом, виконані до кінця + 30 хв
  const dueTimed = occs.filter((o) => o.start && (o.done || k < today || (k === today && o.start && toMin(o.start) + o.dur + 30 < nowMinOf())));
  let credit = 0;
  for (const o of dueTimed) {
    if (!o.done) continue;
    const ts = doneTs(o.task, k);
    const endTs = tsOf(k, '00:00') + (toMin(o.start!) + o.dur + 30) * 60000;
    credit += ts != null && ts <= endTs ? 1 : 0.5;
  }
  parts.push({ key: 'schedule', label: 'Дотримання розкладу', weight: 15, value: dueTimed.length ? credit / dueTimed.length : null, detail: dueTimed.length ? `${Math.round(credit * 10) / 10} з ${dueTimed.length} вчасно` : 'немає завдань із часом' });

  // 4. Focus Timer (15) — лише для тих, хто користується таймером
  const fm = focusMinutesOn(c.sessions, k);
  const ever = c.everFocused ?? c.sessions.length > 0;
  parts.push({ key: 'focus', label: 'Фокус-таймер', weight: 15, value: ever && c.settings.focusGoalMin > 0 && k <= today ? Math.min(1, fm / c.settings.focusGoalMin) : null, detail: ever ? `${fm} з ${c.settings.focusGoalMin} хв` : 'ще не використовувався' });

  // 5. Звички (10)
  const hs = c.habits.filter((h) => habitScheduled(h, k));
  const hd = hs.filter((h) => h.log[k]).length;
  parts.push({ key: 'habits', label: 'Звички', weight: 10, value: hs.length ? hd / hs.length : null, detail: hs.length ? `${hd} з ${hs.length}` : 'немає звичок на день' });

  const use = parts.filter((p) => p.value != null);
  if (!use.length || k > today) return { score: null, parts, applicable: 0 };
  const sw = use.reduce((a, p) => a + p.weight, 0);
  const sum = use.reduce((a, p) => a + p.weight * (p.value as number), 0);
  return { score: Math.round((sum / sw) * 100), parts, applicable: use.length };
};

const nowMinOf = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

export const PRODUCTIVE_AT = 50;

export interface Streaks { current: number; best: number; productive: Set<string>; todayDone: boolean; graceUsed: boolean }

/** Серія продуктивних днів із «м’якою» відмовою: один пропуск на 7 днів не обнуляє серію. */
export const computeStreaks = (c: ScoreCtx, firstDate: string | null, today = todayKey()): Streaks => {
  const productive = new Set<string>();
  if (!firstDate) return { current: 0, best: 0, productive, todayDone: false, graceUsed: false };
  const days = rangeDays(firstDate, today);
  const flags: boolean[] = days.map((d) => {
    const s = dayScore(d, c).score;
    const ok = s != null && s >= PRODUCTIVE_AT;
    if (ok) productive.add(d);
    return ok;
  });
  // best (з тим же правилом поблажки)
  let best = 0, cur = 0, lastGrace = -99;
  for (let i = 0; i < days.length; i++) {
    if (flags[i]) cur++;
    else if (days[i] === today) { /* сьогодні ще не закінчився */ }
    else if (i - lastGrace > 6 && cur > 0) { lastGrace = i; }
    else cur = 0;
    best = Math.max(best, cur);
  }
  // поточна: йдемо назад від сьогодні (сьогодні не рахується пропуском)
  let current = 0, graceUsed = false, lastMiss = 99;
  for (let i = days.length - 1; i >= 0; i--) {
    if (flags[i]) { current++; lastMiss++; continue; }
    if (days[i] === today) continue;
    if (!graceUsed && lastMiss > 6) { graceUsed = true; lastMiss = 0; continue; }
    break;
  }
  return { current, best: Math.max(best, current), productive, todayDone: flags[flags.length - 1] ?? false, graceUsed };
};

export const habitStreak = (h: Habit, today = todayKey()) => {
  const created = localKey(h.createdAt);
  let cur = 0, best = 0, run = 0;
  const span = Math.min(400, Math.max(1, diffDays(created, today) + 1));
  for (let i = span - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    if (!h.days.includes(weekday(d))) continue;
    if (h.log[d]) { run++; best = Math.max(best, run); }
    else if (d !== today) run = 0;
  }
  // поточна серія — від сьогодні/учора назад
  let i = h.log[today] ? 0 : 1;
  for (; i < span; i++) {
    const d = addDays(today, -i);
    if (!h.days.includes(weekday(d))) continue;
    if (h.log[d]) cur++; else break;
  }
  return { current: cur, best };
};

export { localKey };
