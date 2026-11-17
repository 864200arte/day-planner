// Розбір швидких фраз («Завтра о 18:00 тренування на годину») — працює локально, без AI.
import { addDays, dkey, fromMin, parseKey, pad, toMin, weekday } from './dates';
import type { Repeat } from './types';

export interface Parsed {
  title: string;
  date: string | null;
  start: string | null;
  end: string | null;
  duration: number | null;      // хвилин
  categoryId: string | null;
  priority: 0 | 1 | 2 | 3 | null;
  important: boolean;
  repeat: Repeat;
  remind: number[] | null;
  fuzzyTime: boolean;           // час визначено за частиною дня («ввечері»)
}

const NUMW = "одну|одна|один|дві|два|три|чотири|п'ять|шість|сім|вісім|дев'ять|десять|one|two|three|four|five";
const NUMV: Record<string, number> = { одну: 1, одна: 1, один: 1, дві: 2, два: 2, три: 3, чотири: 4, "п'ять": 5, шість: 6, сім: 7, вісім: 8, "дев'ять": 9, десять: 10, one: 1, two: 2, three: 3, four: 4, five: 5 };
const num = (s: string) => { const l = s.toLowerCase(); return l in NUMV ? NUMV[l] : parseFloat(l.replace(',', '.')); };

const W = (p: string, flags = 'iu') => new RegExp(`(?<![\\p{L}\\p{N}])(?:${p})(?![\\p{L}\\p{N}])`, flags);
const WG = (p: string) => W(p, 'giu');

/** Витягує перший збіг і вирізає його з тексту */
const take = (s: string, re: RegExp): [RegExpMatchArray | null, string] => {
  const m = s.match(re);
  if (!m || m.index === undefined) return [null, s];
  return [m, s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)];
};

const WD: [string, number][] = [
  ['понеділ\\p{L}*|пн|monday|mon', 0], ['вівтор\\p{L}*|вт|tuesday|tue', 1], ['серед\\p{L}*|ср|wednesday|wed', 2],
  ['четвер\\p{L}*|чт|thursday|thu', 3], ["п'ятниц\\p{L}*|пт|friday|fri", 4], ['субот\\p{L}*|сб|saturday|sat', 5], ['неді\\p{L}*|нд|sunday|sun', 6],
];
const WD_ALL = WD.map(([p]) => p).join('|');
const wdIndex = (w: string) => { for (const [p, i] of WD) if (W(p).test(w)) return i; return -1; };

const MONTHS: [string, number][] = [
  ['січ', 0], ['лют', 1], ['берез', 2], ['квіт', 3], ['трав', 4], ['черв', 5], ['лип', 6], ['серп', 7], ['верес', 8], ['жовт', 9], ['листоп', 10], ['груд', 11],
  ['янв', 0], ['февр', 1], ['март', 2], ['апр', 3], ['мая', 4], ['июн', 5], ['июл', 6], ['авг', 7], ['сент', 8], ['окт', 9], ['нояб', 10], ['дек', 11],
  ['jan', 0], ['feb', 1], ['mar', 2], ['apr', 3], ['may', 4], ['jun', 5], ['jul', 6], ['aug', 7], ['sep', 8], ['oct', 9], ['nov', 10], ['dec', 11],
];
const monthIdx = (w: string) => { const l = w.toLowerCase(); for (const [st, i] of MONTHS) if (l.startsWith(st)) return i; return -1; };

const CATS: [string, string][] = [
  ['sport', 'трен|спорт|біг|бігати|зал(?:і|у|ом)?(?![\\p{L}])|йог|gym|run|running|плава|футбол|розтяж|фітнес|workout|баскетбол'],
  ['study', 'навч|вчит|вивч|урок|лекці|курс|екзамен|домашк|study|homework|англійськ|реферат|підготов|конспект|читати|читан|лабораторн|практичн'],
  ['work', 'робот|зустріч|мітинг|проєкт|проект|звіт|клієнт|work|meeting|дзвінок|презентац|нарада|офіс'],
  ['rest', 'відпочин|релакс|фільм|кіно|прогулян|сон|відпуст|rest|chill|гра|ігри|медитац|подорож|побачення|друз'],
  ['shop', 'купит|купува|магазин|покуп|замов|shop|buy|ринок|аптек|продукти'],
  ['personal', 'лікар|стоматолог|прибра|сім.я|мам|тат|бабус|особист|подзвон|подзвони|банк|документ'],
];

