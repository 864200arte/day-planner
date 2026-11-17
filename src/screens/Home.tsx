import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Bell, Flame, Moon, Search, SlidersHorizontal, Sparkles, Sun, Target, Trophy } from 'lucide-react';
import * as S from '../lib/store';
import { useApp } from '../lib/store';
import { Btn, Card, Check2, Ring, SectionTitle, SheetFrame, Toggle, useNow, Bar, cx } from '../ui/kit';
import { greeting, useOccs, useScore, useStreaks } from '../ui/derived';
import { addDays, diffDays, fmtDur, fmtTime, fullDate, pad, todayKey, toMin, nowMin, dayMonthShort } from '../lib/dates';
import { ui } from '../ui/uiStore';
import { openSearch } from './Search';
import { nextReminder } from '../lib/reminders';
import { priorityScore } from '../lib/planner';
import { toggleTask } from '../ui/actions';
import { openTaskEditor } from './TaskEditor';
import { useCats } from '../ui/hooks';
import { habitScheduled } from '../lib/score';
import { t } from '../lib/i18n';
import { snapshotData } from '../lib/store';
import { occurrencesOn } from '../lib/recur';

const BLOCK_LABELS: Record<string, string> = {
  progress: 'Прогрес дня', next: 'Наступна подія і нагадування', top: 'Три головні цілі', score: 'Оцінка дня та серія',
  briefing: 'Ранковий і вечірній огляд', habits: 'Звички сьогодні', goals: 'Великі цілі', energy: 'Енергія', countdowns: 'Зворотний відлік',
};

export const openTopPicker = (date: string) => ui.sheet((close) => <TopPicker date={date} close={close} />);

const TopPicker = ({ date, close }: { date: string; close: () => void }) => {
  const app = useApp();
  const occs = useOccs(date);
  const cur = app.days.find((d) => d.date === date)?.top ?? [];
  const [sel, setSel] = useState<string[]>(cur);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 3 ? s : [...s, id]));
  const ranked = [...occs].sort((a, b) => priorityScore(b.task, todayKey(), date).score - priorityScore(a.task, todayKey(), date).score);
  return (
    <SheetFrame title={t('Головні цілі дня')} onClose={close} footer={<Btn full onClick={() => { S.updateDay(date, { top: sel }); close(); }}>{t('Зберегти')} ({sel.length}/3)</Btn>}>
      <p className="text-[14px] text-mute mb-3">{t('Оберіть до трьох найважливіших справ дня — на них спирається оцінка дня.')}</p>
      {ranked.length === 0 && <div className="text-mute text-center py-6">{t('На цей день немає завдань. Спершу додайте їх.')}</div>}
      <div className="flex flex-col gap-2">
        {ranked.map((o) => {
          const on = sel.includes(o.task.id);
          return (
            <button key={o.task.id} onClick={() => toggle(o.task.id)} className={cx('pressable card p-3.5 flex items-center gap-3 text-left border-2', on ? '!border-accent' : '!border-transparent')}>
              <div className={cx('w-6 h-6 rounded-full flex items-center justify-center text-[13px] font-bold', on ? 'bg-accent text-white' : 'bg-card2 text-mute')}>{on ? sel.indexOf(o.task.id) + 1 : ''}</div>
              <div className="flex-1 min-w-0"><div className="font-semibold truncate">{o.task.title}</div>
                <div className="text-[12.5px] text-mute">{priorityScore(o.task, todayKey(), date).reasons.slice(0, 2).join(' · ') || t('без пріоритету')}</div></div>
            </button>
          );
        })}
      </div>
    </SheetFrame>
  );
};

