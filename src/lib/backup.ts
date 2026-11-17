// Експорт/імпорт JSON, перевірка даних, локальні знімки (захист від випадкового перезапису).
import type { AppData } from './types';
import * as db from './db';
import { getState, replaceData, snapshotData } from './store';
import { uid } from './ids';
import { dkey } from './dates';

export const APP_ID = 'day-planner';
export const FORMAT = 1;

export interface BackupFile { app: string; format: number; exportedAt: number; data: AppData }

export const buildExport = (): BackupFile => ({ app: APP_ID, format: FORMAT, exportedAt: Date.now(), data: snapshotData() });

const COLLECTIONS = ['tasks', 'categories', 'habits', 'goals', 'journal', 'sessions', 'energy', 'templates', 'countdowns', 'days'] as const;
type Coll = (typeof COLLECTIONS)[number];

export interface Validation { ok: boolean; errors: string[]; warnings: string[]; counts: Record<string, number>; data?: Partial<AppData>; dropped: number }

const str = (v: unknown) => typeof v === 'string';

const validators: Record<Coll, (r: any) => boolean> = {
  tasks: (r) => str(r.id) && str(r.title) && (r.date == null || /^\d{4}-\d{2}-\d{2}$/.test(r.date)),
  categories: (r) => str(r.id) && str(r.name) && str(r.color),
  habits: (r) => str(r.id) && str(r.name) && Array.isArray(r.days) && r.log && typeof r.log === 'object',
  goals: (r) => str(r.id) && str(r.title) && Array.isArray(r.milestones),
  journal: (r) => str(r.id) && str(r.date),
  sessions: (r) => str(r.id) && typeof r.start === 'number' && typeof r.minutes === 'number',
  energy: (r) => str(r.id) && typeof r.ts === 'number' && typeof r.level === 'number',
  templates: (r) => str(r.id) && str(r.name) && Array.isArray(r.items),
  countdowns: (r) => str(r.id) && str(r.title) && str(r.date),
  days: (r) => str(r.id) && str(r.date) && Array.isArray(r.top),
};

export const validateBackup = (o: any): Validation => {
  const res: Validation = { ok: false, errors: [], warnings: [], counts: {}, dropped: 0 };
  if (!o || typeof o !== 'object') { res.errors.push('Файл не є коректним JSON-об’єктом.'); return res; }
  if (o.app !== APP_ID) { res.errors.push('Це не резервна копія цього застосунку.'); return res; }
  if (typeof o.format !== 'number' || o.format > FORMAT) { res.errors.push('Невідома або новіша версія формату резервної копії.'); return res; }
  if (!o.data || typeof o.data !== 'object') { res.errors.push('У файлі немає розділу data.'); return res; }
  const data: Partial<AppData> = {};
  for (const c of COLLECTIONS) {
    const arr = o.data[c];
    if (arr === undefined) { (data as any)[c] = []; res.counts[c] = 0; continue; }
    if (!Array.isArray(arr)) { res.errors.push(`Розділ «${c}» має бути масивом.`); continue; }
    const ok = arr.filter((r) => r && typeof r === 'object' && validators[c](r));
    const bad = arr.length - ok.length;
    if (bad) { res.dropped += bad; res.warnings.push(`«${c}»: пропущено ${bad} пошкоджених записів.`); }
    (data as any)[c] = ok; res.counts[c] = ok.length;
  }
  if (o.data.settings && typeof o.data.settings === 'object') data.settings = o.data.settings;
  if (o.data.achievements && typeof o.data.achievements === 'object') data.achievements = o.data.achievements;
  if (res.errors.length) return res;
  res.ok = true; res.data = data;
  return res;
};

/** Об’єднання: для однакових id перемагає запис із пізнішим updatedAt */
export const mergeInto = (cur: AppData, inc: Partial<AppData>): AppData => {
  const out: any = { ...cur };
  for (const c of COLLECTIONS) {
    const m = new Map<string, any>();
    for (const r of (cur as any)[c]) m.set(r.id, r);
    for (const r of (inc as any)[c] || []) {
      const old = m.get(r.id);
      if (!old || (r.updatedAt || 0) > (old.updatedAt || 0)) m.set(r.id, r);
    }
    out[c] = [...m.values()];
  }
  out.achievements = { ...(inc.achievements || {}), ...cur.achievements };
  return out as AppData;
};

// ---------- Знімки ----------
export interface Snapshot { id: string; createdAt: number; label: string; auto: boolean; counts: Record<string, number>; json: string }

const countOf = (d: AppData) => Object.fromEntries(COLLECTIONS.map((c) => [c, (d as any)[c].length]));

export const createSnapshot = async (label: string, auto = false) => {
  const d = snapshotData();
  const s: Snapshot = { id: uid(), createdAt: Date.now(), label, auto, counts: countOf(d), json: JSON.stringify({ app: APP_ID, format: FORMAT, exportedAt: Date.now(), data: d }) };
  await db.put('backups', s);
  // тримаємо останні 8 автоматичних знімків і 20 ручних
  const all = (await db.getAll<Snapshot>('backups')).sort((a, b) => b.createdAt - a.createdAt);
  const drop = [...all.filter((x) => x.auto).slice(8), ...all.filter((x) => !x.auto).slice(20)];
  for (const x of drop) await db.del('backups', x.id);
  return s;
};
export const listSnapshots = async () => (await db.getAll<Snapshot>('backups')).sort((a, b) => b.createdAt - a.createdAt);
export const deleteSnapshot = (id: string) => db.del('backups', id);
export const restoreSnapshot = async (s: Snapshot) => {
  await createSnapshot('Перед відновленням', true);
  const v = validateBackup(JSON.parse(s.json));
  if (!v.ok || !v.data) throw new Error('Знімок пошкоджено: ' + v.errors.join(' '));
  await replaceData(v.data);
};

/** Раз на добу робить автоматичний знімок, якщо є що зберігати */
export const autoSnapshotIfNeeded = async () => {
  const st = getState();
  if (!db.dbAvailable || !st.tasks.length && !st.habits.length && !st.journal.length && !st.goals.length) return;
  const list = await listSnapshots();
  const today = dkey(new Date());
  if (list.some((x) => x.auto && dkey(new Date(x.createdAt)) === today)) return;
  await createSnapshot('Автоматичний знімок', true);
};

// ---------- Файли ----------
export const downloadFile = async (name: string, text: string) => {
  const blob = new Blob([text], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  const nav = navigator as any;
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: name }); return 'shared'; } catch (e: any) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
};

export const exportFileName = () => `planner-backup-${dkey(new Date())}.json`;
