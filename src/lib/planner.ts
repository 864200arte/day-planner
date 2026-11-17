// Smart Planner: Auto Schedule, Time Buffer, Priority Intelligence, Energy Tracker, Conflict Detector.
// Нічого не застосовується автоматично — повертає лише ПРОПОЗИЦІЮ.
import type { EnergyLog, Occ, Settings, Task } from './types';
import { diffDays, toMin, fromMin, nowMin } from './dates';
import { taskDur } from './recur';

export interface Slot { start: number; end: number }

/** Вільні проміжки в межах [from, to] за вирахуванням зайнятих */
export const freeSlots = (busy: Slot[], from: number, to: number): Slot[] => {
  const b = busy.filter((x) => x.end > from && x.start < to).sort((a, c) => a.start - c.start);
  const out: Slot[] = [];
  let cur = from;
  for (const x of b) {
    if (x.start > cur) out.push({ start: cur, end: Math.min(x.start, to) });
    cur = Math.max(cur, x.end);
  }
  if (cur < to) out.push({ start: cur, end: to });
  return out.filter((s) => s.end - s.start > 0);
};

/** Базова добова крива енергії (1..5), поступово змішується з реальними записами */
const BASE_ENERGY = [1, 1, 1, 1, 1, 1.5, 2, 3, 3.5, 4.2, 4.5, 4.3, 3.6, 3.2, 3.2, 3.6, 3.8, 3.5, 3.2, 3, 2.6, 2.2, 1.8, 1.4];

export const energyProfile = (logs: EnergyLog[], personalize = true): { hours: number[]; samples: number } => {
  const sums = new Array(24).fill(0), cnt = new Array(24).fill(0);
  if (personalize) for (const l of logs) { const h = new Date(l.ts).getHours(); sums[h] += l.level; cnt[h]++; }
  const hours = BASE_ENERGY.map((b, h) => {
    if (!cnt[h]) return b;
    const w = Math.min(1, cnt[h] / 4); // 4+ записів — повна довіра до даних користувача
    return b * (1 - w) + (sums[h] / cnt[h]) * w;
  });
  return { hours, samples: personalize ? logs.length : 0 };
};

export interface Priority { score: number; reasons: string[] }

/** Priority Intelligence: пояснювана оцінка важливості */
export const priorityScore = (t: Task, today: string, date: string | null): Priority => {
  let score = 0; const reasons: string[] = [];
  if (t.priority > 0) { score += t.priority * 20; reasons.push(['', 'низький пріоритет', 'середній пріоритет', 'високий пріоритет'][t.priority]); }
  if (t.important) { score += 15; reasons.push('позначено важливим'); }
  if (date) {
    const d = diffDays(date, today);
    if (d > 0) { const add = Math.min(25, d * 5); score += add; reasons.push(`прострочено на ${d} дн.`); }
    else if (d === 0) { score += 8; reasons.push('на сьогодні'); }
  }
  if (t.movedCount > 0) { const add = Math.min(12, t.movedCount * 4); score += add; reasons.push(`переносилось ${t.movedCount} р.`); }
  if (taskDur(t) <= 15) { score += 3; reasons.push('швидка справа'); }
  return { score, reasons };
};

export interface PlanItem { taskId: string; title: string; start: number; end: number; reason: string; priority: number }
export interface PlanResult {
  date: string;
  items: PlanItem[];
  breaks: Slot[];
  unplaced: { taskId: string; title: string; why: string }[];
  freeMinutes: number;       // вільного часу в межах дня
  plannedMinutes: number;    // нове, що пропонується
  busyMinutes: number;       // вже зайнято
  reserveMinutes: number;    // залишений резерв
  loadPct: number;
  warnings: string[];
}

export interface PlanInput {
  date: string;
  today: string;
  now?: Date;
  candidates: Task[];        // завдання без часу, які треба розставити
  existing: Occ[];           // уже заплановані події дня (із часом)
  settings: Pick<Settings, 'workStart' | 'workEnd' | 'bufferMin' | 'defaultDuration'>;
  energy: number[];          // 24 значення
  reservePct?: number;       // частка вільного часу, яку лишаємо в резерві
}

