// Статистика: усе обчислюється з реальних записів. Порожні дані → порожні стани в UI.
import type { AppData, Category } from './types';
import { addDays, rangeDays, weekday } from './dates';
import { occurrencesOn, taskDur } from './recur';
import { dayScore, focusMinutesOn, habitScheduled, localKey, type ScoreCtx } from './score';

export const toCtx = (d: AppData): ScoreCtx => ({
  tasks: d.tasks, habits: d.habits, sessions: d.sessions,
  days: Object.fromEntries(d.days.map((x) => [x.date, x])),
  settings: d.settings, everFocused: d.sessions.length > 0,
});

export interface DayStat {
  date: string; planned: number; done: number; focus: number; score: number | null;
  moves: number; habitsPlanned: number; habitsDone: number; minutesDone: number;
}

export const dayStats = (days: string[], d: AppData, ctx = toCtx(d)): DayStat[] => {
  const moveCount: Record<string, number> = {};
  for (const t of d.tasks) for (const m of t.moves) { const k = localKey(m.at); moveCount[k] = (moveCount[k] || 0) + 1; }
  return days.map((k) => {
    const occ = occurrencesOn(d.tasks, k, d.settings.defaultDuration);
    const hs = d.habits.filter((h) => habitScheduled(h, k));
    return {
      date: k, planned: occ.length, done: occ.filter((o) => o.done).length,
      focus: focusMinutesOn(d.sessions, k), score: dayScore(k, ctx).score,
      moves: moveCount[k] || 0, habitsPlanned: hs.length, habitsDone: hs.filter((h) => h.log[k]).length,
      minutesDone: occ.filter((o) => o.done).reduce((a, o) => a + o.dur, 0),
    };
  });
};

export interface Summary {
  planned: number; done: number; avgCompletion: number | null; focusTotal: number; avgScore: number | null;
  bestDay: DayStat | null; moves: number; habitRate: number | null; activeDays: number; sessions: number;
}

export const summarize = (st: DayStat[], d: AppData, range: [string, string]): Summary => {
  const withPlan = st.filter((s) => s.planned > 0);
  const scored = st.filter((s) => s.score != null);
  const hp = st.reduce((a, s) => a + s.habitsPlanned, 0), hd = st.reduce((a, s) => a + s.habitsDone, 0);
  const best = scored.length ? scored.reduce((a, b) => ((b.score as number) > (a.score as number) ? b : a)) : null;
  return {
    planned: st.reduce((a, s) => a + s.planned, 0), done: st.reduce((a, s) => a + s.done, 0),
    avgCompletion: withPlan.length ? Math.round((withPlan.reduce((a, s) => a + s.done / s.planned, 0) / withPlan.length) * 100) : null,
    focusTotal: st.reduce((a, s) => a + s.focus, 0),
    avgScore: scored.length ? Math.round(scored.reduce((a, s) => a + (s.score as number), 0) / scored.length) : null,
    bestDay: best, moves: st.reduce((a, s) => a + s.moves, 0),
    habitRate: hp ? Math.round((hd / hp) * 100) : null,
    activeDays: st.filter((s) => s.done > 0 || s.focus > 0).length,
    sessions: d.sessions.filter((s) => { const k = localKey(s.start); return k >= range[0] && k <= range[1]; }).length,
  };
};

export const categoryBreakdown = (days: string[], d: AppData) => {
  const m = new Map<string, { id: string; done: number; minutes: number }>();
  for (const k of days) for (const o of occurrencesOn(d.tasks, k, d.settings.defaultDuration)) {
    if (!o.done) continue;
    const e = m.get(o.task.categoryId) || { id: o.task.categoryId, done: 0, minutes: 0 };
    e.done++; e.minutes += taskDur(o.task, d.settings.defaultDuration); m.set(o.task.categoryId, e);
  }
  return [...m.values()].sort((a, b) => b.done - a.done);
};

export const weekdayProductivity = (st: DayStat[]) => {
  const acc = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
  for (const s of st) if (s.score != null) { const w = weekday(s.date); acc[w].sum += s.score; acc[w].n++; }
  return acc.map((a, i) => ({ weekday: i, avg: a.n ? Math.round(a.sum / a.n) : null, n: a.n }));
};

export const catName = (c: Category | undefined) => c?.name ?? '—';

export const firstDataDate = (d: AppData): string | null => {
  const c: string[] = [];
  for (const t of d.tasks) { if (t.date) c.push(t.date); c.push(localKey(t.createdAt)); }
  for (const h of d.habits) c.push(localKey(h.createdAt));
  for (const s of d.sessions) c.push(localKey(s.start));
  return c.length ? c.sort()[0] : null;
};

export const lastDays = (n: number, end: string) => rangeDays(addDays(end, -(n - 1)), end);
