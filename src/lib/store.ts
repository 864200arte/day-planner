// Єдине сховище: стан у пам'яті + автоматичний запис у IndexedDB.
import { useSyncExternalStore } from 'react';
import type { AppData, Category, Countdown, DayInfo, EnergyLog, FocusSession, Goal, Habit, JournalEntry, Settings, Task, Template } from './types';
import * as db from './db';
import { blankTask, DEFAULT_CATEGORIES, DEFAULT_SETTINGS, HOME_BLOCKS } from './defaults';
import { uid } from './ids';
import { addDays, dkey, setLocale, todayKey } from './dates';
import { setLang } from './i18n';

export interface State extends AppData {
  ready: boolean;
  persistError: string | null;
  fired: Record<string, number>;
}

const empty = (): State => ({
  ready: false, persistError: null, fired: {},
  tasks: [], categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })), habits: [], goals: [], journal: [], sessions: [], energy: [],
  templates: [], countdowns: [], days: [], settings: { ...DEFAULT_SETTINGS, homeBlocks: DEFAULT_SETTINGS.homeBlocks.map((b) => ({ ...b })) }, achievements: {},
});

let state: State = empty();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const getState = () => state;
export const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useApp = (): State => useSyncExternalStore(subscribe, getState, getState);

const set = (patch: Partial<State>) => { state = { ...state, ...patch }; emit(); };

let writeQueue: Promise<unknown> = Promise.resolve();
const persist = (fn: () => Promise<unknown>) => {
  if (!db.dbAvailable) return;
  writeQueue = writeQueue.then(fn).catch((e) => {
    console.error('persist', e);
    set({ persistError: String(e?.message || e) });
  });
};
const saveRec = (store: db.StoreName, v: unknown) => persist(() => db.put(store, v));
const saveKv = (id: string, value: unknown) => persist(() => db.put('kv', { id, value }));
const delRec = (store: db.StoreName, id: string) => persist(() => db.del(store, id));

const normalizeSettings = (s: Partial<Settings> | undefined): Settings => {
  const merged: Settings = { ...DEFAULT_SETTINGS, ...(s || {}) };
  const have = new Map((merged.homeBlocks || []).map((b) => [b.id, b]));
  merged.homeBlocks = [...(merged.homeBlocks || []).filter((b) => HOME_BLOCKS.includes(b.id)), ...HOME_BLOCKS.filter((id) => !have.has(id)).map((id) => ({ id, visible: true }))];
  return merged;
};

