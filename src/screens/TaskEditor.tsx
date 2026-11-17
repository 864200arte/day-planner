import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Bell, CalendarArrowDown, Copy, Plus, Trash2, X } from 'lucide-react';
import type { Repeat, Task } from '../lib/types';
import * as S from '../lib/store';
import { useApp } from '../lib/store';
import { Btn, Chip, Field, SheetFrame, TextArea, TextInput, Toggle, cx } from '../ui/kit';
import { catLabel, PRIORITIES, useCats } from '../ui/hooks';
import { addDays, fmtDur, fmtTime, fromMin, todayKey, toMin } from '../lib/dates';
import { occurrencesOn, taskDur } from '../lib/recur';
import { REMIND_OPTIONS } from '../lib/reminders';
import { ui } from '../ui/uiStore';
import { PALETTE } from '../lib/defaults';
import { postpone, removeTask, toggleTask } from '../ui/actions';
import { t } from '../lib/i18n';

export const openTaskEditor = (p: { id?: string; date?: string; defaults?: Partial<Task> }) => ui.sheet((close) => <TaskEditor {...p} close={close} />);

const DURS = [15, 30, 45, 60, 90, 120, 180];
const REPEATS: { v: Repeat; label: string }[] = [
  { v: 'none', label: 'Ніколи' }, { v: 'daily', label: 'Щодня' }, { v: 'weekdays', label: 'Будні' }, { v: 'weekly', label: 'Щотижня' }, { v: 'monthly', label: 'Щомісяця' },
];

