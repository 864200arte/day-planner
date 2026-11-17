import { useMemo, useState } from 'react';
import { AlertTriangle, Battery, Coffee, Minus, Plus, ShieldAlert, Wand2 } from 'lucide-react';
import { useApp } from '../lib/store';
import * as S from '../lib/store';
import { Btn, Card, Chip, PageShell, Segmented, SectionTitle, Bar, cx } from '../ui/kit';
import { addDays, fmtDur, fmtTime, fromMin, fullDate, nowMin, todayKey, toMin } from '../lib/dates';
import { autoSchedule, energyProfile, priorityScore } from '../lib/planner';
import { findConflicts, occurrencesOn } from '../lib/recur';
import { ui } from '../ui/uiStore';
import { openTaskEditor } from './TaskEditor';
import { t } from '../lib/i18n';
import type { Task } from '../lib/types';

type Tab = 'plan' | 'prio' | 'energy' | 'conflict';

export const PlannerPage = ({ date: initial }: { date?: string }) => {
  const app = useApp();
  const today = todayKey();
  const { settings } = app;
  const [date, setDate] = useState(initial ?? (nowMin() > toMin(settings.workEnd) - 60 ? addDays(today, 1) : today));
  const [tab, setTab] = useState<Tab>('plan');
  const [reserve, setReserve] = useState(15);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState(false);

  const occs = useMemo(() => occurrencesOn(app.tasks, date, settings.defaultDuration), [app.tasks, date, settings.defaultDuration]);
  const candidates = useMemo<Task[]>(() => app.tasks.filter((t0) => t0.repeat === 'none' && t0.doneAt == null && !t0.start && (t0.date === date || (date === today && !!t0.date && t0.date < today) || (!t0.date && date === today))), [app.tasks, date, today]);
  const energy = useMemo(() => energyProfile(app.energy, settings.personalization), [app.energy, settings.personalization]);

  const plan = useMemo(() => autoSchedule({
    date, today, candidates: candidates.filter((c) => !excluded.has(c.id)), existing: occs.filter((o) => o.start), settings, energy: energy.hours, reservePct: reserve / 100,
  }), [date, today, candidates, excluded, occs, settings, energy, reserve]);

  const conflicts = useMemo(() => findConflicts(occs), [occs]);
  const ranked = useMemo(() => occs.filter((o) => !o.done).map((o) => ({ o, p: priorityScore(o.task, today, o.date) })).sort((a, b) => b.p.score - a.p.score), [occs, today]);

  const apply = async () => {
    if (!plan.items.length) return;
    const ok = await ui.confirm({ title: t('Застосувати розклад?'), message: `${plan.items.length} ${t('завд. отримають час у календарі на')} ${fullDate(date)}. ${t('Ви зможете скасувати кожну зміну вручну.')}`, ok: t('Застосувати') });
    if (!ok) return;
    const before = plan.items.map((it) => { const t0 = S.getState().tasks.find((x) => x.id === it.taskId)!; return { id: t0.id, date: t0.date, start: t0.start, end: t0.end, remind: t0.remind, movedCount: t0.movedCount, moves: t0.moves }; });
    for (const it of plan.items) {
      const t0 = S.getState().tasks.find((x) => x.id === it.taskId); if (!t0) continue;
      const moved = t0.date !== date && !!t0.date;
      S.updateTask(it.taskId, { date, start: fromMin(it.start), end: fromMin(Math.min(1439, it.end)), estimate: null, remind: t0.remind.length ? t0.remind : [...settings.defaultReminders], ...(moved ? { movedCount: t0.movedCount + 1, moves: [...t0.moves, { from: t0.date, to: date, at: Date.now() }] } : {}) });
    }
    setApplied(true);
    ui.toast(`${t('Розклад застосовано')}: ${plan.items.length}`, { tone: 'good', ms: 6000, action: { label: t('Скасувати'), fn: () => { before.forEach((b) => S.updateTask(b.id, { date: b.date, start: b.start, end: b.end, remind: b.remind, movedCount: b.movedCount, moves: b.moves })); setApplied(false); } } });
  };

  const prof = energy.hours;
  return (
    <PageShell title="Smart Planner" sub={t('Пропонує — ви вирішуєте. Нічого не змінюється без підтвердження.')}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={(e) => { setDate(e.target.value || today); setApplied(false); }} className="flex-1 h-11 px-4 rounded-2xl bg-card2 outline-none min-w-0" />
          <Chip active={date === today} onClick={() => setDate(today)}>{t('Сьогодні')}</Chip>
          <Chip active={date === addDays(today, 1)} onClick={() => setDate(addDays(today, 1))}>{t('Завтра')}</Chip>
        </div>
        <Segmented<Tab> value={tab} onChange={setTab} options={[{ v: 'plan', label: t('Розклад') }, { v: 'prio', label: t('Пріоритети') }, { v: 'energy', label: t('Енергія') }, { v: 'conflict', label: conflicts.length ? `${t('Конфлікти')} ${conflicts.length}` : t('Конфлікти') }]} />

        {tab === 'plan' && (
          <>
            <Card className="p-4">
              <div className="flex justify-between text-[13px] text-mute mb-1.5"><span>{t('Навантаження після плану')}</span><b className={cx(plan.loadPct > 85 ? 'text-bad' : 'text-ink')}>{plan.loadPct}%</b></div>
              <Bar value={plan.loadPct / 100} color={plan.loadPct > 85 ? 'rgb(var(--bad))' : plan.loadPct > 65 ? 'rgb(var(--warn))' : 'rgb(var(--good))'} />
              <div className="text-[12.5px] text-mute mt-2">{t('Зайнято')} {fmtDur(plan.busyMinutes)} · {t('нове')} {fmtDur(plan.plannedMinutes)} · {t('резерв')} {fmtDur(plan.reserveMinutes)}</div>
              <div className="flex items-center justify-between mt-3 pt-3 hair-t">
                <div><div className="text-[14px] font-semibold">{t('Часовий буфер між справами')}</div><div className="text-[12px] text-mute">Time Buffer</div></div>
                <div className="flex items-center gap-2"><button aria-label="-" onClick={() => S.updateSettings({ bufferMin: Math.max(0, settings.bufferMin - 5) })} className="pressable w-9 h-9 rounded-full bg-card2 flex items-center justify-center"><Minus size={16} /></button><span className="w-14 text-center font-bold tabular">{settings.bufferMin} {t('хв')}</span><button aria-label="+" onClick={() => S.updateSettings({ bufferMin: Math.min(60, settings.bufferMin + 5) })} className="pressable w-9 h-9 rounded-full bg-card2 flex items-center justify-center"><Plus size={16} /></button></div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div><div className="text-[14px] font-semibold">{t('Резерв часу')}</div><div className="text-[12px] text-mute">{t('частка вільного часу, яку не заповнюємо')}</div></div>
                <div className="flex items-center gap-2"><button aria-label="-" onClick={() => setReserve((r) => Math.max(0, r - 5))} className="pressable w-9 h-9 rounded-full bg-card2 flex items-center justify-center"><Minus size={16} /></button><span className="w-14 text-center font-bold tabular">{reserve}%</span><button aria-label="+" onClick={() => setReserve((r) => Math.min(50, r + 5))} className="pressable w-9 h-9 rounded-full bg-card2 flex items-center justify-center"><Plus size={16} /></button></div>
              </div>
            </Card>

            <div>
              <SectionTitle>{t('Що розставляємо')} · {candidates.length}</SectionTitle>
              {candidates.length === 0 ? <Card className="p-4 text-[14px] text-mute">{t('Немає завдань без часу на цю дату. Додайте завдання (з тривалістю, але без часу початку) — і Smart Planner розподілить їх.')}</Card> : (
                <div className="flex flex-wrap gap-2">{candidates.map((c) => <Chip key={c.id} active={!excluded.has(c.id)} onClick={() => setExcluded((s) => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}>{c.title}</Chip>)}</div>
              )}
            </div>

            {plan.items.length > 0 && (
              <div>
                <SectionTitle>{t('Пропозиція')}</SectionTitle>
                <Card className="overflow-hidden">
                  {plan.items.map((it) => (
                    <div key={it.taskId} className="flex gap-3 px-4 py-3 hair-b last:border-b-0">
                      <div className="w-[88px] shrink-0 text-[14px] font-bold tabular text-accent">{fmtTime(fromMin(it.start), settings.timeFormat)}<span className="text-mute font-medium">–{fmtTime(fromMin(it.end), settings.timeFormat)}</span></div>
                      <div className="flex-1 min-w-0"><div className="font-semibold truncate">{it.title}</div><div className="text-[12.5px] text-mute">{it.reason}</div></div>
                    </div>
                  ))}
                </Card>
              </div>
            )}
            {plan.breaks.length > 0 && <Card className="p-3.5 flex items-center gap-3"><Coffee size={20} className="text-good" /><div className="text-[13.5px]"><b>{t('Рекомендовані перерви')}:</b> {plan.breaks.map((b) => fmtTime(fromMin(b.start), settings.timeFormat)).join(', ')}</div></Card>}
            {plan.unplaced.length > 0 && (
              <Card className="p-3.5"><div className="text-[13px] font-bold text-warn mb-1.5 flex items-center gap-1.5"><ShieldAlert size={15} />{t('Не вдалося розмістити')}</div>
                {plan.unplaced.map((u) => <div key={u.taskId} className="text-[13.5px] py-0.5"><b>{u.title}</b> <span className="text-mute">— {u.why}</span></div>)}
                <Btn size="sm" variant="soft" className="mt-2" onClick={() => ui.push('evening', {})}>{t('Перенести вручну')}</Btn></Card>
            )}
            {plan.warnings.map((w) => <div key={w} className="text-[13px] text-warn flex gap-2 px-1"><AlertTriangle size={15} className="shrink-0 mt-0.5" />{w}</div>)}

            <Btn size="lg" full icon={<Wand2 size={19} />} disabled={!plan.items.length || applied} onClick={apply}>{applied ? t('Застосовано ✓') : `${t('Застосувати розклад')} (${plan.items.length})`}</Btn>
          </>
        )}

        {tab === 'prio' && (
          <div>
            <p className="text-[13.5px] text-mute mb-3">Priority Intelligence: {t('оцінка враховує пріоритет, важливість, прострочення та перенесення.')}</p>
            <Card className="overflow-hidden">{ranked.map(({ o, p }) => (
              <div key={o.task.id} onClick={() => openTaskEditor({ id: o.task.id, date })} className="px-4 py-3 hair-b last:border-b-0 pressable cursor-pointer">
                <div className="flex justify-between gap-3"><div className="font-semibold truncate">{o.task.title}</div><div className="font-extrabold tabular text-accent">{p.score}</div></div>
                <div className="text-[12.5px] text-mute">{p.reasons.join(' · ') || t('без особливих факторів')}</div>
              </div>))}
              {!ranked.length && <div className="p-4 text-mute text-[14px]">{t('Немає невиконаних завдань на цю дату.')}</div>}</Card>
          </div>
        )}

        {tab === 'energy' && (
          <div>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-mute mb-3"><Battery size={15} />{t('Крива енергії за добу')}</div>
              <div className="flex items-end gap-[3px] h-[110px]">
                {prof.map((v, h) => <div key={h} className="flex-1 rounded-t-sm" style={{ height: `${(v / 5) * 100}%`, background: v >= 3.8 ? 'rgb(var(--good))' : v >= 2.6 ? 'rgb(var(--accent))' : 'rgb(var(--mute) / .5)', opacity: h >= 6 && h <= 23 ? 1 : 0.4 }} />)}
              </div>
              <div className="flex justify-between text-[10.5px] text-mute mt-1 tabular"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div>
              <p className="text-[12.5px] text-mute mt-3">{energy.samples ? `${t('Спирається на')} ${energy.samples} ${t('ваших записів')} + ${t('типову криву.')}` : t('Поки що використовується типова крива. Записуйте енергію на Головній — планувальник підлаштується під вас.')}</p>
            </Card>
            <div className="flex justify-between mt-3">{[['😴', 1], ['😐', 2], ['🙂', 3], ['😃', 4], ['⚡', 5]].map(([e, v]) => <button key={v} aria-label={`${v}`} onClick={() => { S.addEnergy(v as number); ui.toast(t('Записано'), { tone: 'good', ms: 1500 }); }} className="pressable w-[56px] h-[56px] rounded-2xl bg-card2 text-[28px] flex items-center justify-center">{e}</button>)}</div>
            <div className="flex items-center justify-between mt-4 px-1"><div className="text-[14px] font-semibold">{t('Враховувати мої записи')}</div><button onClick={() => S.updateSettings({ personalization: !settings.personalization })} className={cx('pressable px-3 h-8 rounded-full text-[13px] font-bold', settings.personalization ? 'bg-good/15 text-good' : 'bg-card2 text-mute')}>{settings.personalization ? t('Так') : t('Ні')}</button></div>
          </div>
        )}

        {tab === 'conflict' && (
          <div>
            <p className="text-[13.5px] text-mute mb-3">Conflict Detector: {t('події з накладанням за часом на')} {fullDate(date)}.</p>
            {conflicts.length === 0 ? <Card className="p-5 text-center"><div className="text-[30px]">✅</div><div className="font-bold mt-1">{t('Конфліктів немає')}</div></Card> : (
              <div className="flex flex-col gap-2">{conflicts.map(([a, b], i) => (
                <Card key={i} className="p-3.5 border !border-bad/40">
                  <div className="text-[13px] font-bold text-bad mb-1.5">{t('Накладання')} #{i + 1}</div>
                  {[a, b].map((o) => <div key={o.task.id} onClick={() => openTaskEditor({ id: o.task.id, date })} className="flex justify-between py-1 pressable cursor-pointer"><span className="font-semibold">{o.task.title}</span><span className="text-mute tabular text-[13px]">{fmtTime(o.start, settings.timeFormat)}–{fmtTime(fromMin(toMin(o.start!) + o.dur), settings.timeFormat)}</span></div>)}
                </Card>))}</div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
};
