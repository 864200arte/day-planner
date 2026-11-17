// Фокус-таймер на основі часових міток: переживає закриття застосунку/перезавантаження (стан у localStorage).
// Увага: iOS призупиняє JavaScript у фоні — таймер НЕ «цокає» у фоні, але час завершення рахується за годинником,
// тому після повернення застосунок показує правильний залишок. Сповіщення про завершення у фоні — лише через Web Push (потрібен сервер).
import { useSyncExternalStore } from 'react';
import { addSession, getState } from './store';
import { playSound } from './sound';
import { ui } from '../ui/uiStore';

export interface TimerPreset { id: string; label: string; focus: number; rest: number }
export const PRESETS: TimerPreset[] = [
  { id: '25-5', label: '25 / 5', focus: 25, rest: 5 },
  { id: '50-10', label: '50 / 10', focus: 50, rest: 10 },
];

export interface TimerState {
  phase: 'focus' | 'rest';
  status: 'idle' | 'running' | 'paused';
  planned: number;          // хвилин у поточній фазі
  startedAt: number | null; // ts початку фази (для запису сесії)
  endsAt: number | null;    // коли закінчиться (running)
  remainingMs: number;      // залишок (paused/idle)
  taskId: string | null;
  presetId: string;         // '25-5' | '50-10' | 'custom'
  accumulated: number;      // мс фактичної роботи у фазі focus до паузи
  lastResumeAt: number | null;
  completedToday: number;
}

const KEY = 'dp.timer.v1';
const initial = (): TimerState => ({ phase: 'focus', status: 'idle', planned: 25, startedAt: null, endsAt: null, remainingMs: 25 * 60000, taskId: null, presetId: '25-5', accumulated: 0, lastResumeAt: null, completedToday: 0 });

const load = (): TimerState => { try { const s = localStorage.getItem(KEY); return s ? { ...initial(), ...JSON.parse(s) } : initial(); } catch { return initial(); } };
let st: TimerState = typeof localStorage !== 'undefined' ? load() : initial();
const ls = new Set<() => void>();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ігноруємо */ } };
const set = (p: Partial<TimerState>) => { st = { ...st, ...p }; save(); ls.forEach((l) => l()); };
export const useTimer = () => useSyncExternalStore((l) => { ls.add(l); return () => { ls.delete(l); }; }, () => st, () => st);
export const getTimer = () => st;

export const presetMinutes = (id: string, phase: 'focus' | 'rest') => {
  const s = getState().settings;
  if (id === 'custom') return phase === 'focus' ? s.customFocus : s.customRest;
  const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0];
  return phase === 'focus' ? p.focus : p.rest;
};

export const remaining = (now = Date.now()) => (st.status === 'running' && st.endsAt ? Math.max(0, st.endsAt - now) : st.remainingMs);

const recordSession = (completed: boolean) => {
  const t = st;
  if (t.phase !== 'focus' || !t.startedAt) return;
  const work = t.accumulated + (t.status === 'running' && t.lastResumeAt ? Date.now() - t.lastResumeAt : 0);
  const minutes = Math.round((work / 60000) * 10) / 10;
  if (minutes >= 1 || completed) addSession({ taskId: t.taskId, start: t.startedAt, minutes: Math.max(minutes, completed ? t.planned : minutes), planned: t.planned, mode: t.presetId, completed });
};

export const setPreset = (presetId: string) => {
  if (st.status !== 'idle') return;
  const m = presetMinutes(presetId, 'focus');
  set({ presetId, phase: 'focus', planned: m, remainingMs: m * 60000 });
};
export const setTask = (taskId: string | null) => set({ taskId });

export const start = () => {
  const now = Date.now();
  const ms = st.status === 'idle' ? st.planned * 60000 : st.remainingMs;
  set({ status: 'running', endsAt: now + ms, remainingMs: ms, startedAt: st.startedAt ?? now, lastResumeAt: now });
  scheduleTick();
};
export const pause = () => {
  if (st.status !== 'running') return;
  const now = Date.now();
  set({ status: 'paused', remainingMs: Math.max(0, (st.endsAt ?? now) - now), endsAt: null, accumulated: st.accumulated + (st.lastResumeAt ? now - st.lastResumeAt : 0), lastResumeAt: null });
};
export const resume = () => start();
export const reset = () => {
  if (st.phase === 'focus' && st.startedAt && (st.accumulated + (st.lastResumeAt ? Date.now() - st.lastResumeAt : 0)) >= 60000) recordSession(false);
  const m = presetMinutes(st.presetId, 'focus');
  set({ phase: 'focus', status: 'idle', planned: m, remainingMs: m * 60000, startedAt: null, endsAt: null, accumulated: 0, lastResumeAt: null });
};
export const skipPhase = () => {
  if (st.phase === 'focus') { recordSession(false); toRest(false); } else toFocus();
};

const toRest = (auto: boolean) => {
  const m = presetMinutes(st.presetId, 'rest');
  set({ phase: 'rest', status: 'idle', planned: m, remainingMs: m * 60000, startedAt: null, endsAt: null, accumulated: 0, lastResumeAt: null });
  if (auto) start();
};
const toFocus = () => {
  const m = presetMinutes(st.presetId, 'focus');
  set({ phase: 'focus', status: 'idle', planned: m, remainingMs: m * 60000, startedAt: null, endsAt: null, accumulated: 0, lastResumeAt: null });
};

let timer: number | null = null;
const complete = () => {
  const s = getState().settings;
  if (s.timerSound) playSound(st.phase === 'focus' ? 'bell' : 'chime', s.volume);
  if (st.phase === 'focus') {
    set({ accumulated: st.accumulated + (st.lastResumeAt ? Date.now() - st.lastResumeAt : 0) });
    recordSession(true);
    ui.toast('🎯 Фокус-сесію завершено! Час відпочити.', { tone: 'good', ms: 6000 });
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') navigator.serviceWorker?.getRegistration().then((r) => r?.showNotification('Фокус-сесію завершено', { body: 'Час на перерву', tag: 'timer' })).catch(() => {});
    toRest(false);
  } else {
    ui.toast('☕ Перерва закінчилась.', { ms: 5000 });
    toFocus();
  }
};

const scheduleTick = () => {
  if (timer) return;
  timer = window.setInterval(() => {
    if (st.status !== 'running') { if (timer) { clearInterval(timer); timer = null; } return; }
    if (remaining() <= 0) { if (timer) { clearInterval(timer); timer = null; } complete(); }
    else ls.forEach((l) => l());
  }, 250);
};

/** Викликається при старті застосунку: відновлює таймер, що працював до закриття */
export const resumeFromStorage = () => {
  if (st.status === 'running') {
    if (remaining() <= 0) complete(); else scheduleTick();
  }
};
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (!document.hidden && st.status === 'running') { if (remaining() <= 0) complete(); else scheduleTick(); } });
