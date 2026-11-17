// AI-помічник. Локальний режим (правила + розбір фраз) працює офлайн; хмарний режим йде через ВАШ сервер (/server),
// щоб секретні ключі ніколи не потрапляли в клієнтський код. Усі пропозиції потребують підтвердження користувача.
import type { AppData, Task } from './types';
import { parseCapture, type Parsed } from './nlp';
import { addDays, fmtDur, fmtTime, fromMin, relDay, todayKey } from './dates';
import { occurrencesOn, isOverdue } from './recur';
import { autoSchedule, dayLoad, energyProfile, type PlanResult } from './planner';
import { dayStats, summarize, toCtx, lastDays } from './stats';
import { buildInsights } from './personalize';

export type Proposal =
  | { kind: 'tasks'; items: Parsed[] }
  | { kind: 'plan'; date: string; plan: PlanResult }
  | { kind: 'move'; items: { taskId: string; title: string; from: string; to: string }[] };

export interface Reply { text: string; proposal?: Proposal; source: 'local' | 'cloud' }

const has = (s: string, re: RegExp) => re.test(s.toLowerCase());

const pickDate = (s: string, today: string) => (has(s, /післязавтра/) ? addDays(today, 2) : has(s, /завтра|tomorrow/) ? addDays(today, 1) : today);

export const planCandidates = (d: AppData, date: string): Task[] =>
  d.tasks.filter((t) => t.repeat === 'none' && t.doneAt == null && !t.start && (t.date === date || (date === todayKey() && t.date && t.date < date)));

export const planForDate = (d: AppData, date: string, now = new Date()): PlanResult => {
  const today = todayKey();
  const existing = occurrencesOn(d.tasks, date, d.settings.defaultDuration).filter((o) => o.start);
  return autoSchedule({
    date, today, now, candidates: planCandidates(d, date), existing, settings: d.settings,
    energy: energyProfile(d.energy, d.settings.personalization).hours,
  });
};

export const analyzeLoad = (d: AppData, date: string) => {
  const occs = occurrencesOn(d.tasks, date, d.settings.defaultDuration);
  const l = dayLoad(occs, d.settings);
  return { occs, ...l };
};

export const localAssistant = (text: string, d: AppData, now = new Date()): Reply => {
  const s = text.trim();
  const today = todayKey();
  const lower = s.toLowerCase();

  if (!s) return { text: 'Напишіть, чим допомогти: «сплануй завтра», «яке в мене навантаження», «перенеси прострочене» або просто опишіть завдання.', source: 'local' };

  if (has(lower, /сплануй|заплануй\s+(мені\s+)?день|розклад|plan\s+my|план\s+на/)) {
    const date = pickDate(lower, today);
    const plan = planForDate(d, date, now);
    if (!plan.items.length && !plan.unplaced.length) {
      return { text: `На ${relDay(date)} немає завдань без часу, які можна розставити. Додайте завдання (наприклад «Завтра підготувати звіт на 2 години») і я запропоную розклад.`, source: 'local' };
    }
    return { text: `Ось пропозиція на ${relDay(date).toLowerCase()}: ${plan.items.length} завд., резерв ${fmtDur(plan.reserveMinutes)}. Перегляньте й підтвердьте — нічого не змінюється без вас.`, proposal: { kind: 'plan', date, plan }, source: 'local' };
  }

  if (has(lower, /навантаж|завантаж|перевантаж|скільки\s+(в мене\s+)?справ|load/)) {
    if (has(lower, /тиждень|week/)) {
      const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
      const rows = days.map((k) => { const a = analyzeLoad(d, k); return `${relDay(k)}: ${a.occs.length} завд., ${fmtDur(a.minutes)} (${a.pct}%)`; });
      const heavy = days.map((k) => ({ k, a: analyzeLoad(d, k) })).sort((x, y) => y.a.pct - x.a.pct)[0];
      return { text: `Навантаження на 7 днів:\n${rows.join('\n')}\n\nНайщільніший день — ${relDay(heavy.k).toLowerCase()} (${heavy.a.pct}%).`, source: 'local' };
    }
    const date = pickDate(lower, today);
    const a = analyzeLoad(d, date);
    const hint = a.pct > 85 ? ' Радимо перенести 1–2 менш важливі справи.' : a.pct < 30 ? ' Є простір для додаткових справ або відпочинку.' : '';
    return { text: `${relDay(date)}: ${a.occs.length} завд., заплановано ${fmtDur(a.minutes)} — ${a.label.toLowerCase()} (${a.pct}% робочого часу).${hint}`, source: 'local' };
  }

  if (has(lower, /перенес|перенести|відклад|прострочен/)) {
    const to = has(lower, /завтра|tomorrow/) || !has(lower, /післязавтра/) ? addDays(today, 1) : addDays(today, 2);
    const nowM = now.getHours() * 60 + now.getMinutes();
    const items = d.tasks.filter((t) => isOverdue(t, today, nowM)).map((t) => ({ taskId: t.id, title: t.title, from: t.date!, to }));
    if (!items.length) return { text: 'Прострочених завдань немає — переносити нічого. 👌', source: 'local' };
    return { text: `Знайшов ${items.length} прострочених завд. Пропоную перенести їх на ${relDay(to).toLowerCase()}. Підтвердіть, щоб застосувати.`, proposal: { kind: 'move', items }, source: 'local' };
  }

  if (has(lower, /продуктивн|статистик|прогрес|як\s+я\s+(справляюсь|працюю)|результат/)) {
    const days = lastDays(7, today);
    const st = dayStats(days, d, toCtx(d));
    const sm = summarize(st, d, [days[0], today]);
    if (!sm.planned && !sm.focusTotal) return { text: 'За останні 7 днів ще немає даних для аналізу — створюйте й виконуйте завдання, і я покажу картину.', source: 'local' };
    const ins = buildInsights(d);
    const tips = ins.insights.slice(0, 2).map((i) => `• ${i.title}: ${i.text}`).join('\n');
    return { text: `За 7 днів: виконано ${sm.done} із ${sm.planned} завд.${sm.avgCompletion != null ? ` (в середньому ${sm.avgCompletion}% на день)` : ''}, фокус ${fmtDur(sm.focusTotal)}${sm.avgScore != null ? `, середня оцінка дня ${sm.avgScore}` : ''}.${tips ? '\n\n' + tips : ''}`, source: 'local' };
  }

  if (has(lower, /(?<![\p{L}])ціл[іьяюеє]|goal/u) && !has(lower, /завтра|сьогодні|о\s*\d/)) {
    if (!d.goals.length) return { text: 'Цілей ще немає. Створіть першу в Профіль → Цілі: додайте дедлайн і 3–5 етапів — так прогрес буде видно.', source: 'local' };
    const rows = d.goals.filter((g) => !g.doneAt).map((g) => {
      const done = g.milestones.filter((m) => m.done).length; const next = g.milestones.find((m) => !m.done);
      return `• ${g.title}: ${g.milestones.length ? `${done}/${g.milestones.length} етапів` : 'без етапів — додайте їх'}${g.deadline ? `, дедлайн ${g.deadline}` : ''}${next ? `. Наступний крок: «${next.title}»` : ''}`;
    });
    return { text: rows.length ? 'Ваші цілі:\n' + rows.join('\n') : 'Усі цілі досягнуто — час поставити нові! 🎉', source: 'local' };
  }

  const items = parseCapture(s, now, today);
  const useful = items.filter((p) => p.title && (p.date || p.start || p.duration || s.split(/\s+/).length >= 2));
  if (useful.length) {
    const lines = useful.map((p) => `• ${p.title} — ${p.date ? relDay(p.date).toLowerCase() : 'без дати'}${p.start ? ' о ' + fmtTime(p.start) : ''}${p.duration ? ' · ' + fmtDur(p.duration) : ''}`);
    return { text: `Розпізнав ${useful.length === 1 ? 'завдання' : useful.length + ' завдання'}:\n${lines.join('\n')}\n\nДодати до календаря?`, proposal: { kind: 'tasks', items: useful }, source: 'local' };
  }
  return { text: 'Не зовсім зрозумів. Спробуйте: «Завтра о 15:00 навчатися дві години», «сплануй завтра», «яке навантаження на тиждень».', source: 'local' };
};