const Customize = ({ close }: { close: () => void }) => {
  const { settings } = useApp();
  const blocks = settings.homeBlocks;
  const move = (i: number, d: number) => { const b = [...blocks]; const j = i + d; if (j < 0 || j >= b.length) return; [b[i], b[j]] = [b[j], b[i]]; S.updateSettings({ homeBlocks: b }); };
  const vis = (i: number, v: boolean) => S.updateSettings({ homeBlocks: blocks.map((b, k) => (k === i ? { ...b, visible: v } : b)) });
  return (
    <SheetFrame title={t('Блоки головної')} onClose={close}>
      <p className="text-[14px] text-mute mb-3">{t('Змінюйте порядок стрілками та приховуйте зайве.')}</p>
      <div className="card overflow-hidden">
        {blocks.map((b, i) => (
          <div key={b.id} className="flex items-center gap-2 px-3 min-h-[54px] hair-b last:border-b-0">
            <div className="flex-1 text-[15.5px] font-medium">{t(BLOCK_LABELS[b.id] ?? b.id)}</div>
            <button aria-label="up" disabled={i === 0} onClick={() => move(i, -1)} className="pressable w-9 h-9 rounded-full bg-card2 flex items-center justify-center disabled:opacity-30"><ArrowUp size={17} /></button>
            <button aria-label="down" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} className="pressable w-9 h-9 rounded-full bg-card2 flex items-center justify-center disabled:opacity-30"><ArrowDown size={17} /></button>
            <Toggle checked={b.visible} onChange={(v) => vis(i, v)} label={BLOCK_LABELS[b.id]} />
          </div>
        ))}
      </div>
      <div className="mt-4"><Btn variant="ghost" full onClick={() => S.updateSettings({ homeBlocks: S.getState().settings.homeBlocks.map((b) => ({ ...b, visible: true })).sort((a, b) => Object.keys(BLOCK_LABELS).indexOf(a.id) - Object.keys(BLOCK_LABELS).indexOf(b.id)) })}>{t('Скинути порядок')}</Btn></div>
    </SheetFrame>
  );
};