export const autoSchedule = (inp: PlanInput): PlanResult => {
  const { date, today, settings, energy } = inp;
  const reservePct = inp.reservePct ?? 0.15;
  const ws = toMin(settings.workStart), we = toMin(settings.workEnd);
  let from = ws;
  if (date === today) { const n = nowMin(inp.now ?? new Date()); from = Math.max(ws, Math.ceil((n + 5) / 5) * 5); }
  const buf = Math.max(0, settings.bufferMin);

  const timed = inp.existing.filter((o) => o.start);
  const busyRaw: Slot[] = timed.map((o) => ({ start: toMin(o.start!), end: toMin(o.start!) + o.dur }));
  const busyPadded: Slot[] = busyRaw.map((b) => ({ start: Math.max(0, b.start - buf), end: b.end + buf }));
  const busyMinutes = busyRaw.reduce((a, b) => a + Math.max(0, Math.min(b.end, we) - Math.max(b.start, ws)), 0);

  const free0 = freeSlots(busyPadded, from, we);
  const freeMinutes = free0.reduce((a, s) => a + (s.end - s.start), 0);
  const reserveMinutes = Math.round(freeMinutes * reservePct);
  let capacity = freeMinutes - reserveMinutes;

  const ranked = inp.candidates
    .map((t) => ({ t, p: priorityScore(t, today, t.date), dur: taskDur(t, settings.defaultDuration) }))
    .sort((a, b) => b.p.score - a.p.score || a.dur - b.dur);

  const placed: PlanItem[] = [];
  const unplaced: PlanResult['unplaced'] = [];
  let busy = [...busyPadded];
  let planned = 0;

  for (const { t, p, dur } of ranked) {
    if (dur > capacity) {
      unplaced.push({ taskId: t.id, title: t.title, why: capacity <= 0 ? 'Немає вільного часу (залишено резерв)' : 'Не вистачає вільного часу з урахуванням резерву' });
      continue;
    }
    const slots = freeSlots(busy, from, we);
    const w = t.priority >= 2 || t.important ? 1.4 : t.priority === 1 ? 0.3 : -0.6; // високий пріоритет → висока енергія
    let best: { s: number; v: number } | null = null;
    for (const sl of slots) {
      for (let s = Math.ceil(sl.start / 5) * 5; s + dur <= sl.end; s += 5) {
        let e = 0, n = 0;
        for (let x = s; x < s + dur; x += 15) { e += energy[Math.min(23, Math.floor(x / 60))]; n++; }
        e /= Math.max(1, n);
        const v = w * e * 10 - (s / 60) * 0.6;
        if (!best || v > best.v) best = { s, v };
      }
    }
    if (!best) { unplaced.push({ taskId: t.id, title: t.title, why: 'Немає достатньо довгого вільного вікна' }); continue; }
    const hour = Math.floor(best.s / 60);
    const eAt = energy[Math.min(23, hour)];
    const parts = [...p.reasons.slice(0, 2)];
    parts.push(eAt >= 3.8 ? 'на піку енергії' : eAt <= 2.4 ? 'у спокійний час' : 'у зручний час');
    placed.push({ taskId: t.id, title: t.title, start: best.s, end: best.s + dur, reason: parts.filter(Boolean).join(' · '), priority: t.priority });
    busy = [...busy, { start: Math.max(0, best.s - buf), end: best.s + dur + buf }];
    capacity -= dur; planned += dur;
  }
  placed.sort((a, b) => a.start - b.start);

  // перерви та попередження
  const timeline: Slot[] = [...busyRaw, ...placed.map((p) => ({ start: p.start, end: p.end }))].sort((a, b) => a.start - b.start);
  const breaks: Slot[] = [];
  const warnings: string[] = [];
  let run = 0, runStart = -1;
  for (let i = 0; i < timeline.length; i++) {
    const cur = timeline[i], next = timeline[i + 1];
    if (runStart < 0) runStart = cur.start;
    run = cur.end - runStart;
    const gap = next ? next.start - cur.end : we - cur.end;
    if (gap >= 15 || !next) { // природна перерва
      if (run >= 90 && gap >= 10) breaks.push({ start: cur.end, end: Math.min(cur.end + Math.min(gap, 15), we) });
      runStart = -1; run = 0;
    } else if (run >= 120) {
      warnings.push(`Понад ${Math.round(run / 60 * 10) / 10} год поспіль без перерви (близько ${fromMin(cur.end)}) — додайте паузу.`);
      runStart = -1; run = 0;
    }
  }
  const total = busyMinutes + planned;
  const span = Math.max(1, we - ws);
  const loadPct = Math.round((total / span) * 100);
  if (loadPct > 85) warnings.push('День виглядає перевантаженим — розгляньте перенесення менш важливих справ.');
  if (unplaced.length) warnings.push(`${unplaced.length} завд. не вдалося розмістити.`);

  return { date, items: placed, breaks, unplaced, freeMinutes, plannedMinutes: planned, busyMinutes, reserveMinutes, loadPct, warnings };
};

/** Навантаження дня: сума тривалостей / робочий проміжок */
export const dayLoad = (occs: Occ[], s: Pick<Settings, 'workStart' | 'workEnd'>) => {
  const span = Math.max(1, toMin(s.workEnd) - toMin(s.workStart));
  const minutes = occs.reduce((a, o) => a + o.dur, 0);
  const pct = Math.round((minutes / span) * 100);
  const label = pct < 35 ? 'Легкий день' : pct < 65 ? 'Збалансований день' : pct < 85 ? 'Щільний день' : 'Перевантажений день';
  return { minutes, pct, label };
};

/** Вільні проміжки дня за наявними подіями (≥ minLen хв) */
export const dayFree = (occs: Occ[], s: Pick<Settings, 'workStart' | 'workEnd'>, from?: number, minLen = 20): Slot[] => {
  const ws = toMin(s.workStart), we = toMin(s.workEnd);
  const busy = occs.filter((o) => o.start).map((o) => ({ start: toMin(o.start!), end: toMin(o.start!) + o.dur }));
  return freeSlots(busy, Math.max(ws, from ?? ws), we).filter((x) => x.end - x.start >= minLen);
};
