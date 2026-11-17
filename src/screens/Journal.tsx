import { useEffect, useRef, useState } from 'react';
import { Plus, Search, Star, X } from 'lucide-react';
import { useApp } from '../lib/store';
import * as S from '../lib/store';
import { Card, PageShell, SectionTitle, TextArea, cx } from '../ui/kit';
import { addDays, fullDate, todayKey, dayMonthShort } from '../lib/dates';
import { t } from '../lib/i18n';

const MOODS = [['😞', 1], ['😕', 2], ['😐', 3], ['🙂', 4], ['😄', 5]] as const;

export const Journal = ({ date: initial }: { date?: string }) => {
  const app = useApp();
  const today = todayKey();
  const [date, setDate] = useState(initial ?? today);
  const entry = app.journal.find((j) => j.date === date);
  const [text, setText] = useState(entry?.text ?? '');
  const [thought, setThought] = useState('');
  const [q, setQ] = useState('');
  const timer = useRef<number | null>(null);
  const cur = useRef({ date, text });
  cur.current = { date, text };

  // змінили день — підтягуємо текст
  useEffect(() => { setText(app.journal.find((j) => j.date === date)?.text ?? ''); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps
  // автозбереження з затримкою + збереження при виході
  const onText = (v: string) => { setText(v); if (timer.current) clearTimeout(timer.current); timer.current = window.setTimeout(() => S.saveJournal(date, { text: v }), 500); };
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); S.saveJournal(cur.current.date, { text: cur.current.text }); } }, []);

  const addThought = () => { const v = thought.trim(); if (!v) return; S.saveJournal(date, { text, thoughts: [...(entry?.thoughts ?? []), v] }); setThought(''); };
  const ql = q.trim().toLowerCase();
  const list = [...app.journal].filter((j) => j.date !== date && (!ql || j.text.toLowerCase().includes(ql) || j.thoughts.some((x) => x.toLowerCase().includes(ql)))).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <PageShell title={t('Щоденник')}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <button aria-label="prev" onClick={() => setDate(addDays(date, -1))} className="pressable w-10 h-10 rounded-full bg-card2 flex items-center justify-center">‹</button>
          <div className="text-center"><div className="font-extrabold text-[17px] cap1">{fullDate(date)}</div>{date !== today && <button onClick={() => setDate(today)} className="text-accent text-[13px] font-semibold pressable">{t('Сьогодні')}</button>}</div>
          <button aria-label="next" onClick={() => setDate(addDays(date, 1))} disabled={date >= today} className="pressable w-10 h-10 rounded-full bg-card2 flex items-center justify-center disabled:opacity-30">›</button>
        </div>

        <div><SectionTitle>{t('Настрій')}</SectionTitle>
          <div className="flex justify-between">{MOODS.map(([e, v]) => <button key={v} aria-label={`${v}`} onClick={() => S.saveJournal(date, { text, mood: entry?.mood === v ? null : v })} className={cx('pressable w-[58px] h-[58px] rounded-2xl text-[30px] flex items-center justify-center', entry?.mood === v ? 'bg-accent/20 ring-2 ring-accent' : 'bg-card2')}>{e}</button>)}</div></div>

        <div><SectionTitle>{t('Нотатки дня')}</SectionTitle><TextArea rows={7} value={text} onChange={(e) => onText(e.target.value)} placeholder={t('Що сьогодні було важливого? Що відчуваєте?')} />
          <div className="text-[11.5px] text-mute mt-1.5 px-1">{t('Зберігається автоматично')}</div></div>

        <div><SectionTitle>{t('Важливі думки')}</SectionTitle>
          <div className="flex flex-col gap-2">
            {(entry?.thoughts ?? []).map((th, i) => (
              <Card key={i} className="px-4 py-3 flex items-start gap-2.5"><Star size={16} className="text-warn mt-0.5 shrink-0" fill="currentColor" /><div className="flex-1 text-[15px] leading-snug" style={{ userSelect: 'text' }}>{th}</div>
                <button aria-label={t('Видалити')} onClick={() => S.saveJournal(date, { text, thoughts: (entry?.thoughts ?? []).filter((_, k) => k !== i) })} className="pressable text-mute"><X size={16} /></button></Card>
            ))}
            <div className="flex gap-2"><input value={thought} onChange={(e) => setThought(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addThought(); }} placeholder={t('Зафіксувати думку…')} className="flex-1 h-12 px-4 rounded-2xl bg-card2 outline-none" /><button aria-label={t('Додати')} onClick={addThought} className="pressable w-12 h-12 rounded-2xl bg-accent text-white flex items-center justify-center"><Plus size={20} /></button></div>
          </div></div>

        <div>
          <SectionTitle>{t('Історія')}</SectionTitle>
          <div className="relative mb-3"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Пошук у щоденнику')} className="w-full h-11 pl-10 pr-4 rounded-2xl bg-card2 outline-none" /></div>
          <div className="flex flex-col gap-2">
            {list.map((j) => (
              <Card key={j.id} onClick={() => { setDate(j.date); window.scrollTo(0, 0); }} className="p-3.5">
                <div className="flex items-center gap-2"><span className="text-[20px]">{MOODS.find((m) => m[1] === j.mood)?.[0] ?? '📝'}</span><div className="font-bold flex-1">{dayMonthShort(j.date)}</div>{j.thoughts.length > 0 && <span className="text-[12px] text-warn">★ {j.thoughts.length}</span>}</div>
                {j.text && <div className="text-[14px] text-mute mt-1 line-clamp-2">{j.text}</div>}
              </Card>
            ))}
            {!list.length && <div className="text-center text-mute text-[14px] py-4">{q ? t('Нічого не знайдено') : t('Інших записів ще немає')}</div>}
          </div>
        </div>
      </div>
    </PageShell>
  );
};
