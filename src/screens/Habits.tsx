import { useState } from 'react';
import { Plus, Repeat2, Trash2 } from 'lucide-react';
import { useApp } from '../lib/store';
import * as S from '../lib/store';
import { Btn, Card, Empty, Field, PageShell, SheetFrame, TextInput, cx } from '../ui/kit';
import { ui } from '../ui/uiStore';
import { addDays, rangeDays, todayKey, weekday, weekdayShort, dayMonthShort } from '../lib/dates';
import { habitScheduled, habitStreak } from '../lib/score';
import { PALETTE } from '../lib/defaults';
import type { Habit } from '../lib/types';
import { t } from '../lib/i18n';

const EMOJIS = ['💧', '🏃', '📖', '🧘', '🥗', '💤', '✍️', '🎸', '🧠', '🦷', '🚶', '💊', '🌿', '📵', '☀️', '✨'];
const WD = [0, 1, 2, 3, 4, 5, 6];

const rate = (h: Habit, days: string[]) => { const sc = days.filter((d) => habitScheduled(h, d) && d <= todayKey()); return sc.length ? Math.round((sc.filter((d) => h.log[d]).length / sc.length) * 100) : null; };

const HabitEditor = ({ habit, close }: { habit?: Habit; close: () => void }) => {
  const [name, setName] = useState(habit?.name ?? '');
  const [emoji, setEmoji] = useState(habit?.emoji ?? '✨');
  const [color, setColor] = useState(habit?.color ?? '#22c55e');
  const [days, setDays] = useState<number[]>(habit?.days ?? WD);
  const save = () => {
    if (!name.trim() || !days.length) return;
    if (habit) S.updateHabit(habit.id, { name: name.trim(), emoji, color, days }); else S.addHabit({ name: name.trim(), emoji, color, days });
    close();
  };
  const refDay = addDays(todayKey(), -weekday(todayKey()));
  return (
    <SheetFrame title={habit ? t('Звичка') : t('Нова звичка')} onClose={close} footer={<Btn full disabled={!name.trim() || !days.length} onClick={save}>{t('Зберегти')}</Btn>}>
      <div className="flex flex-col gap-4">
        <TextInput autoFocus={!habit} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Наприклад: пити воду')} />
        <Field label={t('Іконка')}><div className="flex flex-wrap gap-2">{EMOJIS.map((e) => <button key={e} onClick={() => setEmoji(e)} className={cx('pressable w-11 h-11 rounded-2xl text-[22px]', emoji === e ? 'bg-accent/20 ring-2 ring-accent' : 'bg-card2')}>{e}</button>)}</div></Field>
        <Field label={t('Колір')}><div className="flex gap-2.5 flex-wrap">{PALETTE.map((c) => <button key={c} aria-label={c} onClick={() => setColor(c)} className="pressable w-8 h-8 rounded-full" style={{ background: c, boxShadow: color === c ? '0 0 0 3px rgb(var(--bg)), 0 0 0 5px ' + c : 'none' }} />)}</div></Field>
        <Field label={t('Частота')}>
          <div className="flex gap-1.5">{WD.map((d) => { const on = days.includes(d); return <button key={d} onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d].sort())} className={cx('pressable flex-1 h-11 rounded-xl text-[13px] font-bold uppercase', on ? 'bg-accent text-white' : 'bg-card2 text-mute')}>{weekdayShort(addDays(refDay, d)).slice(0, 2)}</button>; })}</div>
          <div className="flex gap-2 mt-2"><button onClick={() => setDays(WD)} className="text-[13px] text-accent font-semibold pressable">{t('Щодня')}</button><button onClick={() => setDays([0, 1, 2, 3, 4])} className="text-[13px] text-accent font-semibold pressable">{t('Будні')}</button><button onClick={() => setDays([5, 6])} className="text-[13px] text-accent font-semibold pressable">{t('Вихідні')}</button></div>
        </Field>
        {habit && <Btn variant="danger" icon={<Trash2 size={17} />} onClick={async () => { if (await ui.confirm({ title: t('Видалити звичку?'), message: t('Історія виконання також буде видалена.'), ok: t('Видалити'), danger: true })) { S.deleteHabit(habit.id); close(); } }}>{t('Видалити звичку')}</Btn>}
      </div>
    </SheetFrame>
  );
};

