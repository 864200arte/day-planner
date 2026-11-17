import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Wand2 } from 'lucide-react';
import * as S from '../lib/store';
import { useApp } from '../lib/store';
import { Segmented, cx, useNow, Btn } from '../ui/kit';
import { getUI, ui, useUI, type CalView } from '../ui/uiStore';
import { addDays, addMonths, dayMonthShort, fmtDur, fmtTime, fromMin, monthGrid, monthYear, nowMin, parseKey, startOfWeek, todayKey, toMin, weekday, weekdayShort, fullDate, fmt } from '../lib/dates';
import { findConflicts, occurrencesOn, conflictIds } from '../lib/recur';
import type { Occ } from '../lib/types';
import { useCats } from '../ui/hooks';
import { openTaskEditor } from './TaskEditor';
import { TaskRow, taskColor } from '../ui/TaskRow';
import { toggleTask } from '../ui/actions';
import { t } from '../lib/i18n';

const HOUR_H = 56;
const SNAP = 15;
const TOTAL_H = 24 * HOUR_H;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

interface Laid { occ: Occ; col: number; cols: number }
const layout = (occs: Occ[]): Laid[] => {
  const timed = occs.filter((o) => o.start).sort((a, b) => toMin(a.start!) - toMin(b.start!) || b.dur - a.dur);
  const out: Laid[] = [];
  let cluster: Laid[] = []; let colEnds: number[] = []; let clusterEnd = -1;
  const flush = () => { const n = colEnds.length; cluster.forEach((c) => (c.cols = n)); out.push(...cluster); cluster = []; colEnds = []; clusterEnd = -1; };
  for (const o of timed) {
    const s = toMin(o.start!), e = s + Math.max(o.dur, 20);
    if (cluster.length && s >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= s);
    if (col < 0) { col = colEnds.length; colEnds.push(e); } else colEnds[col] = e;
    cluster.push({ occ: o, col, cols: 1 }); clusterEnd = Math.max(clusterEnd, e);
  }
  flush();
  return out;
};

interface DragState { id: string; kind: 'move' | 'resize'; start: number; end: number; moved: boolean }

