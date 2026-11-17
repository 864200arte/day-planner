export const pad = (n: number) => String(n).padStart(2, '0');
export const dkey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayKey = () => dkey(new Date());
export const addDays = (k: string, n: number) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
export const diffDays = (a: string, b: string) => {
  const A = parseKey(a), B = parseKey(b);
  return Math.round((Date.UTC(B.getFullYear(), B.getMonth(), B.getDate()) - Date.UTC(A.getFullYear(), A.getMonth(), A.getDate())) / 86400000);
};
/** 0 = понеділок … 6 = неділя */
export const weekday = (k: string) => (parseKey(k).getDay() + 6) % 7;
export const startOfWeek = (k: string, mondayFirst = true) => {
  const w = weekday(k);
  return addDays(k, -(mondayFirst ? w : (w + 1) % 7));
};
export const addMonths = (k: string, n: number) => {
  const d = parseKey(k); const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return dkey(d);
};
export const monthKey = (k: string) => k.slice(0, 7);
export const daysInMonth = (k: string) => { const d = parseKey(k); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); };
/** 42 клітинки місяця */
export const monthGrid = (k: string, mondayFirst = true) => {
  const first = k.slice(0, 8) + '01';
  const s = startOfWeek(first, mondayFirst);
  return Array.from({ length: 42 }, (_, i) => addDays(s, i));
};
export const rangeDays = (from: string, to: string) => {
  const out: string[] = []; let c = from;
  while (c <= to && out.length < 800) { out.push(c); c = addDays(c, 1); }
  return out;
};

export const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };
export const fromMin = (m: number) => { const x = Math.max(0, Math.min(1439, Math.round(m))); return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`; };
export const nowMin = (d = new Date()) => d.getHours() * 60 + d.getMinutes();
export const tsOf = (date: string, hhmm: string) => { const d = parseKey(date); d.setHours(0, toMin(hhmm), 0, 0); return d.getTime(); };

let LOCALE = 'uk-UA';
export const setLocale = (lang: 'uk' | 'en') => { LOCALE = lang === 'uk' ? 'uk-UA' : 'en-US'; };
export const getLocale = () => LOCALE;
export const fmt = (k: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE, o).format(parseKey(k));
export const weekdayLong = (k: string) => fmt(k, { weekday: 'long' });
export const weekdayShort = (k: string) => fmt(k, { weekday: 'short' });
export const monthYear = (k: string) => fmt(k, { month: 'long', year: 'numeric' });
export const dayMonth = (k: string) => fmt(k, { day: 'numeric', month: 'long' });
export const dayMonthShort = (k: string) => fmt(k, { day: 'numeric', month: 'short' });
export const fullDate = (k: string) => fmt(k, { weekday: 'long', day: 'numeric', month: 'long' });

export const fmtTime = (hhmm: string | null, mode: '24' | '12' = '24') => {
  if (!hhmm) return '';
  if (mode === '24') return hhmm;
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
};
export const fmtTs = (ts: number, mode: '24' | '12' = '24') => { const d = new Date(ts); return fmtTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`, mode); };
export const fmtDur = (min: number) => {
  const m = Math.round(min); const h = Math.floor(m / 60); const r = m % 60;
  const H = LOCALE === 'uk-UA' ? 'г' : 'h', M = LOCALE === 'uk-UA' ? 'хв' : 'm';
  if (h && r) return `${h} ${H} ${r} ${M}`;
  if (h) return `${h} ${H}`;
  return `${r} ${M}`;
};
export const relDay = (k: string, today = todayKey()) => {
  const d = diffDays(today, k);
  const uk = LOCALE === 'uk-UA';
  if (d === 0) return uk ? 'Сьогодні' : 'Today';
  if (d === 1) return uk ? 'Завтра' : 'Tomorrow';
  if (d === -1) return uk ? 'Вчора' : 'Yesterday';
  return fullDate(k);
};