const guessCategory = (text: string): string | null => {
  const l = text.toLowerCase();
  for (const [id, pat] of CATS) if (new RegExp(`(?<![\\p{L}])(?:${pat})`, 'iu').test(l)) return id;
  return null;
};

const FILLERS = WG("хочу|хотів\\s+би|хотіла\\s+б|хотілося\\s+б|потрібно|треба|необхідно|маю|мені|мене|я|ми|буду|планую|будь\\s+ласка|please|i\\s+want\\s+to|i\\s+need\\s+to|need\\s+to|нагадай|нагадати|запиши|додай|створи|запланувати|заплануй|add|create|schedule|давай|можна");
const EDGE_WORDS = /^(?:о|об|в|у|на|з|до|і|й|та|а|за|at|on|for|і|ще)(?=\s|$)\s*/iu;
const EDGE_WORDS_END = /\s+(?:о|об|в|у|на|з|до|і|й|та|а|за|at|on|for)$/iu;

const cleanTitle = (s: string) => {
  let t = s.replace(FILLERS, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^[\s,.;:!?\-–—]+|[\s,.;:!?\-–—]+$/g, '');
  for (let i = 0; i < 4; i++) {
    const a = t.replace(EDGE_WORDS, '').replace(EDGE_WORDS_END, '').trim();
    if (a === t) break;
    t = a.replace(/^[\s,.;:!?\-–—]+|[\s,.;:!?\-–—]+$/g, '');
  }
  return t ? t[0].toUpperCase() + t.slice(1) : '';
};

const hhmm = (h: number, m: number) => `${pad(h)}:${pad(m)}`;
const validTime = (h: number, m: number) => h >= 0 && h < 24 && m >= 0 && m < 60;

const adjustMeridiem = (h: number, suffix?: string) => {
  const s = (suffix || '').toLowerCase();
  if ((s === 'вечора' || s === 'pm') && h < 12) return h + 12;
  if (s === 'дня' && h < 7) return h + 12;
  if (s === 'ночі' && h === 12) return 0;
  if (s === 'am' && h === 12) return 0;
  return h;
};

