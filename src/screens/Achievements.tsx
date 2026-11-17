import { useMemo } from 'react';
import { Flame } from 'lucide-react';
import { useApp, snapshotData } from '../lib/store';
import { Card, PageShell, SectionTitle, cx } from '../ui/kit';
import { ACHIEVEMENTS, computeMetrics } from '../lib/achievements';
import { dayMonth, dayMonthShort, fmtDur } from '../lib/dates';
import { localKey } from '../lib/score';
import { t } from '../lib/i18n';

export const Achievements = () => {
  const app = useApp();
  const { records, streaks } = useMemo(() => computeMetrics(snapshotData()), [app.tasks, app.habits, app.sessions, app.goals, app.journal, app.days]); // eslint-disable-line react-hooks/exhaustive-deps
  const unlocked = ACHIEVEMENTS.filter((a) => app.achievements[a.id]).sort((a, b) => app.achievements[b.id] - app.achievements[a.id]);
  const locked = ACHIEVEMENTS.filter((a) => !app.achievements[a.id]);
  const rec: [string, string][] = [
    [t('Найдовша серія днів'), `${records.bestStreak}`],
    [t('Найкраща оцінка дня'), records.bestScore ? `${records.bestScore.v} · ${dayMonthShort(records.bestScore.date)}` : '—'],
    [t('Найбільше завдань за день'), records.mostTasks ? `${records.mostTasks.v} · ${dayMonthShort(records.mostTasks.date)}` : '—'],
    [t('Найдовша фокус-сесія'), records.longestSession ? fmtDur(records.longestSession) : '—'],
    [t('Найбільше фокусу за день'), records.bestFocusDay ? `${fmtDur(records.bestFocusDay.v)} · ${dayMonthShort(records.bestFocusDay.date)}` : '—'],
    [t('Найдовша серія звички'), `${records.bestHabitStreak}`],
  ];
  return (
    <PageShell title={t('Досягнення')} sub={t('Без тиску: пропущений день не обнуляє прогрес — один пропуск на тиждень «прощається».')}>
      <div className="flex flex-col gap-5">
        <Card className="p-4 aurora flex items-center gap-4"><div className="w-14 h-14 rounded-2xl bg-warn/20 flex items-center justify-center"><Flame size={30} className="text-warn" /></div>
          <div className="flex-1"><div className="text-[12px] font-bold uppercase tracking-wider text-mute">{t('Серія продуктивних днів')}</div><div className="text-[30px] font-extrabold leading-none tabular mt-0.5">{streaks.current} <span className="text-[14px] text-mute font-semibold">{t('днів')}</span></div>
            <div className="text-[12.5px] text-mute mt-1">{t('Продуктивний день — оцінка від 50')}{streaks.graceUsed ? ` · ${t('використано щадний пропуск')}` : ''}</div></div></Card>

        <div><SectionTitle>{t('Особисті рекорди')}</SectionTitle><Card className="overflow-hidden">{rec.map(([l, v]) => <div key={l} className="flex justify-between gap-3 px-4 py-3 hair-b last:border-b-0"><span className="text-[14.5px]">{l}</span><b className="tabular text-right">{v}</b></div>)}</Card></div>

        <div><SectionTitle>{t('Відкриті')} · {unlocked.length}</SectionTitle>
          <div className="grid grid-cols-2 gap-3">{unlocked.map((a) => <Card key={a.id} className="p-3.5"><div className="text-[30px]">{a.emoji}</div><div className="font-bold mt-1 leading-tight">{a.title}</div><div className="text-[12px] text-mute mt-0.5">{a.desc}</div><div className="text-[11.5px] text-good mt-1.5 font-semibold">{dayMonth(localKey(app.achievements[a.id]))}</div></Card>)}
            {!unlocked.length && <div className="col-span-2 text-center text-mute text-[14px] py-4">{t('Поки що порожньо — виконайте перше завдання!')}</div>}</div></div>

        <div><SectionTitle>{t('Попереду')} · {locked.length}</SectionTitle>
          <div className="grid grid-cols-2 gap-3">{locked.map((a) => <Card key={a.id} className={cx('p-3.5 opacity-60')}><div className="text-[30px] grayscale">{a.emoji}</div><div className="font-bold mt-1 leading-tight">{a.title}</div><div className="text-[12px] text-mute mt-0.5">{a.desc}</div></Card>)}</div></div>
      </div>
    </PageShell>
  );
};
