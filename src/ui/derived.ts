import { useMemo } from 'react';
import { useApp } from '../lib/store';
import { occurrencesOn } from '../lib/recur';
import { dayScore, computeStreaks } from '../lib/score';
import { firstDataDate, toCtx } from '../lib/stats';
import { todayKey } from '../lib/dates';

export const useCtx = () => {
  const app = useApp();
  return useMemo(() => toCtx(app), [app.tasks, app.habits, app.sessions, app.days, app.settings.focusGoalMin, app.settings.defaultDuration]); // eslint-disable-line react-hooks/exhaustive-deps
};

export const useOccs = (date: string) => {
  const { tasks, settings } = useApp();
  return useMemo(() => occurrencesOn(tasks, date, settings.defaultDuration), [tasks, date, settings.defaultDuration]);
};

export const useScore = (date: string) => {
  const ctx = useCtx();
  return useMemo(() => dayScore(date, ctx), [ctx, date]);
};

export const useStreaks = () => {
  const app = useApp();
  const ctx = useCtx();
  return useMemo(() => computeStreaks(ctx, firstDataDate(app), todayKey()), [ctx, app.tasks, app.habits, app.sessions]); // eslint-disable-line react-hooks/exhaustive-deps
};

export const greeting = (h: number) => (h < 5 ? 'Доброї ночі' : h < 12 ? 'Доброго ранку' : h < 18 ? 'Добрий день' : 'Добрий вечір');
