import { useMemo, useState } from 'react';
import { CalendarClock, Sparkles, Timer } from 'lucide-react';
import { SheetFrame, TextInput, Btn, cx } from '../ui/kit';
import { parseCapture, type Parsed } from '../lib/nlp';
import * as S from '../lib/store';
import { useApp } from '../lib/store';
import { fmtDur, fmtTime, relDay, todayKey } from '../lib/dates';
import { ui, getUI } from '../ui/uiStore';
import { openTaskEditor } from './TaskEditor';
import { catLabel, useCats } from '../ui/hooks';
import { t } from '../lib/i18n';

export const openQuickCapture = (opts: { date?: string; text?: string } = {}) =>
  ui.sheet((close) => <QuickCapture {...opts} close={close} />);

const EXAMPLES = ['Завтра о 18:00 тренування на годину', 'Купити продукти сьогодні ввечері', 'У п’ятницю о 10 зустріч з клієнтом, нагадай за 15 хв', 'Щодня о 7:30 зарядка'];

export const toTaskPatch = (p: Parsed, defaults: { defaultReminders: number[] }) => ({
  title: p.title, date: p.date, start: p.start, end: p.end,
  estimate: p.start && p.end ? null : p.duration, categoryId: p.categoryId ?? 'personal',
  priority: (p.priority ?? 0) as 0 | 1 | 2 | 3, important: p.important, repeat: p.repeat,
  remind: p.start ? (p.remind ?? [...defaults.defaultReminders]) : [],
});

export const QuickCapture = ({ close, date, text }: { close: () => void; date?: string; text?: string }) => {
  const { settings } = useApp();
  const cats = useCats();
  const [val, setVal] = useState(text ?? '');
  const base = date ?? (getUI().tab === 'calendar' ? getUI().calDate : todayKey());
  const items = useMemo(() => parseCapture(val, new Date(), base), [val, base]);
  const [off, setOff] = useState<Set<number>>(new Set());
  const active = items.filter((_, i) => !off.has(i));

  const add = () => {
    if (!active.length) return;
    for (const p of active) {
      // якщо тривалість є, а кінець не обчислився (>24:00) — лишаємо оцінку
      S.addTask(toTaskPatch(p, settings));
    }
    ui.toast(active.length > 1 ? `${t('Додано завдань')}: ${active.length}` : t('Завдання додано'), { tone: 'good', ms: 2000 });
    close();
  };

  return (
    <SheetFrame title={t('Швидке додавання')} onClose={close}
      footer={<div className="flex gap-2">
        <Btn variant="ghost" onClick={() => { close(); openTaskEditor({ defaults: active[0] ? toTaskPatch(active[0], settings) : { date: base, title: val } }); }}>{t('Докладно')}</Btn>
        <Btn full disabled={!active.length} onClick={add}>{active.length > 1 ? `${t('Додати')} (${active.length})` : t('Додати')}</Btn>
      </div>}>
      <TextInput autoFocus value={val} onChange={(e) => { setVal(e.target.value); setOff(new Set()); }} enterKeyHint="done"
        placeholder={t('Завтра о 18:00 тренування на годину')} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} className="!h-14 !text-[18px]" />
      <div className="text-[12.5px] text-mute mt-2 px-1 flex items-center gap-1.5"><Sparkles size={13} />{t('Розпізнаю дату, час, тривалість, категорію й повторення')}</div>

      <div className="mt-4 flex flex-col gap-2.5">
        {items.map((p, i) => {
          const cat = cats.get(p.categoryId ?? 'personal');
          const on = !off.has(i);
          return (
            <div key={i} onClick={() => setOff((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
              className={cx('card p-3.5 pressable anim-rise cursor-pointer', !on && 'opacity-40')}>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: cat.color }} /><div className="font-bold text-[16px] flex-1 truncate">{p.title}</div><div className="text-[12px] text-mute">{catLabel(cat)}</div></div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13.5px] text-mute mt-1.5">
                <span className="flex items-center gap-1"><CalendarClock size={14} />{p.date ? relDay(p.date) : t('Без дати')}{p.start ? ` · ${fmtTime(p.start, settings.timeFormat)}${p.end ? '–' + fmtTime(p.end, settings.timeFormat) : ''}${p.fuzzyTime ? ' (≈)' : ''}` : ''}</span>
                {p.duration && <span className="flex items-center gap-1"><Timer size={14} />{fmtDur(p.duration)}</span>}
                {p.repeat !== 'none' && <span>🔁 {({ daily: t('щодня'), weekdays: t('будні'), weekly: t('щотижня'), monthly: t('щомісяця') } as any)[p.repeat]}</span>}
                {p.remind && <span>🔔 {p.remind[0]} {t('хв')}</span>}
                {p.priority ? <span className="font-bold">{'!'.repeat(p.priority)}</span> : null}
              </div>
            </div>
          );
        })}
        {!items.length && (
          <div className="flex flex-wrap gap-2 pt-1">
            {EXAMPLES.map((e) => <button key={e} onClick={() => setVal(e)} className="pressable text-left text-[13.5px] text-mute bg-card2 rounded-2xl px-3 py-2">{e}</button>)}
          </div>
        )}
      </div>
    </SheetFrame>
  );
};
