import { useRef, useState } from 'react';
import { AlertTriangle, Bell, CalendarArrowDown, Repeat, Star, Trash2 } from 'lucide-react';
import type { Occ } from '../lib/types';
import { useApp } from '../lib/store';
import { Check2, cx, Btn, SheetFrame } from './kit';
import { catLabel, useCats } from './hooks';
import { fmtDur, fmtTime, todayKey, relDay, dayMonthShort, nowMin, toMin } from '../lib/dates';
import { ui } from './uiStore';
import { postpone, registerChoiceBody, removeTask, toggleTask } from './actions';
import { openTaskEditor } from '../screens/TaskEditor';
import { t } from '../lib/i18n';

registerChoiceBody((pick) => (
  <SheetFrame>
    <div className="text-center pb-4"><div className="text-[20px] font-extrabold">{t('Повторюване завдання')}</div><div className="text-[14px] text-mute mt-1">{t('Що видалити?')}</div></div>
    <div className="flex flex-col gap-2">
      <Btn variant="danger" full onClick={() => pick('one')}>{t('Тільки цю подію')}</Btn>
      <Btn variant="danger" full onClick={() => pick('all')}>{t('Усю серію')}</Btn>
      <Btn variant="ghost" full onClick={() => pick(null)}>{t('Скасувати')}</Btn>
    </div>
  </SheetFrame>
));

export const taskColor = (o: Occ, catColor: string) => o.task.color || catColor;

export const TaskRow = ({ occ, showDate, conflict, onOpen }: { occ: Occ; showDate?: boolean; conflict?: boolean; onOpen?: () => void }) => {
  const { settings } = useApp();
  const cats = useCats();
  const cat = cats.get(occ.task.categoryId);
  const color = taskColor(occ, cat.color);
  const t0 = occ.task;
  const today = todayKey();
  const overdue = !occ.done && t0.repeat === 'none' && !!t0.date && (t0.date < today || (t0.date === today && occ.start && toMin(occ.start) + occ.dur < nowMin()));

  const [dx, setDx] = useState(0);
  const g = useRef<{ x: number; y: number; dir: '' | 'h' | 'v'; base: number } | null>(null);
  const OPEN = -148;
  const open = dx <= OPEN + 4;
  // stopPropagation: горизонтальний свайп рядка не повинен перемикати дату в календарі
  const onStart = (e: React.TouchEvent) => { e.stopPropagation(); g.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dir: '', base: dx }; };
  const onMove = (e: React.TouchEvent) => {
    const c = g.current; if (!c) return;
    const mx = e.touches[0].clientX - c.x, my = e.touches[0].clientY - c.y;
    if (!c.dir) { if (Math.abs(mx) > 8 || Math.abs(my) > 8) c.dir = Math.abs(mx) > Math.abs(my) ? 'h' : 'v'; }
    if (c.dir === 'h') setDx(Math.max(OPEN - 30, Math.min(0, c.base + mx)));
  };
  const onEnd = (e: React.TouchEvent) => { e.stopPropagation(); const c = g.current; g.current = null; if (c?.dir === 'h') setDx(dx < OPEN / 2 ? OPEN : 0); };

  const meta: string[] = [];
  if (showDate && t0.date) meta.push(relDay(t0.date, today).length > 12 ? dayMonthShort(t0.date) : relDay(t0.date, today));
  if (occ.start) meta.push(`${fmtTime(occ.start, settings.timeFormat)}${t0.end ? '–' + fmtTime(t0.end, settings.timeFormat) : ''}`);
  if (occ.start ? !t0.end : true) meta.push(fmtDur(occ.dur));
  else if (t0.start && t0.end) meta.push(fmtDur(occ.dur));

  return (
    <div className="relative overflow-hidden rounded-[18px]">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: 148 }}>
        <button onClick={() => { setDx(0); postpone(t0, occ.date); }} className="flex-1 bg-warn/90 text-white flex flex-col items-center justify-center gap-1 text-[11px] font-bold"><CalendarArrowDown size={20} />{t('Завтра')}</button>
        <button onClick={() => { setDx(0); removeTask(t0, occ.date); }} className="flex-1 bg-bad text-white flex flex-col items-center justify-center gap-1 text-[11px] font-bold"><Trash2 size={20} />{t('Видалити')}</button>
      </div>
      <div onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
        onClick={() => { if (open) { setDx(0); return; } (onOpen ?? (() => openTaskEditor({ id: t0.id, date: occ.date })))(); }}
        className={cx('relative flex items-center gap-3 pl-3 pr-3 py-3 bg-card cursor-pointer', conflict && 'ring-1 ring-bad/60')}
        style={{ transform: `translateX(${dx}px)`, transition: g.current ? 'none' : 'transform .28s cubic-bezier(.2,.9,.25,1)' }}>
        <div className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full" style={{ background: color }} />
        <Check2 done={occ.done} color={color} onClick={(e) => { e.stopPropagation(); toggleTask(t0, occ.date); }} />
        <div className="flex-1 min-w-0">
          <div className={cx('text-[16px] font-semibold leading-snug truncate', occ.done && 'line-through text-mute')}>{t0.title}</div>
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[12.5px] text-mute mt-0.5">
            {meta.length > 0 && <span className={cx('tabular', overdue && 'text-bad font-semibold')}>{overdue && !occ.start ? t('Прострочено') + ' · ' : ''}{meta.join(' · ')}</span>}
            <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: cat.color }} />{catLabel(cat)}</span>
            {t0.priority > 0 && <span className="font-bold" style={{ color: ['', '#38bdf8', '#f59e0b', '#f43f5e'][t0.priority] }}>{'!'.repeat(t0.priority)}</span>}
            {t0.repeat !== 'none' && <Repeat size={12} />}
            {t0.remind.length > 0 && <Bell size={12} />}
            {t0.important && <Star size={12} className="text-warn" fill="currentColor" />}
            {conflict && <span className="flex items-center gap-0.5 text-bad font-semibold"><AlertTriangle size={12} />{t('Накладання')}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export const openDayFromRow = (d: string) => ui.openDay(d);