export const TaskEditor = ({ id, date: occDate, defaults, close }: { id?: string; date?: string; defaults?: Partial<Task>; close: () => void }) => {
  const app = useApp();
  const cats = useCats();
  const existing = id ? app.tasks.find((x) => x.id === id) : undefined;
  const today = todayKey();
  const [d, setD] = useState<Task>(() => existing ? { ...existing } : S.getState().tasks && ({
    id: '', title: '', notes: '', date: today, start: null, end: null, estimate: null, categoryId: 'personal', priority: 0, important: false, color: null,
    remind: [], repeat: 'none', repeatUntil: null, exceptions: [], doneAt: null, doneDates: {}, movedCount: 0, moves: [], createdAt: 0, updatedAt: 0, ...defaults,
  } as Task));
  const [err, setErr] = useState('');
  const touchedRemind = useRef(!!existing || !!defaults?.remind);
  const set = (p: Partial<Task>) => setD((x) => ({ ...x, ...p }));
  const dur = taskDur(d, app.settings.defaultDuration);
  const hasDur = !!(d.start && d.end) || d.estimate != null;
  const date = occDate ?? d.date ?? today;
  const done = existing ? (existing.repeat === 'none' ? existing.doneAt != null : !!existing.doneDates[date]) : false;

  const setStart = (v: string) => {
    if (!v) { set({ start: null, end: null }); return; }
    const len = d.start && d.end ? toMin(d.end) - toMin(d.start) : d.estimate ?? app.settings.defaultDuration;
    const patch: Partial<Task> = { start: v, end: fromMin(Math.min(1439, toMin(v) + Math.max(5, len))), estimate: null };
    if (!d.start && !touchedRemind.current && !d.remind.length) patch.remind = [...app.settings.defaultReminders];
    set(patch);
  };
  const setDur = (m: number) => {
    if (d.start) set({ end: fromMin(Math.min(1439, toMin(d.start) + m)), estimate: null });
    else set({ estimate: m });
  };

  const conflicts = useMemo(() => {
    if (!d.start || !d.end || !d.date) return [];
    const s = toMin(d.start), e = toMin(d.end);
    return occurrencesOn(app.tasks, d.date, app.settings.defaultDuration)
      .filter((o) => o.task.id !== d.id && o.start && !o.done && toMin(o.start) < e && toMin(o.start) + o.dur > s);
  }, [d.start, d.end, d.date, d.id, app.tasks, app.settings.defaultDuration]);

  const save = () => {
    const title = d.title.trim();
    if (!title) { setErr(t('Введіть назву завдання')); return; }
    if (d.start && d.end && toMin(d.end) <= toMin(d.start)) { setErr(t('Час завершення має бути пізніше за початок')); return; }
    if (d.repeat !== 'none' && !d.date) { setErr(t('Для повторення потрібна дата початку')); return; }
    const patch: Partial<Task> = {
      title, notes: d.notes.trim(), date: d.date, start: d.start, end: d.end, estimate: d.start && d.end ? null : d.estimate,
      categoryId: d.categoryId, priority: d.priority, important: d.important, color: d.color,
      remind: d.start ? d.remind : [], repeat: d.repeat, repeatUntil: d.repeat === 'none' ? null : d.repeatUntil,
    };
    if (existing) {
      const moved = existing.repeat === 'none' && existing.date && d.date && existing.date !== d.date;
      S.updateTask(existing.id, moved ? { ...patch, movedCount: existing.movedCount + 1, moves: [...existing.moves, { from: existing.date, to: d.date, at: Date.now() }] } : patch);
      ui.toast(t('Збережено'), { tone: 'good', ms: 1800 });
    } else {
      S.addTask(patch);
      ui.toast(t('Завдання додано'), { tone: 'good', ms: 1800 });
    }
    close();
  };

  const duplicate = () => {
    if (!existing) return;
    const { id: _i, doneAt: _d, doneDates: _dd, moves: _m, movedCount: _mc, ...rest } = existing;
    S.addTask({ ...rest, title: existing.title + ' (' + t('копія') + ')', createdAt: undefined, updatedAt: undefined } as any);
    ui.toast(t('Створено копію')); close();
  };

  const toggleRemind = (v: number) => { touchedRemind.current = true; set({ remind: d.remind.includes(v) ? d.remind.filter((x) => x !== v) : [...d.remind, v].sort((a, b) => a - b) }); };

  return (
    <SheetFrame title={existing ? t('Завдання') : t('Нове завдання')} onClose={close}
      footer={<div className="flex gap-2"><Btn full onClick={save}>{existing ? t('Зберегти') : t('Додати')}</Btn></div>}>
      <div className="flex flex-col gap-4">
        <div>
          <TextInput autoFocus={!existing} placeholder={t('Назва')} value={d.title} onChange={(e) => { set({ title: e.target.value }); setErr(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} className="!text-[19px] font-semibold" enterKeyHint="done" />
          {err && <div className="text-bad text-[13px] mt-1.5 px-1 font-medium">{err}</div>}
        </div>
        <TextArea rows={2} placeholder={t('Опис або нотатки')} value={d.notes} onChange={(e) => set({ notes: e.target.value })} />

        {existing && (
          <div className="flex gap-2">
            <Btn variant={done ? 'ghost' : 'good'} size="sm" full onClick={() => { toggleTask(existing, date); close(); }}>{done ? t('Позначити невиконаним') : t('Позначити виконаним')}</Btn>
          </div>
        )}

        <Field label={t('Дата')}>
          <div className="flex gap-2 items-center">
            <input type="date" value={d.date ?? ''} onChange={(e) => set({ date: e.target.value || null })} className="flex-1 h-12 px-4 rounded-2xl bg-card2 outline-none min-w-0" />
            <Chip active={d.date === today} onClick={() => set({ date: today })}>{t('Сьогодні')}</Chip>
            <Chip active={d.date === addDays(today, 1)} onClick={() => set({ date: addDays(today, 1) })}>{t('Завтра')}</Chip>
          </div>
          {d.date && <button className="text-[13px] text-mute px-1 mt-1.5 pressable" onClick={() => set({ date: null, repeat: 'none' })}>{t('Без дати')} ✕</button>}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('Початок')}>
            <div className="relative"><input type="time" value={d.start ?? ''} onChange={(e) => setStart(e.target.value)} className="w-full h-12 px-4 rounded-2xl bg-card2 outline-none" />
              {d.start && <button aria-label="clear" onClick={() => setStart('')} className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-mute/30 flex items-center justify-center"><X size={13} /></button>}</div>
          </Field>
          <Field label={t('Завершення')}>
            <input type="time" value={d.end ?? ''} disabled={!d.start} onChange={(e) => set({ end: e.target.value || null })} className="w-full h-12 px-4 rounded-2xl bg-card2 outline-none disabled:opacity-40" />
          </Field>
        </div>

        <Field label={`${t('Тривалість')}${hasDur ? ' · ' + fmtDur(dur) : ''}`}>
          <div className="flex gap-2 overflow-x-auto scroll -mx-5 px-5 pb-1">
            {DURS.map((m) => <Chip key={m} active={hasDur && dur === m} onClick={() => setDur(m)}>{fmtDur(m)}</Chip>)}
          </div>
        </Field>

        {conflicts.length > 0 && (
          <div className="rounded-2xl bg-bad/12 text-bad p-3 text-[13.5px] flex gap-2.5 leading-snug">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div><b>{t('Накладання за часом')}:</b> {conflicts.map((o) => `${o.task.title} (${fmtTime(o.start, app.settings.timeFormat)})`).join(', ')}</div>
          </div>
        )}

        <Field label={t('Категорія')}>
          <div className="flex flex-wrap gap-2">
            {cats.list.map((c) => <Chip key={c.id} active={d.categoryId === c.id} color={c.color} onClick={() => set({ categoryId: c.id })}><span className="w-2 h-2 rounded-full" style={{ background: c.color }} />{catLabel(c)}</Chip>)}
            <Chip onClick={() => ui.push('categories')}><Plus size={15} />{t('Нова')}</Chip>
          </div>
        </Field>

        <Field label={t('Пріоритет')}>
          <div className="flex gap-2">
            {PRIORITIES.map((p) => <Chip key={p.v} active={d.priority === p.v} color={p.color} onClick={() => set({ priority: p.v as Task['priority'] })} className="flex-1 justify-center">{p.v === 0 ? t('Немає') : p.short}</Chip>)}
          </div>
        </Field>

        <div className="flex items-center justify-between px-1">
          <div><div className="text-[16px] font-semibold">{t('Важливе')}</div><div className="text-[12.5px] text-mute">{t('Позначка ⭐ та вищий пріоритет у плануванні')}</div></div>
          <Toggle checked={d.important} onChange={(v) => set({ important: v })} label={t('Важливе')} />
        </div>

        <Field label={t('Нагадування')} hint={d.start ? undefined : t('Додайте час початку, щоб налаштувати нагадування')}>
          <div className={cx('flex flex-wrap gap-2', !d.start && 'opacity-40 pointer-events-none')}>
            {REMIND_OPTIONS.map((o) => <Chip key={o.v} active={d.remind.includes(o.v)} onClick={() => toggleRemind(o.v)}><Bell size={13} />{t(o.label)}</Chip>)}
          </div>
        </Field>

        <Field label={t('Повторення')}>
          <div className="flex flex-wrap gap-2">
            {REPEATS.map((r) => <Chip key={r.v} active={d.repeat === r.v} onClick={() => set({ repeat: r.v, date: r.v !== 'none' && !d.date ? today : d.date })}>{t(r.label)}</Chip>)}
          </div>
          {d.repeat !== 'none' && (
            <div className="flex items-center gap-2 mt-2"><span className="text-[13px] text-mute">{t('Повторювати до')}</span>
              <input type="date" value={d.repeatUntil ?? ''} min={d.date ?? undefined} onChange={(e) => set({ repeatUntil: e.target.value || null })} className="h-10 px-3 rounded-xl bg-card2 outline-none flex-1" /></div>
          )}
          {existing && existing.repeat !== 'none' && <div className="text-[12px] text-mute mt-1.5 px-1">{t('Зміни застосовуються до всієї серії')}</div>}
        </Field>

        <Field label={t('Колір')}>
          <div className="flex gap-2.5 flex-wrap items-center">
            <button onClick={() => set({ color: null })} className={cx('pressable h-9 px-3 rounded-full text-[13px] font-semibold', d.color == null ? 'bg-accent/15 text-accent' : 'bg-card2 text-mute')}>{t('Як у категорії')}</button>
            {PALETTE.map((c) => <button key={c} aria-label={c} onClick={() => set({ color: c })} className="pressable w-8 h-8 rounded-full" style={{ background: c, boxShadow: d.color === c ? '0 0 0 3px rgb(var(--bg)), 0 0 0 5px ' + c : 'none' }} />)}
          </div>
        </Field>

        {existing && (
          <div className="flex gap-2 pt-1">
            <Btn variant="ghost" size="sm" full icon={<Copy size={16} />} onClick={duplicate}>{t('Дублювати')}</Btn>
            <Btn variant="ghost" size="sm" full icon={<CalendarArrowDown size={16} />} onClick={() => { postpone(existing, date); close(); }}>{t('На завтра')}</Btn>
            <Btn variant="danger" size="sm" full icon={<Trash2 size={16} />} onClick={async () => { if (await removeTask(existing, date)) close(); }}>{t('Видалити')}</Btn>
          </div>
        )}
      </div>
    </SheetFrame>
  );
};