// ---------- Хмарний режим (через ваш сервер) ----------
export const cloudAssistant = async (server: string, text: string, d: AppData, history: { role: 'user' | 'assistant'; text: string }[]): Promise<Reply> => {
  const today = todayKey();
  const ctxDays = [0, 1, 2].map((i) => addDays(today, i));
  const context = {
    today, now: new Date().toISOString(), workHours: [d.settings.workStart, d.settings.workEnd],
    categories: d.categories.map((c) => ({ id: c.id, name: c.name })),
    days: ctxDays.map((k) => ({ date: k, tasks: occurrencesOn(d.tasks, k, d.settings.defaultDuration).map((o) => ({ title: o.task.title, start: o.start, end: o.end, minutes: o.dur, done: o.done, priority: o.task.priority })) })),
    goals: d.goals.filter((g) => !g.doneAt).map((g) => ({ title: g.title, deadline: g.deadline, milestones: g.milestones.length, done: g.milestones.filter((m) => m.done).length })),
  };
  const r = await fetch(`${server.replace(/\/+$/, '')}/api/ai`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: text, history: history.slice(-8), context }) });
  if (!r.ok) throw new Error('Сервер AI повернув помилку ' + r.status);
  const j = await r.json();
  const tasks: Parsed[] = Array.isArray(j.tasks)
    ? j.tasks.filter((x: any) => x && typeof x.title === 'string').map((x: any) => ({
      title: String(x.title).slice(0, 200), date: /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : null,
      start: /^\d{2}:\d{2}$/.test(x.start) ? x.start : null, end: /^\d{2}:\d{2}$/.test(x.end) ? x.end : null,
      duration: Number.isFinite(x.duration) ? Math.max(5, Math.min(960, Math.round(x.duration))) : null,
      categoryId: d.categories.some((c) => c.id === x.categoryId) ? x.categoryId : null, priority: [0, 1, 2, 3].includes(x.priority) ? x.priority : null,
      important: !!x.important, repeat: 'none', remind: null, fuzzyTime: false,
    }))
    : [];
  return { text: String(j.reply || 'Готово.'), proposal: tasks.length ? { kind: 'tasks', items: tasks } : undefined, source: 'cloud' };
};

export const fmtMin = (m: number) => fromMin(m);