export const CalendarScreen = () => {
  const { calDate: date, calView: view } = useUI();
  const app = useApp();
  const now = useNow(30000);
  const today = todayKey();
  const cats = useCats();
  const { settings } = app;
  const scroller = useRef<HTMLDivElement>(null);
  const [anim, setAnim] = useState<'l' | 'r' | ''>('');

  const go = (d: string) => ui.setCal({ date: d });
  const step = (dir: 1 | -1) => {
    setAnim(dir === 1 ? 'l' : 'r'); setTimeout(() => setAnim(''), 280);
    go(view === 'month' ? addMonths(date, dir) : addDays(date, dir * (view === 'week' ? 7 : 1)));
  };

  // свайп між датами
  const sw = useRef<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  const onTS = (e: React.TouchEvent) => { sw.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTE = (e: React.TouchEvent) => {
    const s = sw.current; sw.current = null;
    if (!s || dragRef.current) return;
    const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8 && s.x > 24) step(dx < 0 ? 1 : -1);
  };

  const days = useMemo(() => (view === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date, settings.weekStartsMonday), i)) : [date]), [view, date, settings.weekStartsMonday]);
  const occByDay = useMemo(() => Object.fromEntries(days.map((d) => [d, occurrencesOn(app.tasks, d, settings.defaultDuration)])) as Record<string, Occ[]>, [days, app.tasks, settings.defaultDuration]);

  // початкова прокрутка
  useEffect(() => {
    const el = scroller.current; if (!el || view === 'month') return;
    const list = days.flatMap((d) => occByDay[d]).filter((o) => o.start);
    const first = list.length ? Math.min(...list.map((o) => toMin(o.start!))) : 8 * 60;
    const target = days.includes(today) ? Math.min(nowMin() - 90, first - 30) : first - 45;
    el.scrollTop = Math.max(0, (Math.max(0, target) / 60) * HOUR_H);
  }, [date, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const title = view === 'month' ? monthYear(date) : view === 'week' ? `${dayMonthShort(days[0])} – ${dayMonthShort(days[6])}` : fullDate(date);

  // ---------- drag & resize ----------
  const startDrag = (occ: Occ, kind: 'move' | 'resize') => {
    const s = toMin(occ.start!);
    setDrag({ id: occ.task.id, kind, start: s, end: s + occ.dur, moved: false });
  };
  useEffect(() => {
    if (!drag) return;
    const base = { ...drag };
    let y0: number | null = null;
    const pos = (e: TouchEvent | MouseEvent) => ('touches' in e ? e.touches[0]?.clientY : (e as MouseEvent).clientY);
    const move = (e: TouchEvent | MouseEvent) => {
      const y = pos(e); if (y == null) return;
      if (y0 == null) y0 = y;
      if (e.cancelable) e.preventDefault();
      const dm = Math.round(((y - y0) / HOUR_H) * 60 / SNAP) * SNAP;
      setDrag((d) => {
        if (!d) return d;
        if (base.kind === 'move') { const dur = base.end - base.start; const s = clamp(base.start + dm, 0, 1440 - dur); return { ...d, start: s, end: s + dur, moved: dm !== 0 }; }
        return { ...d, end: clamp(base.end + dm, base.start + SNAP, 1440), moved: dm !== 0 };
      });
    };
    const up = () => {
      const d = dragRef.current;
      setDrag(null);
      if (!d || !d.moved) return;
      const t0 = S.getState().tasks.find((x) => x.id === d.id); if (!t0) return;
      const occ = Object.values(occByDay).flat().find((o) => o.task.id === d.id);
      const day = occ?.date ?? date;
      const oldS = t0.start, oldE = t0.end;
      S.moveOccurrence(d.id, day, { start: fromMin(d.start), end: fromMin(Math.min(1439, d.end)) });
      ui.toast(`${t0.title}: ${fmtTime(fromMin(d.start), settings.timeFormat)}–${fmtTime(fromMin(Math.min(1439, d.end)), settings.timeFormat)}`, { tone: 'good', ms: 3200,
        action: { label: t('Скасувати'), fn: () => { const cur = S.getState().tasks.find((x) => x.repeat === 'none' && x.title === t0.title && x.start === fromMin(d.start)); if (t0.repeat === 'none') S.updateTask(t0.id, { start: oldS, end: oldE }); else if (cur) S.deleteTask(cur.id); } } });
    };
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mousemove', move, { passive: false });
    window.addEventListener('touchend', up); window.addEventListener('touchcancel', up); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('touchmove', move); window.removeEventListener('mousemove', move); window.removeEventListener('touchend', up); window.removeEventListener('touchcancel', up); window.removeEventListener('mouseup', up); };
  }, [drag?.id, drag?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const lp = useRef<number | null>(null);
  const lpStart = useRef<{ x: number; y: number } | null>(null);
  const clearLp = () => { if (lp.current) { clearTimeout(lp.current); lp.current = null; } };

  const Block = ({ l, day, narrow }: { l: Laid; day: string; narrow?: boolean }) => {
    const o = l.occ; const color = taskColor(o, cats.get(o.task.categoryId).color);
    const dragging = drag?.id === o.task.id;
    const s = dragging ? drag!.start : toMin(o.start!); const e = dragging ? drag!.end : s + o.dur;
    const top = (s / 60) * HOUR_H, h = Math.max(((e - s) / 60) * HOUR_H - 2, 22);
    const w = 100 / l.cols;
    const conflict = conflictSet.has(o.task.id);
    return (
      <div
        data-block={o.task.id}
        onClick={(ev) => { ev.stopPropagation(); if (!dragging) openTaskEditor({ id: o.task.id, date: day }); }}
        onTouchStart={(ev) => { if (narrow) return; const p = ev.touches[0]; lpStart.current = { x: p.clientX, y: p.clientY }; clearLp(); lp.current = window.setTimeout(() => { navigator.vibrate?.(8); startDrag(o, 'move'); }, 360); }}
        onTouchMove={(ev) => { const p = ev.touches[0], s0 = lpStart.current; if (s0 && Math.hypot(p.clientX - s0.x, p.clientY - s0.y) > 9) clearLp(); }}
        onTouchEnd={clearLp}
        onMouseDown={(ev) => { if (narrow || ev.button !== 0) return; const y0 = ev.clientY; const mv = (m: MouseEvent) => { if (Math.abs(m.clientY - y0) > 5) { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', cancel); startDrag(o, 'move'); } }; const cancel = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', cancel); }; window.addEventListener('mousemove', mv); window.addEventListener('mouseup', cancel); }}
        className={cx('absolute rounded-xl overflow-hidden px-2 py-1 text-left select-none', dragging ? 'z-30 shadow-[0_12px_30px_rgb(0_0_0/.45)] scale-[1.02]' : 'z-10', o.done && 'opacity-55', conflict && !dragging && 'ring-2 ring-bad')}
        style={{ top, height: h, left: `calc(${l.col * w}% + 1px)`, width: `calc(${w}% - 3px)`, background: color + (dragging ? 'ee' : '30'), borderLeft: `3.5px solid ${color}`, color: dragging ? '#fff' : undefined, transition: dragging ? 'none' : 'top .2s, height .2s' }}>
        <div className={cx('font-bold leading-tight', narrow ? 'text-[10.5px]' : 'text-[13px]', o.done && 'line-through', h < 36 && 'truncate')} style={{ color: dragging ? '#fff' : color === '#94a3b8' ? undefined : undefined }}>{o.task.title}</div>
        {h >= 38 && !narrow && <div className="text-[11.5px] opacity-80 tabular">{fmtTime(fromMin(s), settings.timeFormat)}–{fmtTime(fromMin(Math.min(1439, e)), settings.timeFormat)} · {fmtDur(e - s)}</div>}
        {!narrow && h >= 30 && (
          <div onTouchStart={(ev) => { ev.stopPropagation(); clearLp(); startDrag(o, 'resize'); }} onMouseDown={(ev) => { ev.stopPropagation(); startDrag(o, 'resize'); }}
            className="absolute bottom-0 left-0 right-0 h-4 flex items-end justify-center pb-[3px]" style={{ touchAction: 'none' }}><div className="w-7 h-[3px] rounded-full bg-current opacity-40" /></div>
        )}
      </div>
    );
  };

  const allOcc = days.flatMap((d) => occByDay[d]);
  const conflictSet = useMemo(() => { const s = new Set<string>(); days.forEach((d) => conflictIds(occByDay[d]).forEach((x) => s.add(x))); return s; }, [days, occByDay]);
  const conflictPairs = view === 'day' ? findConflicts(occByDay[date] ?? []) : [];

  const tapGrid = (e: React.MouseEvent<HTMLDivElement>, day: string) => {
    const r = e.currentTarget.getBoundingClientRect();
    const m = clamp(Math.floor((((e.clientY - r.top) / HOUR_H) * 60) / SNAP) * SNAP, 0, 1425);
    openTaskEditor({ defaults: { date: day, start: fromMin(m), end: fromMin(Math.min(1439, m + settings.defaultDuration)) } });
  };

  const nowY = (nowMin(now) / 60) * HOUR_H;
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const strip = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date, settings.weekStartsMonday), i));
  const untimed = (occByDay[date] ?? []).filter((o) => !o.start);

  // ---------- місяць ----------
  const month = useMemo(() => monthGrid(date, settings.weekStartsMonday), [date, settings.weekStartsMonday]);
  const monthOcc = useMemo(() => { if (view !== 'month') return {}; return Object.fromEntries(month.map((d) => [d, occurrencesOn(app.tasks, d, settings.defaultDuration)])) as Record<string, Occ[]>; }, [view, month, app.tasks, settings.defaultDuration]);
  const wdNames = Array.from({ length: 7 }, (_, i) => weekdayShort(addDays(startOfWeek(today, settings.weekStartsMonday), i)));

  return (
    <div className="absolute inset-0 flex flex-col" onTouchStart={onTS} onTouchEnd={onTE}>
      <div className="safe-top shrink-0 glass hair-b z-20">
        <div className="px-4 pt-2 pb-2 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-bold uppercase tracking-wider text-mute">{t('Календар')}</div>
            <div className="text-[22px] font-extrabold tracking-tight truncate cap1 leading-tight">{title}</div>
          </div>
          <button aria-label={t('Назад')} onClick={() => step(-1)} className="pressable w-10 h-10 rounded-full bg-card2/80 flex items-center justify-center"><ChevronLeft size={20} /></button>
          <button onClick={() => go(today)} className="pressable h-10 px-3.5 rounded-full bg-accent/15 text-accent text-[14px] font-bold">{t('Сьогодні')}</button>
          <button aria-label={t('Далі')} onClick={() => step(1)} className="pressable w-10 h-10 rounded-full bg-card2/80 flex items-center justify-center"><ChevronRight size={20} /></button>
        </div>
        <div className="px-4 pb-2"><Segmented<CalView> value={view} onChange={(v) => ui.setCal({ view: v })} options={[{ v: 'day', label: t('День') }, { v: 'week', label: t('Тиждень') }, { v: 'month', label: t('Місяць') }]} /></div>
        {view === 'day' && (
          <div className="flex px-2 pb-2">
            {strip.map((d) => {
              const sel = d === date; const isT = d === today; const has = app.tasks.some((x) => x.repeat === 'none' ? x.date === d : false);
              return (
                <button key={d} onClick={() => go(d)} className="pressable flex-1 flex flex-col items-center gap-1 py-1">
                  <span className="text-[11px] font-semibold text-mute uppercase">{weekdayShort(d)}</span>
                  <span className={cx('w-9 h-9 rounded-full flex items-center justify-center text-[16px] font-bold tabular', sel ? 'bg-accent text-white' : isT ? 'text-accent ring-1 ring-accent' : '')}>{parseKey(d).getDate()}</span>
                  <span className={cx('w-1 h-1 rounded-full', has ? 'bg-accent' : 'bg-transparent')} />
                </button>
              );
            })}
          </div>
        )}
        {view === 'week' && (
          <div className="flex pl-11 pr-1 pb-2">
            {days.map((d) => (
              <button key={d} onClick={() => ui.setCal({ date: d, view: 'day' })} className="pressable flex-1 flex flex-col items-center gap-0.5">
                <span className="text-[10.5px] font-semibold text-mute uppercase">{weekdayShort(d)}</span>
                <span className={cx('w-8 h-8 rounded-full flex items-center justify-center text-[15px] font-bold tabular', d === today ? 'bg-accent text-white' : d === date ? 'ring-1 ring-accent' : '')}>{parseKey(d).getDate()}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {view === 'month' ? (
        <div className="flex-1 scroll" style={{ paddingBottom: 'calc(var(--sab) + 110px)' }}>
          <div className={cx('px-3 pt-2', anim === 'l' && 'anim-fade', anim === 'r' && 'anim-fade')}>
            <div className="grid grid-cols-7 text-center text-[11px] font-bold text-mute uppercase mb-1">{wdNames.map((n) => <div key={n}>{n}</div>)}</div>
            <div className="grid grid-cols-7 gap-y-1">
              {month.map((d) => {
                const inM = d.slice(0, 7) === date.slice(0, 7); const list = monthOcc[d] ?? []; const isT = d === today; const sel = d === date;
                const colors = [...new Set(list.map((o) => taskColor(o, cats.get(o.task.categoryId).color)))].slice(0, 3);
                return (
                  <button key={d} onClick={() => go(d)} onDoubleClick={() => ui.setCal({ date: d, view: 'day' })} className={cx('pressable h-[52px] rounded-2xl flex flex-col items-center justify-center gap-1', sel ? 'bg-accent/18' : '', !inM && 'opacity-35')}>
                    <span className={cx('w-8 h-8 rounded-full flex items-center justify-center text-[16px] font-semibold tabular', isT ? 'bg-accent text-white' : sel ? 'text-accent' : '')}>{parseKey(d).getDate()}</span>
                    <span className="flex gap-[3px] h-[5px]">{colors.map((c) => <i key={c} className="w-[5px] h-[5px] rounded-full" style={{ background: c }} />)}{list.length > 3 && <i className="text-[8px] leading-none text-mute not-italic">+</i>}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="px-4 mt-4">
            <div className="flex items-center justify-between mb-2"><div className="font-extrabold text-[18px] cap1">{fullDate(date)}</div>
              <button onClick={() => ui.setCal({ view: 'day' })} className="text-accent text-[14px] font-semibold pressable">{t('Відкрити день')}</button></div>
            <div className="flex flex-col gap-2">
              {(monthOcc[date] ?? []).map((o) => <TaskRow key={o.task.id + o.date} occ={o} />)}
              {!(monthOcc[date] ?? []).length && <div className="text-center text-mute py-6 text-[14px]">{t('На цей день нічого не заплановано')}</div>}
              <Btn variant="soft" icon={<Plus size={18} />} onClick={() => openTaskEditor({ defaults: { date } })}>{t('Додати на цей день')}</Btn>
            </div>
          </div>
        </div>
      ) : (
        <div ref={scroller} className={cx('flex-1 relative', drag ? 'overflow-hidden' : 'scroll')} style={{ paddingBottom: 'calc(var(--sab) + 100px)' }}>
          {view === 'day' && (conflictPairs.length > 0 || untimed.length > 0) && (
            <div className="px-4 pt-3 flex flex-col gap-2">
              {conflictPairs.length > 0 && (
                <div className="rounded-2xl bg-bad/12 text-bad px-3.5 py-2.5 text-[13px] flex gap-2 leading-snug anim-rise">
                  <AlertTriangle size={17} className="shrink-0 mt-0.5" />
                  <div><b>{t('Накладання')} ({conflictPairs.length}):</b> {conflictPairs.slice(0, 3).map(([a, b]) => `«${a.task.title}» ↔ «${b.task.title}»`).join('; ')}
                    <button onClick={() => ui.push('planner', { date })} className="ml-2 underline font-semibold inline-flex items-center gap-1"><Wand2 size={12} />{t('Smart Planner')}</button></div>
                </div>
              )}
              {untimed.length > 0 && (
                <div><div className="text-[12px] font-bold uppercase tracking-wider text-mute mb-1.5">{t('Без часу')}</div>
                  <div className="flex flex-col gap-1.5">{untimed.map((o) => <TaskRow key={o.task.id + o.date} occ={o} />)}</div></div>
              )}
            </div>
          )}
          <div className={cx('relative flex mt-2', anim === 'l' && 'anim-fade', anim === 'r' && 'anim-fade')} style={{ height: TOTAL_H }}>
            <div className="w-11 shrink-0 relative">
              {hours.map((h) => <div key={h} className="absolute right-2 text-[11px] text-mute tabular -translate-y-1/2" style={{ top: h * HOUR_H }}>{h === 0 ? '' : settings.timeFormat === '24' ? `${String(h).padStart(2, '0')}:00` : fmtTime(`${String(h).padStart(2, '0')}:00`, '12')}</div>)}
            </div>
            <div className="flex-1 relative">
              {hours.map((h) => <div key={h} className="absolute left-0 right-0 hair-t" style={{ top: h * HOUR_H }} />)}
              <div className="absolute inset-0 flex">
                {days.map((d) => (
                  <div key={d} className={cx('relative flex-1', view === 'week' && 'hair-b border-l border-line/10')} onClick={(e) => tapGrid(e, d)}>
                    {layout(occByDay[d]).map((l) => <Block key={l.occ.task.id + d} l={l} day={d} narrow={view === 'week'} />)}
                    {d === today && <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: nowY }}><div className="h-[2px] bg-bad" /><div className="absolute -left-1 -top-[4px] w-[10px] h-[10px] rounded-full bg-bad" /></div>}
                  </div>
                ))}
              </div>
              {drag && (
                <div className="fixed left-1/2 -translate-x-1/2 z-50 glass hair rounded-full px-4 py-2 text-[15px] font-bold tabular shadow-xl" style={{ top: 'calc(var(--sat) + 70px)' }}>
                  {fmtTime(fromMin(drag.start), settings.timeFormat)} – {fmtTime(fromMin(Math.min(1439, drag.end)), settings.timeFormat)}
                </div>
              )}
            </div>
          </div>
          {!allOcc.some((o) => o.start) && !untimed.length && (
            <div className="absolute left-0 right-0 top-[130px] text-center text-mute text-[14px] px-10 pointer-events-none">{t('Торкніться потрібної години, щоб створити подію. Утримуйте подію, щоб перетягнути.')}</div>
          )}
        </div>
      )}
      <span className="hidden">{fmt(date, { day: 'numeric' }) && weekday(date)}{getUI().tab}</span>
    </div>
  );
};
