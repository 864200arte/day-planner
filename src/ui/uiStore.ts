// Стан навігації: вкладки, стек сторінок (iOS-подібні переходи), модальні листи, тости.
import { useSyncExternalStore, type ReactNode } from 'react';
import { todayKey } from '../lib/dates';

export type Tab = 'home' | 'calendar' | 'tasks' | 'focus' | 'profile';
export type CalView = 'day' | 'week' | 'month';
export type PageName =
  | 'morning' | 'evening' | 'planner' | 'assistant' | 'habits' | 'goals' | 'journal' | 'stats' | 'templates'
  | 'countdowns' | 'achievements' | 'settings' | 'install' | 'backup' | 'insights' | 'score' | 'categories' | 'notifications';

export interface PageEntry { id: number; name: PageName; props?: any; closing?: boolean }
export interface SheetEntry { id: number; render: (close: () => void) => ReactNode; closing?: boolean; tall?: boolean }
export interface Toast { id: number; msg: string; action?: { label: string; fn: () => void }; tone?: 'good' | 'info' | 'warn' }

interface UIState { tab: Tab; pages: PageEntry[]; sheets: SheetEntry[]; toasts: Toast[]; calDate: string; calView: CalView; focusFull: boolean; mounted: Tab[] }

let st: UIState = { tab: 'home', pages: [], sheets: [], toasts: [], calDate: todayKey(), calView: 'day', focusFull: false, mounted: ['home'] };
const ls = new Set<() => void>();
const emit = () => ls.forEach((l) => l());
const set = (p: Partial<UIState>) => { st = { ...st, ...p }; emit(); };
export const useUI = () => useSyncExternalStore((l) => { ls.add(l); return () => { ls.delete(l); }; }, () => st, () => st);
export const getUI = () => st;

let seq = 1;

export const ui = {
  go(tab: Tab) { set({ tab, pages: [], mounted: st.mounted.includes(tab) ? st.mounted : [...st.mounted, tab] }); },
  push(name: PageName, props?: any) { set({ pages: [...st.pages, { id: seq++, name, props }] }); },
  pop() {
    const top = [...st.pages].reverse().find((p) => !p.closing);
    if (!top) return;
    set({ pages: st.pages.map((p) => (p.id === top.id ? { ...p, closing: true } : p)) });
    setTimeout(() => set({ pages: st.pages.filter((p) => p.id !== top.id) }), 240);
  },
  popAll() { set({ pages: [] }); },
  sheet(render: SheetEntry['render'], opts: { tall?: boolean } = {}) {
    const id = seq++;
    set({ sheets: [...st.sheets, { id, render, tall: opts.tall }] });
    return id;
  },
  closeSheet(id?: number) {
    const top = id != null ? st.sheets.find((s) => s.id === id) : [...st.sheets].reverse().find((s) => !s.closing);
    if (!top || top.closing) return;
    set({ sheets: st.sheets.map((s) => (s.id === top.id ? { ...s, closing: true } : s)) });
    setTimeout(() => set({ sheets: st.sheets.filter((s) => s.id !== top.id) }), 260);
  },
  closeAllSheets() { for (const s of st.sheets) ui.closeSheet(s.id); },
  toast(msg: string, opts: { action?: Toast['action']; tone?: Toast['tone']; ms?: number } = {}) {
    const id = seq++;
    set({ toasts: [...st.toasts.slice(-2), { id, msg, action: opts.action, tone: opts.tone }] });
    setTimeout(() => set({ toasts: st.toasts.filter((t) => t.id !== id) }), opts.ms ?? 4200);
  },
  dismissToast(id: number) { set({ toasts: st.toasts.filter((t) => t.id !== id) }); },
  openDay(date: string, view: CalView = 'day') { set({ calDate: date, calView: view }); ui.go('calendar'); },
  setCal(p: { date?: string; view?: CalView }) { set({ calDate: p.date ?? st.calDate, calView: p.view ?? st.calView }); },
  setFocusFull(v: boolean) { set({ focusFull: v }); },
  confirm(o: { title: string; message?: string; ok?: string; danger?: boolean; cancel?: string }): Promise<boolean> {
    return new Promise((resolve) => {
      let answered = false;
      const id = ui.sheet((close) => ConfirmBody({ ...o, onAnswer: (v: boolean) => { answered = true; close(); resolve(v); } }));
      // закриття свайпом/тапом по фону = «ні»
      const iv = setInterval(() => { if (!answered && !st.sheets.some((s) => s.id === id)) { clearInterval(iv); resolve(false); } }, 200);
    });
  },
};

// Тіло підтвердження створюється в kit (щоб не імпортувати React-компоненти сюди) — реєструється ззовні.
let confirmBody: (p: any) => ReactNode = () => null;
export const registerConfirmBody = (fn: (p: any) => ReactNode) => { confirmBody = fn; };
const ConfirmBody = (p: any) => confirmBody(p);
