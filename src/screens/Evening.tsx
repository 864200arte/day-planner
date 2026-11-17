import { useState } from 'react';
import { CheckCircle2, Clock, Flag } from 'lucide-react';
import { useApp } from '../lib/store';
import * as S from '../lib/store';
import { Btn, Card, PageShell, Ring, SectionTitle, Stars, TextArea, Check2 } from '../ui/kit';
import { useOccs, useScore } from '../ui/derived';
import { addDays, fmtDur, fullDate, todayKey } from '../lib/dates';
import { focusMinutesOn } from '../lib/score';
import { ui } from '../ui/uiStore';
import { postpone } from '../ui/actions';
import { useCats } from '../ui/hooks';
import { openTaskEditor } from './TaskEditor';
import { openQuickCapture } from './QuickCapture';
import { t } from '../lib/i18n';

export const Evening = ({ date }: { date?: string }) => {
  const app = useApp();
  const today = date ?? todayKey();
  const occs = useOccs(today);
  const score = useScore(today);
  const cats = useCats();
  const info = app.days.find((d) => d.date === today);
  const entry = app.journal.find((j) => j.date === today);
  const [note, setNote] = useState(entry?.text ?? '');
  const [results, setResults] = useState(info?.results ?? '');
  const done = occs.filter((o) => o.done), undone = occs.filter((o) => !o.done);
  const pct = occs.length ? Math.round((done.length / occs.length) * 100) : 0;
  const focus = focusMinutesOn(app.sessions, today);
  const topIds = info?.top ?? [];
  const topDone = topIds.filter((id) => done.some((o) => o.task.id === id)).length;
  const finished = !!info?.finishedAt;
  const tomorrow = addDays(today, 1);

  const finish = () => {
    S.saveJournal(today, { text: note });
    S.updateDay(today, { results, finishedAt: Date.now(), rating: info?.rating ?? null });
    ui.toast(t('День завершено. Гарного відпочинку! 🌙'), { tone: 'good' });
    ui.pop();
  };

  return (
    <PageShell title={t('Вечірній огляд')} sub={fullDate(today)}>
      <div className="flex flex-col gap-5">
        <Card className="p-4 aurora flex items-center gap-4">
          <Ring value={pct / 100} size={88} stroke={10}><span className="text-[22px] font-extrabold tabular">{pct}%</span></Ring>
          <div className="flex-1 grid grid-cols-2 gap-y-2 text-[13px]">
            <div><div className="text-mute">{t('Заплановано')}</div><div className="font-extrabold text-[18px] tabular">{occs.length}</div></div>
            <div><div className="text-mute">{t('Виконано')}</div><div className="font-extrabold text-[18px] tabular text-good">{done.length}</div></div>
            <div><div className="text-mute">{t('Не виконано')}</div><div className="font-extrabold text-[18px] tabular">{undone.length}</div></div>
            <div><div className="text-mute">{t('Концентрація')}</div><div className="font-extrabold text-[18px] tabular">{fmtDur(focus)}</div></div>
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between" onClick={() => ui.push('score', { date: today })}>
          <div><div className="text-[12px] font-bold uppercase tracking-wider text-mute">{t('Оцінка дня')}</div><div className="text-[13px] text-mute mt-0.5">{score.score == null ? t('Недостатньо даних') : t('Як рахується →')}</div></div>
          <div className="text-[34px] font-extrabold tabular">{score.score ?? '—'}</div>
        </Card>

        <div>
          <SectionTitle>{t('Як пройшов день?')}</SectionTitle>
          <Card className="p-4"><Stars value={info?.rating ?? null} onChange={(v) => S.updateDay(today, { rating: v })} /></Card>
        </div>

        {topIds.length > 0 && (
          <div><SectionTitle>{t('Головні цілі')}: {topDone}/{topIds.length}</SectionTitle>
            <Card className="overflow-hidden">{topIds.map((id) => { const o = occs.find((x) => x.task.id === id); if (!o) return null; return (
              <div key={id} className="flex items-center gap-3 px-4 py-3 hair-b last:border-b-0"><Flag size={16} className={o.done ? 'text-good' : 'text-mute'} /><div className={o.done ? 'flex-1 line-through text-mute' : 'flex-1 font-semibold'}>{o.task.title}</div>{o.done && <CheckCircle2 size={18} className="text-good" />}</div>); })}</Card></div>
        )}

        {undone.length > 0 && (
          <div>
            <SectionTitle right={<button onClick={() => { undone.forEach((o) => S.moveOccurrence(o.task.id, today, { date: tomorrow })); ui.toast(`${t('Перенесено на завтра')}: ${undone.length}`, { tone: 'good' }); }} className="text-accent text-[14px] font-semibold pressable">{t('Усі на завтра')}</button>}>{t('Невиконані')} · {undone.length}</SectionTitle>
            <Card className="overflow-hidden">{undone.map((o) => (
              <div key={o.task.id} className="flex items-center gap-3 px-4 py-3 hair-b last:border-b-0">
                <Check2 done={false} color={cats.get(o.task.categoryId).color} onClick={() => S.toggleDone(o.task.id, today)} />
                <div className="flex-1 min-w-0" onClick={() => openTaskEditor({ id: o.task.id, date: today })}><div className="font-semibold truncate">{o.task.title}</div><div className="text-[12px] text-mute">{fmtDur(o.dur)}</div></div>
                <button onClick={() => postpone(o.task, today, tomorrow)} className="pressable h-8 px-3 rounded-full bg-warn/15 text-warn text-[12.5px] font-bold">{t('На завтра')}</button>
              </div>))}</Card>
          </div>
        )}
        {done.length > 0 && <div><SectionTitle>{t('Виконані')} · {done.length}</SectionTitle><Card className="overflow-hidden">{done.map((o) => <div key={o.task.id} className="flex items-center gap-3 px-4 py-2.5 hair-b last:border-b-0 text-mute"><CheckCircle2 size={17} className="text-good" /><div className="flex-1 line-through truncate">{o.task.title}</div></div>)}</Card></div>}

        <div><SectionTitle>{t('Результати дня')}</SectionTitle><TextArea rows={2} value={results} onChange={(e) => setResults(e.target.value)} placeholder={t('Що вдалося? Чим пишаєтесь?')} /></div>
        <div><SectionTitle>{t('Нотатка (потрапляє у щоденник)')}</SectionTitle><TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Думки, висновки, подяки…')} /></div>

        <div>
          <SectionTitle>{t('Завтра')}</SectionTitle>
          <div className="flex gap-2"><Btn variant="soft" full icon={<Clock size={17} />} onClick={() => ui.push('planner', { date: tomorrow })}>{t('Запланувати завтра')}</Btn><Btn variant="ghost" onClick={() => openQuickCapture({ date: tomorrow })}>＋</Btn></div>
        </div>

        <Btn size="lg" full variant={finished ? 'ghost' : 'primary'} onClick={finish}>{finished ? t('Оновити підсумок') : t('Завершити день')}</Btn>
        {finished && <div className="text-center text-[12.5px] text-mute">{t('День вже завершено')} ✓</div>}
      </div>
    </PageShell>
  );
};
