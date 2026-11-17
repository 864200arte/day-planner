import type { AppData } from './types';
import { computeStreaks, dayScore, habitStreak, localKey } from './score';
import { firstDataDate, toCtx } from './stats';
import { todayKey } from './dates';

export interface AchDef { id: string; emoji: string; title: string; desc: string; check: (m: Metrics) => boolean }
export interface Metrics {
  doneTotal: number; focusSessions: number; focusMinutes: number; habits: number; bestStreak: number;
  bestHabitStreak: number; goalsDone: number; journal: number; bestScore: number; finishedDays: number; milestones: number; mostDay: number;
}

export const ACHIEVEMENTS: AchDef[] = [
  { id: 'first-task', emoji: '🌱', title: 'Перший крок', desc: 'Виконайте перше завдання', check: (m) => m.doneTotal >= 1 },
  { id: 'tasks-10', emoji: '✅', title: 'Розгін', desc: 'Виконайте 10 завдань', check: (m) => m.doneTotal >= 10 },
  { id: 'tasks-50', emoji: '🚀', title: 'У потоці', desc: 'Виконайте 50 завдань', check: (m) => m.doneTotal >= 50 },
  { id: 'tasks-200', emoji: '🏔️', title: 'Вершина', desc: 'Виконайте 200 завдань', check: (m) => m.doneTotal >= 200 },
  { id: 'busy-day', emoji: '⚡', title: 'Насичений день', desc: 'Виконайте 5 завдань за один день', check: (m) => m.mostDay >= 5 },
  { id: 'streak-3', emoji: '🔥', title: 'Три дні поспіль', desc: 'Серія продуктивних днів: 3', check: (m) => m.bestStreak >= 3 },
  { id: 'streak-7', emoji: '🌟', title: 'Тиждень сили', desc: 'Серія продуктивних днів: 7', check: (m) => m.bestStreak >= 7 },
  { id: 'streak-30', emoji: '👑', title: 'Місяць дисципліни', desc: 'Серія продуктивних днів: 30', check: (m) => m.bestStreak >= 30 },
  { id: 'focus-1', emoji: '🎯', title: 'Перший фокус', desc: 'Завершіть першу фокус-сесію', check: (m) => m.focusSessions >= 1 },
  { id: 'focus-25', emoji: '🧠', title: 'Глибока робота', desc: 'Завершіть 25 фокус-сесій', check: (m) => m.focusSessions >= 25 },
  { id: 'focus-600', emoji: '⏳', title: '10 годин фокусу', desc: 'Накопичіть 600 хвилин фокусу', check: (m) => m.focusMinutes >= 600 },
  { id: 'habit-1', emoji: '🔁', title: 'Нова звичка', desc: 'Створіть першу звичку', check: (m) => m.habits >= 1 },
  { id: 'habit-7', emoji: '💪', title: 'Звичка закріплюється', desc: 'Серія звички: 7', check: (m) => m.bestHabitStreak >= 7 },
  { id: 'goal-done', emoji: '🏆', title: 'Ціль досягнуто', desc: 'Завершіть велику ціль', check: (m) => m.goalsDone >= 1 },
  { id: 'milestones-5', emoji: '🧭', title: 'Етап за етапом', desc: 'Закрийте 5 етапів цілей', check: (m) => m.milestones >= 5 },
  { id: 'journal-7', emoji: '📓', title: 'Щоденникар', desc: 'Зробіть 7 записів у щоденнику', check: (m) => m.journal >= 7 },
  { id: 'score-90', emoji: '💎', title: 'Ідеальний день', desc: 'Оцінка дня 90+', check: (m) => m.bestScore >= 90 },
  { id: 'review-3', emoji: '🌙', title: 'Підбиваю підсумки', desc: 'Завершіть 3 дні вечірнім оглядом', check: (m) => m.finishedDays >= 3 },
];

export interface Records {
  bestStreak: number; bestScore: { v: number; date: string } | null; mostTasks: { v: number; date: string } | null;
  longestSession: number; bestFocusDay: { v: number; date: string } | null; bestHabitStreak: number;
}

export const computeMetrics = (d: AppData) => {
  const today = todayKey();
  const ctx = toCtx(d);
  const first = firstDataDate(d);
  const streaks = computeStreaks(ctx, first, today);
  let doneTotal = 0, mostDay = 0, mostDayDate = '';
  let bestScore = 0, bestScoreDate = '';
  const perDay = new Map<string, number>();
  for (const t of d.tasks) {
    if (t.repeat === 'none') { if (t.doneAt != null) { const k = t.date ?? localKey(t.doneAt); perDay.set(k, (perDay.get(k) || 0) + 1); doneTotal++; } }
    else for (const k of Object.keys(t.doneDates)) { perDay.set(k, (perDay.get(k) || 0) + 1); doneTotal++; }
  }
  for (const [k, v] of perDay) if (v > mostDay) { mostDay = v; mostDayDate = k; }
  if (first) {
    for (const k of [...new Set([...perDay.keys(), ...d.sessions.map((s) => localKey(s.start))])]) {
      const s = dayScore(k, ctx).score;
      if (s != null && s > bestScore) { bestScore = s; bestScoreDate = k; }
    }
  }
  const fd = new Map<string, number>();
  for (const s of d.sessions) fd.set(localKey(s.start), (fd.get(localKey(s.start)) || 0) + s.minutes);
  let bestFocus = 0, bestFocusDate = '';
  for (const [k, v] of fd) if (v > bestFocus) { bestFocus = v; bestFocusDate = k; }
  const bestHabitStreak = d.habits.reduce((a, h) => Math.max(a, habitStreak(h, today).best), 0);
  const metrics: Metrics = {
    doneTotal, focusSessions: d.sessions.filter((s) => s.completed).length,
    focusMinutes: Math.round(d.sessions.reduce((a, s) => a + s.minutes, 0)), habits: d.habits.length,
    bestStreak: streaks.best, bestHabitStreak, goalsDone: d.goals.filter((g) => g.doneAt).length,
    journal: d.journal.filter((j) => j.text.trim() || j.thoughts.length).length, bestScore,
    finishedDays: d.days.filter((x) => x.finishedAt).length,
    milestones: d.goals.reduce((a, g) => a + g.milestones.filter((m) => m.done).length, 0), mostDay,
  };
  const records: Records = {
    bestStreak: streaks.best,
    bestScore: bestScore ? { v: bestScore, date: bestScoreDate } : null,
    mostTasks: mostDay ? { v: mostDay, date: mostDayDate } : null,
    longestSession: Math.round(d.sessions.reduce((a, s) => Math.max(a, s.minutes), 0)),
    bestFocusDay: bestFocus ? { v: Math.round(bestFocus), date: bestFocusDate } : null,
    bestHabitStreak,
  };
  return { metrics, records, streaks };
};

export const newlyUnlocked = (m: Metrics, have: Record<string, number>) => ACHIEVEMENTS.filter((a) => !have[a.id] && a.check(m)).map((a) => a.id);