export const parseOne = (input: string, now = new Date(), defaultDate: string | null = null): Parsed => {
  let s = ' ' + input.replace(/[’ʼ`]/g, "'") + ' ';
  const today = dkey(now);
  const r: Parsed = { title: '', date: null, start: null, end: null, duration: null, categoryId: null, priority: null, important: false, repeat: 'none', remind: null, fuzzyTime: false };
  let m: RegExpMatchArray | null;

  // --- повторення
  [m, s] = take(s, W(`що(${WD.map(([p]) => p).join('|')})|кожн\\p{L}*\\s+(${WD_ALL})|every\\s+(${WD_ALL})`));
  if (m) {
    const idx = wdIndex(m[1] || m[2] || m[3] || '');
    r.repeat = 'weekly';
    if (idx >= 0) { const d = (idx - weekday(today) + 7) % 7; r.date = addDays(today, d); }
  }
  if (r.repeat === 'none') {
    [m, s] = take(s, W('щодня|щоденно|кожен\\s+день|кожного\\s+дня|every\\s+day|daily'));
    if (m) r.repeat = 'daily';
  }
  if (r.repeat === 'none') {
    [m, s] = take(s, W('по\\s+будн\\p{L}*|у\\s+будні|в\\s+будні|будн\\p{L}*\\s+дн\\p{L}*|weekdays'));
    if (m) r.repeat = 'weekdays';
  }
  if (r.repeat === 'none') {
    [m, s] = take(s, W('щотижня|щотижнево|кожного\\s+тижня|кожен\\s+тиждень|every\\s+week|weekly'));
    if (m) r.repeat = 'weekly';
  }
  if (r.repeat === 'none') {
    [m, s] = take(s, W('щомісяця|щомісячно|кожного\\s+місяця|кожен\\s+місяць|every\\s+month|monthly'));
    if (m) r.repeat = 'monthly';
  }

  // --- нагадування
  [m, s] = take(s, W(`нагада\\p{L}*\\s+(?:мені\\s+)?за\\s+(\\d+|${NUMW})\\s*(хв\\p{L}*|годин\\p{L}*)`));
  if (m) r.remind = [Math.round(num(m[1]) * (/^год/i.test(m[2]) ? 60 : 1))];
  if (!r.remind) {
    [m, s] = take(s, W('нагада\\p{L}*\\s+(?:мені\\s+)?за\\s+(?:годину|1\\s*год\\p{L}*)'));
    if (m) r.remind = [60];
  }
  if (!r.remind) {
    [m, s] = take(s, W('нагада\\p{L}*\\s+(?:мені\\s+)?за\\s+(?:пів\\s*години|півгодини)'));
    if (m) r.remind = [30];
  }
  if (!r.remind) {
    [m, s] = take(s, W('за\\s+(\\d+)\\s*(хв\\p{L}*)\\s+до(?:\\s+початку)?'));
    if (m) r.remind = [parseInt(m[1], 10)];
  }
  if (!r.remind) {
    [m, s] = take(s, W('remind(?:\\s+me)?\\s+(\\d+)\\s*(min\\p{L}*|hours?)\\s+before'));
    if (m) r.remind = [parseInt(m[1], 10) * (/^h/i.test(m[2]) ? 60 : 1)];
  }
  if (!r.remind) {
    [m, s] = take(s, W('нагадай|нагадати|нагадування|remind(?:\\s+me)?'));
    if (m) r.remind = [10];
  }

  // --- дата
  const setDate = (d: string) => { if (!r.date) r.date = d; };
  [m, s] = take(s, W('післязавтра|послезавтра|day\\s+after\\s+tomorrow'));
  if (m) setDate(addDays(today, 2));
  if (!r.date) { [m, s] = take(s, W('завтра|завтрашн\\p{L}*|tomorrow')); if (m) setDate(addDays(today, 1)); }
  if (!r.date) { [m, s] = take(s, W('сьогодні|сьогоднішн\\p{L}*|сегодня|today')); if (m) setDate(today); }
  if (!r.date) {
    [m, s] = take(s, W(`через\\s+(\\d+|${NUMW})\\s*(?:днів|дні|день|дня|days?)`));
    if (m) setDate(addDays(today, Math.round(num(m[1]))));
  }
  if (!r.date) {
    [m, s] = take(s, W(`через\\s+(\\d+|${NUMW})\\s*(?:тижні|тижнів|тиждень|тижня|weeks?)`));
    if (m) setDate(addDays(today, Math.round(num(m[1])) * 7));
  }
  if (!r.date) { [m, s] = take(s, W('через\\s+тиждень|in\\s+a\\s+week')); if (m) setDate(addDays(today, 7)); }
  if (!r.date) {
    // 25.12 / 25.12.2026 / 25/12
    const re = /(?<![\d:.])(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?![\d:])/g;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(s))) {
      const d = +mm[1], mo = +mm[2];
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
        let y = mm[3] ? +mm[3] : now.getFullYear(); if (y < 100) y += 2000;
        let dt = new Date(y, mo - 1, d);
        if (!mm[3] && dkey(dt) < today) dt = new Date(y + 1, mo - 1, d);
        setDate(dkey(dt));
        s = s.slice(0, mm.index) + ' ' + s.slice(mm.index + mm[0].length);
        break;
      }
    }
  }
  if (!r.date) {
    const re = /(?:(?<![\p{L}\p{N}])(?:в|у|на|до|on)\s+)?(\d{1,2})\s+(\p{L}+)/giu;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(s))) {
      const mo = monthIdx(mm[2]); const d = +mm[1];
      if (mo >= 0 && d >= 1 && d <= 31) {
        let dt = new Date(now.getFullYear(), mo, d);
        if (dkey(dt) < today) dt = new Date(now.getFullYear() + 1, mo, d);
        setDate(dkey(dt));
        s = s.slice(0, mm.index) + ' ' + s.slice(mm.index + mm[0].length);
        break;
      }
    }
  }
  if (!r.date) {
    [m, s] = take(s, W(`(?:(?:в|у|на|on|наступн\\p{L}*|next)\\s+)*(${WD_ALL})`));
    if (m) {
      const idx = wdIndex(m[1]);
      if (idx >= 0) { let d = (idx - weekday(today) + 7) % 7; if (d === 0) d = 7; setDate(addDays(today, d)); }
    }
  }

  // --- інтервал часу
  [m, s] = take(s, W('(?:з|с|from)?\\s*(\\d{1,2})[:.](\\d{2})\\s*(?:-|–|—|до|to|till)\\s*(\\d{1,2})[:.](\\d{2})'));
  if (m && validTime(+m[1], +m[2]) && validTime(+m[3], +m[4])) {
    r.start = hhmm(+m[1], +m[2]); r.end = hhmm(+m[3], +m[4]);
  } else if (m) s = s.replace(/ /, ' ');
  if (!r.start) {
    [m, s] = take(s, W('(?:з|с|from)\\s*(\\d{1,2})(?:[:.](\\d{2}))?\\s*(?:-|–|—|до|to|till)\\s*(\\d{1,2})(?:[:.](\\d{2}))?'));
    if (m && validTime(+m[1], +(m[2] || 0)) && validTime(+m[3], +(m[4] || 0))) {
      r.start = hhmm(+m[1], +(m[2] || 0)); r.end = hhmm(+m[3], +(m[4] || 0));
    }
  }
  // --- час із прийменником
  if (!r.start) {
    [m, s] = take(s, W('(?:о|об|в|у|at|@|к)\\s*(\\d{1,2})(?:[:.](\\d{2}))?(?:\\s*(?:годин\\p{L}*|год\\.?|h))?(?:\\s*(ранку|вечора|дня|ночі|am|pm))?'));
    if (m) {
      const h = adjustMeridiem(+m[1], m[3]); const mi = +(m[2] || 0);
      if (validTime(h, mi)) r.start = hhmm(h, mi);
    }
  }
  if (!r.start) {
    [m, s] = take(s, /(?<![\d:])(\d{1,2}):(\d{2})(?![\d:])/);
    if (m && validTime(+m[1], +m[2])) r.start = hhmm(+m[1], +m[2]);
  }

  // --- «через N годин/хвилин» (відносний час)
  if (!r.start) {
    [m, s] = take(s, W(`через\\s+(?:(\\d+(?:[.,]\\d+)?|${NUMW})\\s*(год\\p{L}*|хв\\p{L}*|hours?|min\\p{L}*)|годину|пів\\s*години|півгодини)`));
    if (m) {
      let mins = 60;
      if (m[1]) mins = Math.round(num(m[1]) * (/^(год|hour)/i.test(m[2]) ? 60 : 1));
      else if (/пів/i.test(m[0])) mins = 30;
      const t = new Date(now.getTime() + mins * 60000);
      const rounded = Math.ceil((t.getHours() * 60 + t.getMinutes()) / 5) * 5;
      if (!r.date) r.date = dkey(t);
      if (rounded < 1440) r.start = fromMin(rounded);
    }
  }

  // --- тривалість
  let dur = 0;
  [m, s] = take(s, W('(?:на\\s+)?(?:півтори|півтора)\\s+годин\\p{L}*|1[.,]5\\s*(?:год\\p{L}*|h|hours?)'));
  if (m) dur += 90;
  [m, s] = take(s, W('(?:на\\s+)?(?:пів\\s*години|півгодини|half\\s+an\\s+hour)'));
  if (m) dur += 30;
  for (;;) {
    [m, s] = take(s, W(`(?:на\\s+)?(\\d+(?:[.,]\\d+)?|${NUMW})\\s*(?:годин\\p{L}*|год\\.?|hours?|hrs?|h)`));
    if (!m) break;
    dur += Math.round(num(m[1]) * 60);
  }
  for (;;) {
    [m, s] = take(s, W('(?:на\\s+)?(\\d+)\\s*(?:хвилин\\p{L}*|хв\\.?|minutes?|mins?|m)'));
    if (!m) break;
    dur += parseInt(m[1], 10);
  }
  if (!dur) {
    [m, s] = take(s, W('на\\s+годину|1\\s*годину|for\\s+an?\\s+hour'));
    if (m) dur = 60;
  }
  if (dur > 0) r.duration = Math.min(dur, 16 * 60);

  // --- частина дня
  if (!r.start) {
    const parts: [string, string][] = [
      ['вранці|зранку|уранці|ранком|на\\s+ранок|in\\s+the\\s+morning|morning', '08:00'],
      ['після\\s+обіду|after\\s+lunch|afternoon', '14:00'],
      ['в\\s+обід|на\\s+обід|об\\s+обіді|at\\s+lunch', '13:00'],
      ['вдень|удень', '13:00'],
      ['ввечері|увечері|вечором|на\\s+вечір|ввечір|in\\s+the\\s+evening|evening|tonight', '19:00'],
      ['вночі|at\\s+night', '22:00'],
    ];
    for (const [p, t] of parts) {
      [m, s] = take(s, W(p));
      if (m) { r.start = t; r.fuzzyTime = true; break; }
    }
  }

  if (r.start && r.duration && !r.end) {
    const e = toMin(r.start) + r.duration;
    if (e < 1440) r.end = fromMin(e);
  }
  if (r.start && r.end && !r.duration) r.duration = Math.max(5, toMin(r.end) - toMin(r.start));

  // --- пріоритет
  [m, s] = take(s, W('терміново|критично|asap|urgent|дуже\\s+важлив\\p{L}*'));
  if (m) { r.priority = 3; r.important = true; }
  else {
    [m, s] = take(s, W('важлив\\p{L}*|important|пріоритетн\\p{L}*'));
    if (m) { r.priority = 2; r.important = true; }
  }

  r.title = cleanTitle(s);
  r.categoryId = guessCategory(r.title || input);
  if (!r.date && defaultDate) r.date = null; // дату підставляє викликач
  return r;
};

/** Розбиває довгу фразу на кілька завдань і передає дату далі («Завтра о 15:00 …, а ввечері …») */
export const parseCapture = (text: string, now = new Date(), defaultDate: string | null = null): Parsed[] => {
  const raw = text.trim();
  if (!raw) return [];
  const segs = raw
    .split(/\s*(?:;|,(?!\d)|[.!?](?=\s|$))\s*|\s+(?:а\s+потім|а\s+також|а\s+ще|потім|після\s+цього|а|then|and\s+then)\s+/giu)
    .map((x) => x?.trim()).filter(Boolean) as string[];
  const hasCue = (p: Parsed) => !!(p.date || p.start || p.duration || p.repeat !== 'none');
  const groups: string[] = [];
  let pending = '';
  for (const seg of segs) {
    const p = parseOne(seg, now);
    if (hasCue(p) || groups.length === 0 && !pending && false) {
      groups.push(pending ? pending + ', ' + seg : seg);
      pending = '';
    } else if (groups.length) {
      groups[groups.length - 1] += ', ' + seg;
    } else {
      pending = pending ? pending + ', ' + seg : seg;
    }
  }
  if (pending) groups.push(pending);
  const out: Parsed[] = [];
  let carry: string | null = defaultDate;
  for (const g of groups) {
    const p = parseOne(g, now);
    if (p.date) carry = p.date; else p.date = carry;
    if (!p.title) p.title = 'Нове завдання';
    out.push(p);
  }
  return out;
};

export const parseDateWord = (s: string) => parseOne(s).date;
export { parseKey };