const HabitDetail = ({ id, close }: { id: string; close: () => void }) => {
  const app = useApp();
  const h = app.habits.find((x) => x.id === id);
  if (!h) return null;
  const today = todayKey();
  const days = rangeDays(addDays(today, -69), today);
  const st = habitStreak(h);
  const r30 = rate(h, days.slice(-30)), r7 = rate(h, days.slice(-7));
  const total = Object.keys(h.log).length;
  return (
    <SheetFrame title={`${h.emoji} ${h.name}`} onClose={close} right={<button onClick={() => { close(); setTimeout(() => ui.sheet((c) => <HabitEditor habit={h} close={c} />), 300); }} className="pressable text-accent font-semibold text-[15px] mr-1">{t('Змінити')}</button>}>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[[st.current, t('Серія')], [st.best, t('Рекорд')], [r7 == null ? '—' : r7 + '%', t('7 днів')], [r30 == null ? '—' : r30 + '%', t('30 днів')]].map(([v, l]) => <Card key={String(l)} className="p-2.5 text-center"><div className="text-[19px] font-extrabold tabular">{v}</div><div className="text-[11px] text-mute">{l}</div></Card>)}
      </div>
      <div className="text-[12px] font-bold uppercase tracking-wider text-mute mb-2">{t('Історія')} · 10 {t('тижнів')} · {total} {t('виконань')}</div>
      <div className="grid grid-flow-col grid-rows-7 gap-1.5 justify-start overflow-x-auto pb-2">
        {(() => { const first = weekday(days[0]); return [...Array(first).fill(null), ...days].map((d, i) => d === null ? <div key={'p' + i} className="w-6 h-6" /> : (
          <button key={d} onClick={() => S.toggleHabit(h.id, d)} aria-label={dayMonthShort(d)} className="pressable w-6 h-6 rounded-md" style={{ background: h.log[d] ? h.color : habitScheduled(h, d) ? 'rgb(var(--line) / .1)' : 'transparent', outline: d === today ? '2px solid rgb(var(--accent))' : 'none', opacity: habitScheduled(h, d) || h.log[d] ? 1 : 0.35 }} />
        )); })()}
      </div>
      <div className="text-[12px] text-mute">{t('Торкніться клітинки, щоб змінити відмітку за день.')}</div>
    </SheetFrame>
  );
};

export const Habits = () => {
  const app = useApp();
  const today = todayKey();
  const week = rangeDays(addDays(today, -6), today);
  const list = app.habits.filter((h) => !h.archived);
  return (
    <PageShell title={t('Звички')} right={<button aria-label={t('Додати')} onClick={() => ui.sheet((c) => <HabitEditor close={c} />)} className="pressable w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center"><Plus size={21} /></button>}>
      {!list.length ? <Empty icon={<Repeat2 size={30} />} title={t('Звичок ще немає')} text={t('Додайте першу — наприклад «Пити воду» чи «Читати 20 хвилин».')} action={<Btn onClick={() => ui.sheet((c) => <HabitEditor close={c} />)}>{t('Створити звичку')}</Btn>} /> : (
        <div className="flex flex-col gap-3">
          {list.map((h) => {
            const st = habitStreak(h); const sched = habitScheduled(h, today); const on = !!h.log[today];
            return (
              <Card key={h.id} className="p-4">
                <div className="flex items-center gap-3" onClick={() => ui.sheet((c) => <HabitDetail id={h.id} close={c} />)}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[24px]" style={{ background: h.color + '26' }}>{h.emoji}</div>
                  <div className="flex-1 min-w-0"><div className="font-bold text-[17px] truncate">{h.name}</div>
                    <div className="text-[12.5px] text-mute">🔥 {st.current} · {t('рекорд')} {st.best} · {rate(h, rangeDays(addDays(today, -29), today)) ?? '—'}{rate(h, rangeDays(addDays(today, -29), today)) != null ? '%' : ''}</div></div>
                  {sched ? <button aria-label={on ? t('Зняти відмітку') : t('Відмітити')} onClick={(e) => { e.stopPropagation(); S.toggleHabit(h.id, today); }} className={cx('pressable w-11 h-11 rounded-full flex items-center justify-center text-[20px] border-2')} style={{ borderColor: h.color, background: on ? h.color : 'transparent', color: on ? '#fff' : h.color }}>✓</button> : <span className="text-[12px] text-mute">{t('не сьогодні')}</span>}
                </div>
                <div className="flex gap-1.5 mt-3">{week.map((d) => <button key={d} onClick={() => S.toggleHabit(h.id, d)} className="pressable flex-1 flex flex-col items-center gap-1" aria-label={dayMonthShort(d)}>
                  <span className="text-[10px] text-mute uppercase">{weekdayShort(d).slice(0, 2)}</span>
                  <span className="w-full h-7 rounded-lg" style={{ background: h.log[d] ? h.color : 'rgb(var(--line) / .08)', opacity: habitScheduled(h, d) || h.log[d] ? 1 : 0.3 }} /></button>)}</div>
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
};
