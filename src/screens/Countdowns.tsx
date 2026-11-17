import { useState } from 'react';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../lib/store';
import * as S from '../lib/store';
import { Btn, Card, Empty, Field, PageShell, SectionTitle, SheetFrame, TextInput, cx } from '../ui/kit';
import { ui } from '../ui/uiStore';
import { addDays, dayMonth, diffDays, todayKey } from '../lib/dates';
import type { Countdown } from '../lib/types';
import { t } from '../lib/i18n';

const EMOJIS = ['🎉', '✈️', '🎓', '🎂', '💼', '❤️', '🏆', '📅', '🏖️', '🎁'];

const Editor = ({ c, close }: { c?: Countdown; close: () => void }) => {
  const [title, setTitle] = useState(c?.title ?? '');
  const [date, setDate] = useState(c?.date ?? addDays(todayKey(), 30));
  const [emoji, setEmoji] = useState(c?.emoji ?? '🎉');
  const save = () => { if (!title.trim()) return; S.saveCountdown({ id: c?.id, title: title.trim(), date, emoji }); close(); };
  return (
    <SheetFrame title={c ? t('Подія') : t('Нова подія')} onClose={close} footer={<Btn full disabled={!title.trim()} onClick={save}>{t('Зберегти')}</Btn>}>
      <div className="flex flex-col gap-4">
        <TextInput autoFocus={!c} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('Наприклад: відпустка')} />
        <Field label={t('Дата')}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full h-12 px-4 rounded-2xl bg-card2 outline-none" /></Field>
        <Field label={t('Іконка')}><div className="flex flex-wrap gap-2">{EMOJIS.map((e) => <button key={e} onClick={() => setEmoji(e)} className={cx('pressable w-11 h-11 rounded-2xl text-[22px]', emoji === e ? 'bg-accent/20 ring-2 ring-accent' : 'bg-card2')}>{e}</button>)}</div></Field>
        {c && <Btn variant="danger" icon={<Trash2 size={17} />} onClick={() => { S.deleteCountdown(c.id); close(); }}>{t('Видалити')}</Btn>}
      </div>
    </SheetFrame>
  );
};

export const Countdowns = () => {
  const app = useApp();
  const today = todayKey();
  const open = (c?: Countdown) => ui.sheet((cl) => <Editor c={c} close={cl} />);
  const upcoming = [...app.countdowns].filter((c) => c.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = [...app.countdowns].filter((c) => c.date < today).sort((a, b) => b.date.localeCompare(a.date));
  // найближчі дедлайни цілей та етапів
  const deadlines = app.goals.filter((g) => !g.doneAt).flatMap((g) => [
    ...(g.deadline ? [{ id: g.id, title: g.title, date: g.deadline, kind: t('Ціль'), color: g.color }] : []),
    ...g.milestones.filter((m) => !m.done && m.due).map((m) => ({ id: m.id, title: `${g.title}: ${m.title}`, date: m.due!, kind: t('Етап'), color: g.color })),
  ]).filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);

  const Big = ({ c }: { c: Countdown }) => { const d = diffDays(today, c.date); return (
    <Card onClick={() => open(c)} className="p-4 flex items-center gap-4"><div className="text-[34px]">{c.emoji}</div><div className="flex-1 min-w-0"><div className="font-bold text-[17px] truncate">{c.title}</div><div className="text-[13px] text-mute cap1">{dayMonth(c.date)}</div></div>
      <div className="text-right"><div className="text-[30px] font-extrabold tabular leading-none">{Math.abs(d)}</div><div className="text-[12px] text-mute">{d === 0 ? t('сьогодні!') : d > 0 ? t('днів лишилось') : t('днів тому')}</div></div></Card>); };

  return (
    <PageShell title={t('Зворотний відлік')} right={<button aria-label={t('Додати')} onClick={() => open()} className="pressable w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center"><Plus size={21} /></button>}>
      <div className="flex flex-col gap-3">
        {!app.countdowns.length && !deadlines.length && <Empty icon={<CalendarClock size={30} />} title={t('Подій немає')} text={t('Додайте подію — і побачите, скільки днів лишилось.')} action={<Btn onClick={() => open()}>{t('Додати подію')}</Btn>} />}
        {upcoming.map((c) => <Big key={c.id} c={c} />)}
        {deadlines.length > 0 && <><SectionTitle>{t('Дедлайни цілей та етапів')}</SectionTitle>
          <Card className="overflow-hidden">{deadlines.map((d) => <div key={d.kind + d.id} onClick={() => ui.push('goals')} className="flex items-center gap-3 px-4 py-3 hair-b last:border-b-0 pressable cursor-pointer"><span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} /><div className="flex-1 min-w-0"><div className="font-semibold truncate">{d.title}</div><div className="text-[12px] text-mute">{d.kind} · {dayMonth(d.date)}</div></div><div className="font-extrabold tabular">{diffDays(today, d.date)} <span className="text-[12px] text-mute font-semibold">{t('дн.')}</span></div></div>)}</Card></>}
        {past.length > 0 && <><SectionTitle>{t('Минулі')}</SectionTitle>{past.map((c) => <Big key={c.id} c={c} />)}</>}
      </div>
    </PageShell>
  );
};
