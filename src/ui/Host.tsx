// Хост модальних листів, стеку сторінок, тостів і нижньої панелі навігації.
import { useRef, useState, type ReactNode } from 'react';
import { CalendarDays, CheckSquare, Home, Plus, Timer, UserRound } from 'lucide-react';
import { getUI, ui, useUI, type PageEntry, type SheetEntry, type Tab } from './uiStore';
import { cx } from './kit';
import { t } from '../lib/i18n';
import { Boundary } from './Boundary';

// ---------- Лист (bottom sheet) із жестом «потягнути вниз» ----------
const SheetPanel = ({ s }: { s: SheetEntry }) => {
  const [dy, setDy] = useState(0);
  const drag = useRef<{ y: number; t: number } | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const close = () => ui.closeSheet(s.id);

  const start = (e: React.TouchEvent) => { drag.current = { y: e.touches[0].clientY, t: Date.now() }; };
  const move = (e: React.TouchEvent) => {
    if (!drag.current) return;
    const d = e.touches[0].clientY - drag.current.y;
    if (d > 0) setDy(d);
  };
  const end = () => {
    if (!drag.current) return;
    const v = dy / Math.max(1, Date.now() - drag.current.t);
    drag.current = null;
    if (dy > 110 || v > 0.6) close(); else setDy(0);
  };

  return (
    <div className="fixed inset-0 z-[60]" style={{ touchAction: 'none' }}>
      <div className={cx('absolute inset-0 bg-black/55', s.closing ? 'anim-fade-out' : 'anim-fade')} onClick={close} />
      <div
        className={cx('absolute left-0 right-0 mx-auto w-full max-w-[560px] rounded-t-[28px] bg-bg flex flex-col overflow-hidden', s.closing ? 'anim-sheet-out' : 'anim-sheet')}
        style={{
          bottom: 'var(--kb, 0px)', maxHeight: 'calc(var(--vvh, 100dvh) - var(--sat) - 10px)', height: s.tall ? 'calc(var(--vvh, 100dvh) - var(--sat) - 10px)' : undefined,
          transform: dy ? `translateY(${dy}px)` : undefined, transition: drag.current ? 'none' : 'transform .25s ease',
          boxShadow: '0 -10px 40px rgb(0 0 0 / .35)',
        }}>
        <div onTouchStart={start} onTouchMove={move} onTouchEnd={end} className="pt-2.5 pb-2 shrink-0 cursor-grab" style={{ touchAction: 'none' }}>
          <div className="w-10 h-[5px] rounded-full bg-mute/40 mx-auto" />
        </div>
        <div ref={body} className="min-h-0 flex-1 flex flex-col relative" style={{ touchAction: 'pan-y' }}><Boundary label="sheet">{s.render(close)}</Boundary></div>
      </div>
    </div>
  );
};

// ---------- Сторінка зі стеку (iOS push) + свайп від лівого краю ----------
export const PageLayer = ({ p, children }: { p: PageEntry; children: ReactNode }) => {
  const [dx, setDx] = useState(0);
  const g = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const onStart = (e: React.TouchEvent) => { const x = e.touches[0].clientX; g.current = { x, y: e.touches[0].clientY, active: x < 26 }; };
  const onMove = (e: React.TouchEvent) => {
    const c = g.current; if (!c?.active) return;
    const d = e.touches[0].clientX - c.x;
    if (Math.abs(e.touches[0].clientY - c.y) > 60 && d < 30) { c.active = false; setDx(0); return; }
    setDx(Math.max(0, d));
  };
  const onEnd = () => { const c = g.current; g.current = null; if (c?.active && dx > 90) { ui.pop(); setTimeout(() => setDx(0), 260); } else setDx(0); };
  return (
    <div className={cx('absolute inset-0 z-30 bg-bg', p.closing ? 'anim-push-out' : 'anim-push')}
      style={{ transform: dx ? `translateX(${dx}px)` : undefined, boxShadow: '-10px 0 30px rgb(0 0 0 / .25)', transition: g.current ? 'none' : undefined }}
      onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}>
      {children}
    </div>
  );
};

export const Toasts = () => {
  const { toasts } = useUI();
  return (
    <div className="fixed left-0 right-0 z-[80] flex flex-col items-center gap-2 pointer-events-none px-4" style={{ top: 'calc(var(--sat) + 10px)' }}>
      {toasts.map((x) => (
        <div key={x.id} className="anim-toast pointer-events-auto glass hair rounded-2xl pl-4 pr-2 py-2.5 flex items-center gap-3 max-w-[420px] w-full shadow-[0_12px_32px_rgb(0_0_0/.35)]" role="status">
          <div className={cx('w-2 h-2 rounded-full shrink-0', x.tone === 'warn' ? 'bg-warn' : x.tone === 'good' ? 'bg-good' : 'bg-accent')} />
          <div className="flex-1 text-[14.5px] font-medium leading-snug">{x.msg}</div>
          {x.action && <button onClick={() => { x.action!.fn(); ui.dismissToast(x.id); }} className="pressable text-accent font-bold text-[14.5px] px-2.5 h-8">{x.action.label}</button>}
        </div>
      ))}
    </div>
  );
};

export const SheetHost = () => {
  const { sheets } = useUI();
  return <>{sheets.map((s) => <SheetPanel key={s.id} s={s} />)}</>;
};

// ---------- Нижня панель ----------
const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Головна', icon: Home },
  { id: 'calendar', label: 'Календар', icon: CalendarDays },
  { id: 'tasks', label: 'Завдання', icon: CheckSquare },
  { id: 'focus', label: 'Фокус', icon: Timer },
  { id: 'profile', label: 'Профіль', icon: UserRound },
];

export const TabBar = ({ onAdd }: { onAdd: () => void }) => {
  const { tab, pages } = useUI();
  const hidden = getUI().focusFull;
  if (hidden) return null;
  const left = TABS.slice(0, 2), right = TABS.slice(2);
  const item = (x: (typeof TABS)[number]) => {
    const active = tab === x.id && pages.length === 0;
    const Icon = x.icon;
    return (
      <button key={x.id} onClick={() => { if (tab === x.id) ui.popAll(); ui.go(x.id); }} aria-label={t(x.label)} aria-current={active ? 'page' : undefined}
        className={cx('pressable flex-1 flex flex-col items-center justify-center gap-[3px] h-[54px]', active ? 'text-accent' : 'text-mute')}>
        <Icon size={24} strokeWidth={active ? 2.5 : 2} />
        <span className="text-[10.5px] font-semibold leading-none">{t(x.label)}</span>
      </button>
    );
  };
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div className="glass hair-t mx-auto max-w-[640px] flex items-start relative" style={{ paddingBottom: 'var(--sab)' }}>
        <div className="flex flex-1 pt-1">{left.map(item)}</div>
        <div className="w-[76px] shrink-0 relative">
          <button onClick={onAdd} aria-label={t('Нове завдання')}
            className="pressable absolute left-1/2 -translate-x-1/2 -top-[22px] w-[60px] h-[60px] rounded-full flex items-center justify-center text-white"
            style={{ background: 'linear-gradient(145deg, rgb(var(--accent)), rgb(var(--accent) / .72) 60%, #38bdf8)', boxShadow: '0 10px 26px -6px rgb(var(--accent) / .75), 0 0 0 5px rgb(var(--bg))' }}>
            <Plus size={30} strokeWidth={2.8} />
          </button>
        </div>
        <div className="flex flex-1 pt-1">{right.map(item)}</div>
      </div>
    </div>
  );
};