export const applyTheme = (s: Settings) => {
  const root = document.documentElement;
  const dark = s.theme === 'dark' || (s.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  const hex = s.accent.replace('#', '');
  const n = parseInt(hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex, 16);
  root.style.setProperty('--accent', `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#0b0b10' : '#f3f3f8'));
  setLocale(s.lang); setLang(s.lang);
  root.lang = s.lang;
};

export const loadAll = async () => {
  const base = empty();
  try {
    await db.openDb();
    const [tasks, categories, habits, goals, journal, sessions, energy, templates, countdowns, days, kv] = await Promise.all([
      db.getAll<Task>('tasks'), db.getAll<Category>('categories'), db.getAll<Habit>('habits'), db.getAll<Goal>('goals'),
      db.getAll<JournalEntry>('journal'), db.getAll<FocusSession>('sessions'), db.getAll<EnergyLog>('energy'),
      db.getAll<Template>('templates'), db.getAll<Countdown>('countdowns'), db.getAll<DayInfo>('days'),
      db.getAll<{ id: string; value: any }>('kv'),
    ]);
    const kvm = Object.fromEntries(kv.map((x) => [x.id, x.value]));
    // IndexedDB повертає записи за ключем — відновлюємо природний порядок: вбудовані як у списку, далі власні за часом
    const order = DEFAULT_CATEGORIES.map((c) => c.id);
    let cats = [...categories].sort((a, b) => {
      const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      return a.updatedAt - b.updatedAt;
    });
    if (!cats.length) { cats = DEFAULT_CATEGORIES.map((c) => ({ ...c, updatedAt: Date.now() })); await db.putMany('categories', cats); }
    state = {
      ...base, ready: true, tasks: tasks.map(fixTask), categories: cats, habits, goals, journal, sessions, energy, templates, countdowns, days,
      settings: normalizeSettings(kvm.settings), achievements: kvm.achievements || {}, fired: kvm.fired || {},
    };
  } catch (e: any) {
    state = { ...base, ready: true, persistError: 'Сховище недоступне: дані зберігатимуться лише до закриття застосунку. ' + (e?.message || '') };
  }
  applyTheme(state.settings);
  emit();
};

const fixTask = (t: Task): Task => ({ ...blankTask(), ...t, remind: t.remind || [], exceptions: t.exceptions || [], doneDates: t.doneDates || {}, moves: t.moves || [] });

/** Повна заміна даних (імпорт/відновлення) */
export const replaceData = async (d: Partial<AppData>) => {
  const next: State = {
    ...empty(), ready: true, fired: state.fired,
    tasks: (d.tasks || []).map(fixTask), categories: d.categories?.length ? d.categories : DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    habits: d.habits || [], goals: d.goals || [], journal: d.journal || [], sessions: d.sessions || [], energy: d.energy || [],
    templates: d.templates || [], countdowns: d.countdowns || [], days: d.days || [],
    settings: normalizeSettings(d.settings), achievements: d.achievements || {},
  };
  state = next;
  applyTheme(state.settings);
  emit();
  if (db.dbAvailable) {
    for (const s of ['tasks', 'categories', 'habits', 'goals', 'journal', 'sessions', 'energy', 'templates', 'countdowns', 'days'] as const) {
      await db.replaceAll(s, (next as any)[s]);
    }
    await db.putMany('kv', [{ id: 'settings', value: next.settings }, { id: 'achievements', value: next.achievements }]);
  }
};

export const snapshotData = (): AppData => {
  const s = state;
  return { tasks: s.tasks, categories: s.categories, habits: s.habits, goals: s.goals, journal: s.journal, sessions: s.sessions, energy: s.energy, templates: s.templates, countdowns: s.countdowns, days: s.days, settings: s.settings, achievements: s.achievements };
};

// ---------- Дії ----------
const now = () => Date.now();

export const addTask = (p: Partial<Task>): Task => {
  const t = blankTask({ ...p, id: p.id || uid(), createdAt: now(), updatedAt: now() });
  if (!p.remind && state.settings.defaultReminders.length && t.start) t.remind = [...state.settings.defaultReminders];
  set({ tasks: [...state.tasks, t] }); saveRec('tasks', t);
  return t;
};
export const updateTask = (id: string, patch: Partial<Task>) => {
  const old = state.tasks.find((t) => t.id === id); if (!old) return;
  const t = { ...old, ...patch, updatedAt: now() };
  set({ tasks: state.tasks.map((x) => (x.id === id ? t : x)) }); saveRec('tasks', t);
};
export const deleteTask = (id: string) => {
  const old = state.tasks.find((t) => t.id === id);
  set({ tasks: state.tasks.filter((t) => t.id !== id), days: state.days.map((d) => (d.top.includes(id) ? { ...d, top: d.top.filter((x) => x !== id) } : d)) });
  delRec('tasks', id);
  return old;
};
export const restoreTask = (t: Task) => { set({ tasks: [...state.tasks.filter((x) => x.id !== t.id), t] }); saveRec('tasks', t); };
export const skipOccurrence = (id: string, date: string) => {
  const t = state.tasks.find((x) => x.id === id); if (!t) return;
  updateTask(id, { exceptions: [...t.exceptions, date] });
};

export const toggleDone = (id: string, date: string) => {
  const t = state.tasks.find((x) => x.id === id); if (!t) return false;
  if (t.repeat === 'none') {
    const done = t.doneAt == null;
    updateTask(id, { doneAt: done ? now() : null });
    return done;
  }
  const dd = { ...t.doneDates };
  const done = !dd[date];
  if (done) dd[date] = now(); else delete dd[date];
  updateTask(id, { doneDates: dd });
  return done;
};

/** Перенесення входження (для повторюваних — відокремлює копію) */
export const moveOccurrence = (id: string, fromDate: string, patch: { date?: string | null; start?: string | null; end?: string | null }) => {
  const t = state.tasks.find((x) => x.id === id); if (!t) return;
  const dateChanged = patch.date !== undefined && patch.date !== fromDate;
  const mv = dateChanged ? [...t.moves, { from: fromDate, to: patch.date ?? null, at: now() }] : t.moves;
  if (t.repeat === 'none') {
    updateTask(id, { ...patch, moves: mv, movedCount: t.movedCount + (dateChanged ? 1 : 0) });
    return;
  }
  const wasDone = !!t.doneDates[fromDate];
  const copy = addTask({
    ...t, id: undefined, repeat: 'none', repeatUntil: null, exceptions: [], doneDates: {}, doneAt: wasDone ? t.doneDates[fromDate] : null,
    date: patch.date !== undefined ? patch.date : fromDate, start: patch.start !== undefined ? patch.start : t.start, end: patch.end !== undefined ? patch.end : t.end,
    moves: [{ from: fromDate, to: patch.date ?? fromDate, at: now() }], movedCount: dateChanged ? 1 : 0,
  });
  skipOccurrence(id, fromDate);
  return copy;
};

export const addCategory = (name: string, color: string) => { const c: Category = { id: uid(), name, color, updatedAt: now() }; set({ categories: [...state.categories, c] }); saveRec('categories', c); return c; };
export const updateCategory = (id: string, patch: Partial<Category>) => { const c = state.categories.find((x) => x.id === id); if (!c) return; const n = { ...c, ...patch, updatedAt: now(), builtin: patch.name !== undefined && patch.name !== c.name ? false : c.builtin }; set({ categories: state.categories.map((x) => (x.id === id ? n : x)) }); saveRec('categories', n); };
export const deleteCategory = (id: string) => {
  if (state.categories.length <= 1) return;
  const fallback = state.categories.find((c) => c.id !== id)!.id;
  const moved = state.tasks.filter((t) => t.categoryId === id).map((t) => ({ ...t, categoryId: fallback, updatedAt: now() }));
  set({ categories: state.categories.filter((c) => c.id !== id), tasks: state.tasks.map((t) => (t.categoryId === id ? { ...t, categoryId: fallback, updatedAt: now() } : t)) });
  delRec('categories', id); for (const t of moved) saveRec('tasks', t);
};

export const addHabit = (p: Partial<Habit>) => { const h: Habit = { id: uid(), name: '', emoji: '✨', color: '#22c55e', days: [0, 1, 2, 3, 4, 5, 6], log: {}, createdAt: now(), updatedAt: now(), ...p }; set({ habits: [...state.habits, h] }); saveRec('habits', h); return h; };
export const updateHabit = (id: string, patch: Partial<Habit>) => { const h = state.habits.find((x) => x.id === id); if (!h) return; const n = { ...h, ...patch, updatedAt: now() }; set({ habits: state.habits.map((x) => (x.id === id ? n : x)) }); saveRec('habits', n); };
export const deleteHabit = (id: string) => { set({ habits: state.habits.filter((h) => h.id !== id) }); delRec('habits', id); };
export const toggleHabit = (id: string, date: string) => {
  const h = state.habits.find((x) => x.id === id); if (!h) return false;
  const log = { ...h.log }; const done = !log[date];
  if (done) log[date] = now(); else delete log[date];
  updateHabit(id, { log }); return done;
};

export const addGoal = (p: Partial<Goal>) => { const g: Goal = { id: uid(), title: '', description: '', deadline: null, color: '#8b7cff', milestones: [], createdAt: now(), updatedAt: now(), doneAt: null, ...p }; set({ goals: [...state.goals, g] }); saveRec('goals', g); return g; };
export const updateGoal = (id: string, patch: Partial<Goal>) => {
  const g = state.goals.find((x) => x.id === id); if (!g) return;
  const n = { ...g, ...patch, updatedAt: now() };
  const all = n.milestones.length > 0 && n.milestones.every((m) => m.done);
  if (patch.doneAt === undefined) n.doneAt = all ? g.doneAt ?? now() : null;
  set({ goals: state.goals.map((x) => (x.id === id ? n : x)) }); saveRec('goals', n);
};
export const deleteGoal = (id: string) => { set({ goals: state.goals.filter((g) => g.id !== id) }); delRec('goals', id); };

export const saveJournal = (date: string, patch: Partial<JournalEntry>) => {
  const old = state.journal.find((j) => j.date === date);
  const e: JournalEntry = { id: date, date, text: '', mood: null, thoughts: [], ...old, ...patch, updatedAt: now() };
  const empty = !e.text.trim() && e.mood == null && !e.thoughts.length;
  if (empty) { set({ journal: state.journal.filter((j) => j.date !== date) }); delRec('journal', date); return; }
  set({ journal: [...state.journal.filter((j) => j.date !== date), e] }); saveRec('journal', e);
};

export const addSession = (p: Omit<FocusSession, 'id' | 'updatedAt'>) => { const s: FocusSession = { ...p, id: uid(), updatedAt: now() }; set({ sessions: [...state.sessions, s] }); saveRec('sessions', s); return s; };
export const deleteSession = (id: string) => { set({ sessions: state.sessions.filter((s) => s.id !== id) }); delRec('sessions', id); };
export const addEnergy = (level: number) => { const e: EnergyLog = { id: uid(), ts: now(), level, updatedAt: now() }; set({ energy: [...state.energy, e] }); saveRec('energy', e); };

export const saveTemplate = (p: Partial<Template>) => { const t: Template = { id: uid(), name: 'Шаблон', emoji: '🗓️', items: [], updatedAt: now(), ...p }; set({ templates: [...state.templates.filter((x) => x.id !== t.id), { ...t, updatedAt: now() }] }); saveRec('templates', { ...t, updatedAt: now() }); return t; };
export const deleteTemplate = (id: string) => { set({ templates: state.templates.filter((t) => t.id !== id) }); delRec('templates', id); };

export const saveCountdown = (p: Partial<Countdown>) => { const c: Countdown = { id: uid(), title: '', date: addDays(todayKey(), 30), emoji: '🎉', updatedAt: now(), ...p }; set({ countdowns: [...state.countdowns.filter((x) => x.id !== c.id), { ...c, updatedAt: now() }] }); saveRec('countdowns', { ...c, updatedAt: now() }); return c; };
export const deleteCountdown = (id: string) => { set({ countdowns: state.countdowns.filter((c) => c.id !== id) }); delRec('countdowns', id); };

export const updateDay = (date: string, patch: Partial<DayInfo>) => {
  const old = state.days.find((d) => d.date === date);
  const d: DayInfo = { id: date, date, top: [], rating: null, results: '', startedAt: null, finishedAt: null, ...old, ...patch, updatedAt: now() };
  set({ days: [...state.days.filter((x) => x.date !== date), d] }); saveRec('days', d);
};

export const updateSettings = (patch: Partial<Settings>) => {
  const s = normalizeSettings({ ...state.settings, ...patch });
  set({ settings: s }); saveKv('settings', s); applyTheme(s);
};

export const setAchievements = (a: Record<string, number>) => { set({ achievements: a }); saveKv('achievements', a); };
export const markFired = (key: string) => {
  const cutoff = now() - 3 * 86400000;
  const f: Record<string, number> = {};
  for (const [k, v] of Object.entries(state.fired)) if (v > cutoff) f[k] = v;
  f[key] = now(); state = { ...state, fired: f }; saveKv('fired', f);
};
export const hasFired = (key: string) => !!state.fired[key];

export const resetAll = async () => {
  await replaceData({});
};

export const todayStr = () => dkey(new Date());
