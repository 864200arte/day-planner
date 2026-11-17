import { useMemo } from 'react';
import { Coffee, Sun } from 'lucide-react';
import { useApp } from '../lib/store';
import * as S from '../lib/store';
import { Btn, Card, PageShell, SectionTitle, Bar, Check2 } from '../ui/kit';
import { useOccs } from '../ui/derived';
import { greeting } from '../ui/derived';
import { fmtDur, fmtTime, fullDate, nowMin, todayKey, toMin, fromMin } from '../lib/dates';
import { dayFree, dayLoad, priorityScore } from '../lib/planner';
import { ui } from '../ui/uiStore';
import { openTopPicker } from './Home';
import { useCats } from '../ui/hooks';
import { toggleTask } from '../ui/actions';
import { openTaskEditor } from './TaskEditor';
import { t } from '../lib/i18n';

export const Morning = () => {
  const app = useApp();
  const today = todayKey();
  const occs = useOccs(today);
  const cats = useCats();
  const { settings } = app;
  const info = app.days.find((d) => d.date === today);
  const load = dayLoad(occs, settings);
  const free = useMemo(() => dayFree(occs, settings, undefined, 25), [occs, settings]);
  const freeTotal = free.reduce((a, s) => a + (s.end - s.start), 0);
  const top = (info?.top ?? []).map((id) => occs.find((o) => o.task.id === id)).filter(Boolean) as typeof occs;
  const important = occs.filter((o) => !o.done && (o.task.important || o.task.priority === 3)).sort((a, b) => priorityScore(b.task, today, today).score - priorityScore(a.task, today, today).score);
  const breaks = occs.filter((o) => o.task.categoryId === 'rest');
  const started = !!info?.startedAt;
  const hour = new Date().getHours();

  return (
    <PageShell title={`${t(greeting(hour))}${settings.name ? ', ' + settings.name : ''}`} sub={fullDate(today)}>
      <div className="flex flex-col gap-5">
        <Card className="p-4 aurora">
          <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-mute"><Sun size={14} />{t('Навантаження дня')}</div>
          <div className="flex items-baseline justify-between mt-1.5"><div className="text-[22px] font-extrabold">{t(load.label)}</div><div className="text-[15px] font-bold tabular text-mute">{load.pct}%</div></div>
          <div className="mt-2.5"><Bar value={load.pct / 100} color={load.pct > 85 ? 'rgb(var(--bad))' : load.pct > 65 ? 'rgb(var(--warn))' : 'rgb(var(--good))'} /></div>
          <div className="text-[13px] text-mute mt-2.5">{occs.length} {t('завд.')} · {fmtDur(load.minutes)} {t('із')} {fmtDur(toMin(settings.workEnd) - toMin(settings.workStart))} · {t('вільно')} {fmtDur(freeTotal)}</div>
          {load.pct > 85 && <div className="text-[13px] text-warn font-semibold mt-2">{t('Розгляньте перенесення менш важливих справ — Smart Planner допоможе.')}</div>}
        </Card>

        <div>
          <SectionTitle right={<button onClick={() => openTopPicker(today)} className="text-accent text-[14px] font-semibold pressable">{top.length ? t('Змінити') : t('Обрати')}</button>}>{t('Три головні цілі')}</SectionTitle>
          <Card className="overflow-hidden">
            {top.length ? top.map((o, i) => (
              <div key={o.task.id} className="flex items-center gap-3 px-4 py-3 hair-b last:border-b-0">
                <div className="w-6 h-6 rounded-full bg-accent/15 text-accent text-[13px] font-extrabold flex items-center justify-center">{i + 1}</div>
                <div className="flex-1 font-semibold truncate" onClick={() => openTaskEditor({ id: o.task.id, date: today })}>{o.task.title}</div>
                <Check2 done={o.done} color={cats.get(o.task.categoryId).color} onClick={() => toggleTask(o.task, today)} />
              </div>
            )) : <div className="p-4 text-[14px] text-mute">{t('Оберіть до трьох головних справ — вони впливають на оцінку дня.')}</div>}
          </Card>
        </div>

        <div>
          <SectionTitle>{t('Усі завдання на день')} · {occs.length}</SectionTitle>
          <Card className="overflow-hidden">
            {occs.map((o) => (
              <div key={o.task.id} onClick={() => openTaskEditor({ id: o.task.id, date: today })} className="flex items-center gap-3 px-4 py-2.5 hair-b last:border-b-0 pressable cursor-pointer">
                <div className="w-14 text-[13px] text-mute tabular">{o.start ? fmtTime(o.start, settings.timeFormat) : '—'}</div>
                <div className="w-1 self-stretch rounded-full" style={{ background: o.task.color || cats.get(o.task.categoryId).color }} />
                <div className="flex-1 min-w-0"><div className="font-semibold truncate">{o.task.title}</div><div className="text-[12px] text-mute">{fmtDur(o.dur)}</div></div>
              </div>
            ))}
            {!occs.length && <div className="p-4 text-mute text-[14px]">{t('На сьогодні нічого немає. Додайте завдання або застосуйте шаблон дня.')}</div>}
          </Card>
        </div>

        {important.length > 0 && (
          <div><SectionTitle>{t('Найважливіше')}</SectionTitle>
            <Card className="overflow-hidden">{important.slice(0, 5).map((o) => (
              <div key={o.task.id} className="px-4 py-3 hair-b last:border-b-0"><div className="font-semibold">{o.task.title}</div><div className="text-[12.5px] text-mute">{priorityScore(o.task, today, today).reasons.join(' · ')}</div></div>
            ))}</Card></div>
        )}

        <div>
          <SectionTitle>{t('Вільні проміжки')}</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {free.map((s) => <div key={s.start} className="px-3 h-9 rounded-full bg-good/15 text-good text-[13.5px] font-semibold flex items-center tabular">{fmtTime(fromMin(s.start), settings.timeFormat)}–{fmtTime(fromMin(s.end), settings.timeFormat)} · {fmtDur(s.end - s.start)}</div>)}
            {!free.length && <div className="text-[14px] text-mute">{t('Вільних проміжків від 25 хв немає.')}</div>}
          </div>
        </div>

        <div>
          <SectionTitle>{t('Перерви та відпочинок')}</SectionTitle>
          <Card className="overflow-hidden">
            {breaks.map((o) => <div key={o.task.id} className="flex items-center gap-3 px-4 py-3 hair-b last:border-b-0"><Coffee size={18} className="text-good" /><div className="flex-1 font-medium">{o.task.title}</div><div className="text-[13px] text-mute tabular">{o.start ? fmtTime(o.start, settings.timeFormat) : fmtDur(o.dur)}</div></div>)}
            {!breaks.length && <div className="p-4 text-[14px] text-mute">{t('Запланованих перерв немає. Додайте завдання категорії «Відпочинок» або запустіть Smart Planner — він запропонує паузи.')}</div>}
          </Card>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <Btn size="lg" full variant={started ? 'ghost' : 'primary'} onClick={() => {
            S.updateDay(today, { startedAt: info?.startedAt ?? Date.now() });
            ui.toast(started ? t('День уже розпочато') : t('День розпочато. Гарного вам дня!'), { tone: 'good' }); ui.pop();
          }}>{started ? t('День розпочато ✓') : t('Розпочати день')}</Btn>
          <Btn variant="soft" full onClick={() => ui.push('planner', { date: today })}>{t('Спланувати вільний час (Smart Planner)')}</Btn>
        </div>
        <div className="text-[12px] text-mute text-center">{t('Час появи огляду змінюється в Налаштуваннях')} ({fmtTime(settings.morningTime, settings.timeFormat)}){nowMin() < 0 ? '' : ''}</div>
      </div>
    </PageShell>
  );
};
