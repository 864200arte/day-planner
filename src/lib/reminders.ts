// Система нагадувань: локальний рушій (поки застосунок відкрито) + розклад для Web Push (потрібен сервер).
import type { AppData } from './types';
import { addDays, dkey, rangeDays, toMin, tsOf, todayKey } from './dates';
import { occurrencesOn } from './recur';

export interface Due { key: string; at: number; title: string; body: string; kind: 'task' | 'overdue' | 'morning' | 'evening'; taskId?: string; date?: string }

export const REMIND_OPTIONS = [
  { v: 0, label: 'У момент початку' }, { v: 5, label: 'За 5 хвилин' }, { v: 10, label: 'За 10 хвилин' },
  { v: 15, label: 'За 15 хвилин' }, { v: 30, label: 'За 30 хвилин' },
];

const whenText = (r: number) => (r === 0 ? 'Починається зараз' : `Починається через ${r} хв`);

/** Усі нагадування, що мають спрацювати у проміжку [from, to] (мс) */
export const buildDue = (d: AppData, from: number, to: number): Due[] => {
  const out: Due[] = [];
  const first = dkey(new Date(from - 86400000)), last = dkey(new Date(to + 86400000));
  for (const k of rangeDays(first, last)) {
    const occs = occurrencesOn(d.tasks, k, d.settings.defaultDuration);
    for (const o of occs) {
      if (o.done) continue;
      if (o.start) {
        const st = tsOf(k, o.start);
        for (const r of o.task.remind) {
          const at = st - r * 60000;
          if (at >= from && at <= to) out.push({ key: `t|${o.task.id}|${k}|${r}`, at, title: o.task.title, body: whenText(r), kind: 'task', taskId: o.task.id, date: k });
        }
        if (d.settings.remindOverdue) {
          const at = st + o.dur * 60000 + 5 * 60000;
          if (at >= from && at <= to) out.push({ key: `o|${o.task.id}|${k}`, at, title: o.task.title, body: 'Завдання прострочене. Виконати, перенести чи видалити?', kind: 'overdue', taskId: o.task.id, date: k });
        }
      } else if (d.settings.remindOverdue && o.task.repeat === 'none' && o.task.date) {
        // без часу: нагадуємо о 18:00 дня, якщо ще не виконано
        const at = tsOf(k, '18:00');
        if (at >= from && at <= to) out.push({ key: `o|${o.task.id}|${k}`, at, title: o.task.title, body: 'Сьогодні це завдання ще не виконане.', kind: 'overdue', taskId: o.task.id, date: k });
      }
    }
    if (d.settings.morningEnabled) {
      const at = tsOf(k, d.settings.morningTime);
      if (at >= from && at <= to) {
        const n = occs.length;
        out.push({ key: `m|${k}`, at, title: 'Ранковий огляд', body: n ? `Сьогодні в плані: ${n} завд. Відкрийте огляд і розпочніть день.` : 'Сплануйте день — поки що завдань немає.', kind: 'morning', date: k });
      }
    }
    if (d.settings.eveningEnabled) {
      const at = tsOf(k, d.settings.eveningTime);
      if (at >= from && at <= to) out.push({ key: `e|${k}`, at, title: 'Вечірній огляд', body: 'Підіб’ємо підсумки дня і заплануємо завтра.', kind: 'evening', date: k });
    }
  }
  return out.sort((a, b) => a.at - b.at);
};

export type NotifyFn = (due: Due) => void;

let timer: number | null = null;

/** Запускає локальний рушій. Повертає функцію зупинки. */
export const startReminderEngine = (
  getData: () => AppData, hasFired: (k: string) => boolean, markFired: (k: string) => void, notify: NotifyFn,
) => {
  const tick = () => {
    const now = Date.now();
    const dues = buildDue(getData(), now - 60 * 60000, now);
    for (const du of dues) {
      if (hasFired(du.key)) continue;
      markFired(du.key);
      if (now - du.at > 15 * 60000) continue; // занадто давно — не турбуємо
      // перевірка: якщо задачу виконано — не нагадуємо
      notify(du);
    }
  };
  tick();
  timer = window.setInterval(tick, 15000);
  const onVis = () => { if (!document.hidden) tick(); };
  document.addEventListener('visibilitychange', onVis);
  return () => { if (timer) clearInterval(timer); document.removeEventListener('visibilitychange', onVis); };
};

export const nextReminder = (d: AppData, from = Date.now()): Due | null => {
  const list = buildDue(d, from, from + 7 * 86400000).filter((x) => x.kind === 'task');
  return list[0] ?? null;
};

export const reminderLabel = (r: number) => (r === 0 ? 'У момент початку' : r >= 60 && r % 60 === 0 ? `За ${r / 60} год` : `За ${r} хв`);
export { addDays, todayKey, toMin };
