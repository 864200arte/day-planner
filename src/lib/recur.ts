import type { Occ, Task } from './types';
import { parseKey, toMin, weekday } from './dates';

export const occursOn = (t: Task, k: string): boolean => {
  if (t.repeat === 'none') return t.date === k;
  if (!t.date || k < t.date) return false;
  if (t.repeatUntil && k > t.repeatUntil) return false;
  if (t.exceptions.includes(k)) return false;
  switch (t.repeat) {
    case 'daily': return true;
    case 'weekdays': return weekday(k) < 5;
    case 'weekly': return weekday(k) === weekday(t.date);
    case 'monthly': return parseKey(k).getDate() === parseKey(t.date).getDate();
  }
  return false;
};

export const isDoneOn = (t: Task, k: string) => (t.repeat === 'none' ? t.doneAt != null : !!t.doneDates[k]);
export const doneTs = (t: Task, k: string): number | null => (t.repeat === 'none' ? t.doneAt : t.doneDates[k] ?? null);

export const taskDur = (t: Task, fallback = 30) => {
  if (t.start && t.end) return Math.max(5, toMin(t.end) - toMin(t.start));
  return t.estimate ?? fallback;
};

export const toOcc = (t: Task, date: string, fallback = 30): Occ => ({
  task: t, date, done: isDoneOn(t, date), start: t.start, end: t.end ?? (t.start ? null : null), dur: taskDur(t, fallback),
});

/** Усі входження завдань на день (повторювані — віртуально) */
export const occurrencesOn = (tasks: Task[], k: string, fallback = 30): Occ[] => {
  const out: Occ[] = [];
  for (const t of tasks) if (occursOn(t, k)) out.push(toOcc(t, k, fallback));
  return out.sort(cmpOcc);
};

export const cmpOcc = (a: Occ, b: Occ) => {
  const sa = a.start ? toMin(a.start) : 9999, sb = b.start ? toMin(b.start) : 9999;
  if (sa !== sb) return sa - sb;
  return b.task.priority - a.task.priority || a.task.createdAt - b.task.createdAt;
};

export const occEndMin = (o: Occ) => (o.start ? toMin(o.start) + o.dur : null);

/** Пари подій, що накладаються за часом */
export const findConflicts = (occs: Occ[]): [Occ, Occ][] => {
  const timed = occs.filter((o) => o.start && !o.done).sort(cmpOcc);
  const out: [Occ, Occ][] = [];
  for (let i = 0; i < timed.length; i++) {
    const a = timed[i]; const ae = toMin(a.start!) + a.dur;
    for (let j = i + 1; j < timed.length; j++) {
      const b = timed[j];
      if (toMin(b.start!) >= ae) break;
      out.push([a, b]);
    }
  }
  return out;
};

export const conflictIds = (occs: Occ[]) => {
  const s = new Set<string>();
  for (const [a, b] of findConflicts(occs)) { s.add(a.task.id); s.add(b.task.id); }
  return s;
};

/** Прострочене разове завдання */
export const isOverdue = (t: Task, today: string, nowMinutes: number) => {
  if (t.repeat !== 'none' || t.doneAt != null || !t.date) return false;
  if (t.date < today) return true;
  if (t.date === today) {
    const end = t.end ? toMin(t.end) : t.start ? toMin(t.start) + taskDur(t) : null;
    return end != null && end < nowMinutes;
  }
  return false;
};