export const Home = () => {
  const app = useApp();
  const now = useNow(15000);
  const today = todayKey();
  const occs = useOccs(today);
  const score = useScore(today);
  const streaks = useStreaks();
  const cats = useCats();
  const { settings } = app;

  const done = occs.filter((o) => o.done).length;
  const total = occs.length;
  const ws = toMin(settings.workStart), we = toMin(settings.workEnd);
  const nm = nowMin(now);
  const dayPct = Math.max(0, Math.min(1, (nm - ws) / Math.max(1, we - ws)));
  const hours = now.getHours();
  const timeStr = `${pad(hours)}:${pad(now.getMinutes())}`;

  // наступна подія: найближча з часом, що ще не почалась і не виконана (сьогодні), інакше перша в найближчі 7 днів
  const nextEv = useMemo(() => {
    const todayNext = occs.find((o) => o.start && !o.done && toMin(o.start) >= nm);
    return todayNext ? { occ: todayNext, date: today } : null;
  }, [occs, nm, today]);
  const tomorrowFirst = useMemo(() => {
    if (nextEv) return null;
    for (let i = 1; i <= 7; i++) {
      const k = addDays(today, i);
      const first = occurrencesOn(app.tasks, k, settings.defaultDuration).find((o) => o.start && !o.done);
      if (first) return { t: first.task, date: k, start: first.start! };
    }
    return null;
  }, [nextEv, app.tasks, today, settings.defaultDuration]);
  const rem = useMemo(() => nextReminder(snapshotData(), now.getTime()), [app.tasks, now.getMinutes()]); // eslint-disable-line react-hooks/exhaustive-deps

  const info = app.days.find((d) => d.date === today);
  const topTasks = (info?.top ?? []).map((id) => occs.find((o) => o.task.id === id)).filter(Boolean) as typeof occs;
  const suggested = useMemo(() => [...occs].filter((o) => !o.done).sort((a, b) => priorityScore(b.task, today, today).score - priorityScore(a.task, today, today).score).slice(0, 3), [occs, today]);

  const habits = app.habits.filter((h) => habitScheduled(h, today));
  const goals = app.goals.filter((g) => !g.doneAt).slice(0, 3);
  const cds = [...app.countdowns].filter((c) => c.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const lastEnergy = [...app.energy].sort((a, b) => b.ts - a.ts)[0];

  const morningDue = settings.morningEnabled && hours >= toMin(settings.morningTime) / 60 - 0.01 && !info?.startedAt;
  const eveningDue = settings.eveningEnabled && nm >= toMin(settings.eveningTime) && !info?.finishedAt;

  const render: Record<string, () => JSX.Element | null> = {
    progress: () => (
      <Card className="p-4 aurora relative overflow-hidden" onClick={() => ui.go('tasks')}>
        <div className="flex items-center gap-4">
          <Ring value={total ? done / total : 0} size={92} stroke={10} color="rgb(var(--accent))">
            <div className="text-center"><div className="text-[24px] font-extrabold leading-none tabular">{total ? Math.round((done / total) * 100) : 0}<span className="text-[13px]">%</span></div></div>
          </Ring>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold uppercase tracking-wider text-mute">{t('Прогрес дня')}</div>
            <div className="text-[22px] font-extrabold leading-tight mt-0.5">{done} {t('з')} {total} {t('виконано')}</div>
            <div className="text-[13.5px] text-mute mt-0.5">{total - done > 0 ? `${t('Залишилось')} ${total - done}` : total ? t('Усе зроблено 🎉') : t('Поки що без завдань')}</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-[12px] text-mute mb-1.5 tabular"><span>{fmtTime(settings.workStart, settings.timeFormat)}</span><span>{t('Час дня')} {Math.round(dayPct * 100)}%</span><span>{fmtTime(settings.workEnd, settings.timeFormat)}</span></div>
          <Bar value={dayPct} color="linear-gradient(90deg, rgb(var(--accent)), #38bdf8)" h={6} />
        </div>
      </Card>
    ),
    next: () => (
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3.5 min-h-[112px]" onClick={() => nextEv ? openTaskEditor({ id: nextEv.occ.task.id, date: today }) : ui.go('calendar')}>
          <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-mute"><Sparkles size={14} />{t('Наступна подія')}</div>
          {nextEv ? (<><div className="text-[17px] font-bold mt-2 leading-snug line-clamp-2">{nextEv.occ.task.title}</div>
            <div className="text-[13px] text-accent font-semibold mt-1 tabular">{fmtTime(nextEv.occ.start, settings.timeFormat)} · {diffMin(toMin(nextEv.occ.start!) - nm)}</div></>)
            : tomorrowFirst ? (<><div className="text-[17px] font-bold mt-2 leading-snug line-clamp-2">{tomorrowFirst.t.title}</div>
              <div className="text-[13px] text-mute mt-1">{dayMonthShort(tomorrowFirst.date)} · {fmtTime(tomorrowFirst.start, settings.timeFormat)}</div></>)
              : <div className="text-[14px] text-mute mt-2">{t('Подій із часом не заплановано')}</div>}
        </Card>
        <Card className="p-3.5 min-h-[112px]" onClick={() => ui.push('notifications')}>
          <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-mute"><Bell size={14} />{t('Нагадування')}</div>
          {rem ? (<><div className="text-[17px] font-bold mt-2 leading-snug line-clamp-2">{rem.title}</div>
            <div className="text-[13px] text-accent font-semibold mt-1 tabular">{new Date(rem.at).toDateString() === now.toDateString() ? '' : dayMonthShort(todayFromTs(rem.at)) + ', '}{pad(new Date(rem.at).getHours())}:{pad(new Date(rem.at).getMinutes())}</div></>)
            : <div className="text-[14px] text-mute mt-2">{t('Немає активних нагадувань')}</div>}
        </Card>
      </div>
    ),
    top: () => (
      <div>
        <SectionTitle right={<button onClick={() => openTopPicker(today)} className="text-accent text-[14px] font-semibold pressable">{topTasks.length ? t('Змінити') : t('Обрати')}</button>}>{t('Три головні цілі')}</SectionTitle>
        <Card className="overflow-hidden">
          {topTasks.length ? topTasks.map((o, i) => (
            <div key={o.task.id} className="flex items-center gap-3 px-4 py-3 hair-b last:border-b-0">
              <div className="w-6 h-6 rounded-full bg-accent/15 text-accent text-[13px] font-extrabold flex items-center justify-center">{i + 1}</div>
              <div className={cx('flex-1 font-semibold truncate', o.done && 'line-through text-mute')} onClick={() => openTaskEditor({ id: o.task.id, date: today })}>{o.task.title}</div>
              <Check2 done={o.done} color={cats.get(o.task.categoryId).color} onClick={() => toggleTask(o.task, today)} />
            </div>
          )) : (
            <div className="p-4">
              {suggested.length ? (<><div className="text-[13.5px] text-mute mb-2.5">{t('Пропозиція за пріоритетом')}:</div>
                {suggested.map((o) => <div key={o.task.id} className="text-[15px] font-medium py-1 truncate">• {o.task.title}</div>)}
                <div className="mt-3"><Btn size="sm" onClick={() => S.updateDay(today, { top: suggested.map((o) => o.task.id) })}>{t('Прийняти пропозицію')}</Btn></div></>)
                : <div className="text-mute text-[14px]">{t('Додайте завдання на сьогодні, і тут з’являться головні цілі дня.')}</div>}
            </div>
          )}
        </Card>
      </div>
    ),
    score: () => (
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3.5" onClick={() => ui.push('score', { date: today })}>
          <div className="text-[12px] font-bold uppercase tracking-wider text-mute flex items-center gap-1.5"><Target size={14} />{t('Оцінка дня')}</div>
          <div className="flex items-center gap-3 mt-2">
            <Ring value={(score.score ?? 0) / 100} size={58} stroke={7} color={score.score != null && score.score >= 70 ? 'rgb(var(--good))' : 'rgb(var(--accent))'}>
              <span className="text-[17px] font-extrabold tabular">{score.score ?? '—'}</span></Ring>
            <div className="text-[12.5px] text-mute leading-snug">{score.score == null ? t('Ще немає даних') : t('Як рахується →')}</div>
          </div>
        </Card>
        <Card className="p-3.5" onClick={() => ui.push('achievements')}>
          <div className="text-[12px] font-bold uppercase tracking-wider text-mute flex items-center gap-1.5"><Flame size={14} className="text-warn" />{t('Серія')}</div>
          <div className="flex items-baseline gap-1.5 mt-2"><span className="text-[34px] font-extrabold leading-none tabular">{streaks.current}</span><span className="text-[14px] text-mute font-semibold">{t('днів')}</span></div>
          <div className="text-[12.5px] text-mute mt-1 flex items-center gap-1"><Trophy size={13} />{t('Рекорд')}: {streaks.best}</div>
        </Card>
      </div>
    ),
    briefing: () => (
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => ui.push('morning')} className={cx('pressable card p-3.5 text-left', morningDue && 'ring-1 ring-warn/60')}>
          <Sun size={22} className="text-warn" /><div className="font-bold mt-2 text-[15.5px]">{t('Ранковий огляд')}</div>
          <div className="text-[12.5px] text-mute">{info?.startedAt ? t('День розпочато ✓') : `${t('о')} ${fmtTime(settings.morningTime, settings.timeFormat)}`}</div>
        </button>
        <button onClick={() => ui.push('evening')} className={cx('pressable card p-3.5 text-left', eveningDue && 'ring-1 ring-accent/60')}>
          <Moon size={22} className="text-accent" /><div className="font-bold mt-2 text-[15.5px]">{t('Вечірній огляд')}</div>
          <div className="text-[12.5px] text-mute">{info?.finishedAt ? t('День завершено ✓') : `${t('о')} ${fmtTime(settings.eveningTime, settings.timeFormat)}`}</div>
        </button>
      </div>
    ),
    habits: () => habits.length ? (
      <div>
        <SectionTitle right={<button onClick={() => ui.push('habits')} className="text-accent text-[14px] font-semibold pressable">{t('Усі')}</button>}>{t('Звички сьогодні')}</SectionTitle>
        <div className="flex gap-2 overflow-x-auto scroll -mx-4 px-4 pb-1">
          {habits.map((h) => {
            const on = !!h.log[today];
            return (
              <button key={h.id} onClick={() => S.toggleHabit(h.id, today)} className={cx('pressable shrink-0 w-[92px] card p-3 flex flex-col items-center gap-1.5 border-2', on ? '' : '!border-transparent')} style={on ? { borderColor: h.color, background: h.color + '22' } : undefined}>
                <div className="text-[28px] leading-none">{h.emoji}</div><div className="text-[12.5px] font-semibold text-center leading-tight line-clamp-2 h-[30px]">{h.name}</div>
                <div className="text-[11px] font-bold" style={{ color: on ? h.color : 'rgb(var(--mute))' }}>{on ? '✓ ' + t('зроблено') : t('відмітити')}</div>
              </button>
            );
          })}
        </div>
      </div>
    ) : null,
    goals: () => goals.length ? (
      <div>
        <SectionTitle right={<button onClick={() => ui.push('goals')} className="text-accent text-[14px] font-semibold pressable">{t('Усі')}</button>}>{t('Великі цілі')}</SectionTitle>
        <Card className="overflow-hidden">
          {goals.map((g) => { const p = g.milestones.length ? g.milestones.filter((m) => m.done).length / g.milestones.length : 0; return (
            <div key={g.id} onClick={() => ui.push('goals')} className="px-4 py-3 hair-b last:border-b-0 pressable cursor-pointer">
              <div className="flex justify-between items-baseline"><div className="font-semibold truncate">{g.title}</div><div className="text-[12.5px] text-mute tabular">{Math.round(p * 100)}%</div></div>
              <div className="mt-2"><Bar value={p} color={g.color} h={6} /></div>
              {g.deadline && <div className="text-[12px] text-mute mt-1.5">{diffDays(today, g.deadline) >= 0 ? `${t('Залишилось')} ${diffDays(today, g.deadline)} ${t('дн.')}` : t('Дедлайн минув')}</div>}
            </div>); })}
        </Card>
      </div>
    ) : null,
    energy: () => (
      <Card className="p-4">
        <div className="flex items-center justify-between"><div className="text-[12px] font-bold uppercase tracking-wider text-mute">{t('Енергія зараз')}</div>
          {lastEnergy && <div className="text-[12px] text-mute tabular">{t('востаннє')} {pad(new Date(lastEnergy.ts).getHours())}:{pad(new Date(lastEnergy.ts).getMinutes())}</div>}</div>
        <div className="flex justify-between mt-3">
          {[['😴', 1], ['😐', 2], ['🙂', 3], ['😃', 4], ['⚡', 5]].map(([e, v]) => (
            <button key={v} onClick={() => { S.addEnergy(v as number); ui.toast(t('Енергію записано — Smart Planner це враховує'), { tone: 'good', ms: 2200 }); }} className="pressable w-[52px] h-[52px] rounded-2xl bg-card2 text-[26px] flex items-center justify-center" aria-label={`${v}`}>{e}</button>
          ))}
        </div>
        <div className="text-[12px] text-mute mt-2.5">{t('Записи допомагають розставляти складні справи на ваші пікові години.')}</div>
      </Card>
    ),
    countdowns: () => cds.length ? (
      <div>
        <SectionTitle right={<button onClick={() => ui.push('countdowns')} className="text-accent text-[14px] font-semibold pressable">{t('Усі')}</button>}>{t('Відлік')}</SectionTitle>
        <div className="flex gap-3 overflow-x-auto scroll -mx-4 px-4 pb-1">
          {cds.map((c) => (
            <Card key={c.id} onClick={() => ui.push('countdowns')} className="shrink-0 w-[150px] p-3.5">
              <div className="text-[26px]">{c.emoji}</div><div className="font-semibold text-[14.5px] mt-1 truncate">{c.title}</div>
              <div className="text-[22px] font-extrabold tabular mt-0.5">{diffDays(today, c.date)} <span className="text-[13px] text-mute font-semibold">{t('дн.')}</span></div>
            </Card>
          ))}
        </div>
      </div>
    ) : null,
  };

  return (
    <div className="absolute inset-0 scroll" style={{ paddingBottom: 'calc(var(--sab) + 110px)' }}>
      <div className="safe-top">
        <div className="px-4 pt-3 pb-2 flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-mute cap1">{fullDate(today)}</div>
            <h1 className="text-[30px] font-extrabold tracking-tight leading-tight truncate">{t(greeting(hours))}{settings.name ? `, ${settings.name}` : ''}</h1>
            <div className="text-[40px] font-extralight tabular leading-none mt-1 tracking-tight">{fmtTime(timeStr, settings.timeFormat)}</div>
          </div>
          <div className="flex gap-2 pt-1 shrink-0">
            <button aria-label={t('Пошук')} onClick={() => openSearch()} className="pressable w-10 h-10 rounded-full bg-card2/80 flex items-center justify-center"><Search size={19} /></button>
            <button aria-label={t('Налаштувати блоки')} onClick={() => ui.sheet((c) => <Customize close={c} />)} className="pressable w-10 h-10 rounded-full bg-card2/80 flex items-center justify-center"><SlidersHorizontal size={19} /></button>
          </div>
        </div>
        <div className="px-4 flex flex-col gap-4 mt-2">
          {(morningDue || eveningDue) && (
            <Card className="p-4 flex items-center gap-3 !bg-accent/12 border !border-accent/30" onClick={() => ui.push(eveningDue ? 'evening' : 'morning')}>
              <div className="text-[28px]">{eveningDue ? '🌙' : '☀️'}</div>
              <div className="flex-1"><div className="font-bold">{eveningDue ? t('Час підбити підсумки дня') : t('Ранковий огляд готовий')}</div><div className="text-[13px] text-mute">{eveningDue ? t('Вечірній огляд — перегляд і планування завтра') : t('Огляньте день і розпочніть його')}</div></div>
              <span className="text-accent font-bold">›</span>
            </Card>
          )}
          {settings.homeBlocks.filter((b) => b.visible).map((b) => <div key={b.id}>{render[b.id]?.()}</div>)}
          {!total && !app.tasks.length && (
            <Card className="p-5 text-center">
              <div className="text-[34px]">✨</div><div className="font-bold text-[18px] mt-1">{t('Почнімо з першого завдання')}</div>
              <div className="text-[14px] text-mute mt-1 mb-3">{t('Натисніть «+» і напишіть, наприклад: «Завтра о 18:00 тренування на годину»')}</div>
              <Btn onClick={() => ui.push('templates')} variant="soft">{t('Або застосуйте шаблон дня')}</Btn>
            </Card>
          )}
          
        </div>
      </div>
    </div>
  );
};

const diffMin = (m: number) => (m <= 0 ? t('зараз') : m < 60 ? `${t('через')} ${m} ${t('хв')}` : `${t('через')} ${fmtDur(m)}`);
const todayFromTs = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
