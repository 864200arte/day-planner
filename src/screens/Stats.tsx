import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useApp } from '../lib/store';
import { Card, Empty, PageShell, SectionTitle, Segmented } from '../ui/kit';
import { BarChart, Donut, Heat, LineChart } from '../ui/charts';
import { addDays, addMonths, daysInMonth, dayMonthShort, fmtDur, monthYear, rangeDays, startOfWeek, todayKey, weekday, weekdayShort } from '../lib/dates';
import { localKey } from '../lib/score';
import { categoryBreakdown, dayStats, summarize, toCtx, weekdayProductivity } from '../lib/stats';
import { catLabel, useCats } from '../ui/hooks';
import { t } from '../lib/i18n';

type Mode = 'week' | 'month';
const WD_FULL = ['понеділок', 'вівторок', 'середа', 'четвер', "п'ятниця", 'субота', 'неділя'];

export const Stats = () => {
  const app = useApp();
  const cats = useCats();
  const today = todayKey();
  const [mode, setMode] = useState<Mode>('week');
  const [offset, setOffset] = useState(0);

  const range = useMemo(() => {
    if (mode === 'week') { const s = addDays(startOfWeek(today, app.settings.weekStartsMonday), offset * 7); return { from: s, to: addDays(s, 6), title: `${dayMonthShort(s)} – ${dayMonthShort(addDays(s, 6))}` }; }
    const base = addMonths(today.slice(0, 8) + '01', offset); const to = base.slice(0, 8) + String(daysInMonth(base)).padStart(2, '0');
    return { from: base, to, title: monthYear(base) };
  }, [mode, offset, today, app.settings.weekStartsMonday]);
  const days = useMemo(() => rangeDays(range.from, range.to), [range]);
  const ctx = useMemo(() => toCtx(app), [app.tasks, app.habits, app.sessions, app.days, app.settings.focusGoalMin]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = useMemo(() => dayStats(days, app, ctx), [days, app, ctx]);
  const sm = useMemo(() => summarize(st, app, [range.from, range.to]), [st, app, range]);
  const cb = useMemo(() => categoryBreakdown(days, app), [days, app]);
  const wp = useMemo(() => weekdayProductivity(st), [st]);
  const best = wp.filter((x) => x.avg != null).sort((a, b) => (b.avg as number) - (a.avg as number))[0];
  const hasData = app.tasks.length > 0 || app.sessions.length > 0 || app.habits.length > 0;
  const labels = days.map((d) => (mode === 'week' ? weekdayShort(d).slice(0, 2) : String(+d.slice(8))));
  const future = (d: string) => d > today;

  const Stat = ({ v, l, sub }: { v: string | number; l: string; sub?: string }) => <Card className="p-3.5"><div className="text-[24px] font-extrabold tabular leading-tight">{v}</div><div className="text-[12.5px] text-mute">{l}</div>{sub && <div className="text-[11.5px] text-mute mt-0.5">{sub}</div>}</Card>;

  return (
    <PageShell title={t('Статистика')} sub={t('Усі цифри — з ваших реальних даних')}>
      <div className="flex flex-col gap-4">
        <Segmented<Mode> value={mode} onChange={(m) => { setMode(m); setOffset(0); }} options={[{ v: 'week', label: t('Тижневий звіт') }, { v: 'month', label: t('Місячний звіт') }]} />
        <div className="flex items-center justify-between">
          <button aria-label="prev" onClick={() => setOffset(offset - 1)} className="pressable w-10 h-10 rounded-full bg-card2 flex items-center justify-center">‹</button>
          <div className="font-extrabold cap1">{range.title}</div>
          <button aria-label="next" onClick={() => setOffset(offset + 1)} disabled={offset >= 0} className="pressable w-10 h-10 rounded-full bg-card2 flex items-center justify-center disabled:opacity-30">›</button>
        </div>

        {!hasData ? <Empty icon={<BarChart3 size={30} />} title={t('Поки що немає даних')} text={t('Створюйте й виконуйте завдання, користуйтесь фокус-таймером та звичками — тут з’являться графіки.')} /> : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Stat v={`${sm.done}/${sm.planned}`} l={t('Виконано завдань')} />
              <Stat v={sm.avgCompletion == null ? '—' : sm.avgCompletion + '%'} l={t('Середній % виконання')} sub={t('за дні з планами')} />
              <Stat v={fmtDur(sm.focusTotal)} l={t('Час концентрації')} sub={`${sm.sessions} ${t('сесій')}`} />
              <Stat v={sm.avgScore == null ? '—' : sm.avgScore} l={t('Середня оцінка дня')} />
              <Stat v={sm.moves} l={t('Перенесених завдань')} />
              <Stat v={sm.habitRate == null ? '—' : sm.habitRate + '%'} l={t('Виконання звичок')} />
            </div>

            <div><SectionTitle>{t('Виконані завдання по днях')}</SectionTitle><Card className="p-4"><BarChart data={st.map((s) => (future(s.date) ? null : s.done))} labels={labels} highlight={days.indexOf(today)} /></Card></div>
            <div><SectionTitle>{t('Продуктивність (оцінка дня)')}</SectionTitle><Card className="p-4"><LineChart data={st.map((s) => s.score)} labels={mode === 'week' ? labels : labels.map((l, i) => (i % 5 === 0 ? l : ''))} /><div className="text-[11.5px] text-mute mt-2">{t('Дні без даних не показуються — без вигаданих значень.')}</div></Card></div>
            <div><SectionTitle>{t('Фокус, хвилин')}</SectionTitle><Card className="p-4"><BarChart data={st.map((s) => (future(s.date) ? null : s.focus))} labels={labels} color="rgb(var(--good))" fmt={(v) => String(Math.round(v))} /></Card></div>

            {cb.length > 0 && (
              <div><SectionTitle>{t('За категоріями')}</SectionTitle>
                <Card className="p-4 flex items-center gap-4"><Donut parts={cb.map((c) => ({ v: c.done, color: cats.get(c.id).color }))} />
                  <div className="flex-1 flex flex-col gap-1.5">{cb.slice(0, 6).map((c) => <div key={c.id} className="flex items-center gap-2 text-[13.5px]"><span className="w-2.5 h-2.5 rounded-full" style={{ background: cats.get(c.id).color }} /><span className="flex-1 truncate">{catLabel(cats.get(c.id))}</span><b className="tabular">{c.done}</b></div>)}</div></Card></div>
            )}

            <div><SectionTitle>{t('Найпродуктивніші дні тижня')}</SectionTitle>
              <Card className="p-4">
                <BarChart data={wp.map((x) => x.avg)} labels={wp.map((x) => weekdayShort(addDays(startOfWeek(today), x.weekday)).slice(0, 2))} max={100} height={90} />
                <div className="text-[13px] text-mute mt-3">{best ? `${t('Найкраща середня оцінка')}: ${WD_FULL[best.weekday]} (${best.avg})` : t('Потрібно більше днів з даними.')}</div>
              </Card></div>

            {mode === 'month' && (
              <div><SectionTitle>{t('Карта місяця')}</SectionTitle><Card className="p-4">
                <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] text-mute mb-1.5">{Array.from({ length: 7 }, (_, i) => <div key={i}>{weekdayShort(addDays(startOfWeek(today), i)).slice(0, 2)}</div>)}</div>
                <Heat cells={[...Array(weekday(days[0])).fill(null).map((_, i) => ({ key: 'p' + i, v: null })), ...st.map((s) => ({ key: s.date, v: s.score }))]} />
              </Card></div>
            )}

            <div><SectionTitle>{t('Звички')}</SectionTitle>
              <Card className="overflow-hidden">{app.habits.map((h) => { const sc = days.filter((d) => h.days.includes(weekday(d)) && d <= today && d >= localKey(h.createdAt)); const dn = sc.filter((d) => h.log[d]).length; const p = sc.length ? Math.round((dn / sc.length) * 100) : null; return (
                <div key={h.id} className="flex items-center gap-3 px-4 py-3 hair-b last:border-b-0"><span className="text-[20px]">{h.emoji}</span><div className="flex-1 truncate font-medium">{h.name}</div><div className="text-[13px] text-mute tabular">{dn}/{sc.length}</div><div className="w-12 text-right font-bold tabular">{p == null ? '—' : p + '%'}</div></div>); })}
                {!app.habits.length && <div className="p-4 text-[14px] text-mute">{t('Звичок немає')}</div>}</Card></div>
          </>
        )}
      </div>
    </PageShell>
  );
};
