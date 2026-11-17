import { useEffect, useMemo, useRef, useState } from 'react';
import { Link2, Maximize2, Minus, Pause, Play, Plus, RotateCcw, SkipForward, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import * as S from '../lib/store';
import { useApp } from '../lib/store';
import { Btn, Card, Chip, Ring, SectionTitle, SheetFrame, Segmented, cx } from '../ui/kit';
import { PRESETS, pause, presetMinutes, remaining, reset, resume, setPreset, setTask, skipPhase, start, useTimer } from '../lib/timer';
import { ui, useUI } from '../ui/uiStore';
import { addDays, fmtDur, pad, todayKey } from '../lib/dates';
import { focusMinutesOn, localKey } from '../lib/score';
import { occurrencesOn } from '../lib/recur';
import { unlockAudio } from '../lib/sound';
import { t } from '../lib/i18n';

const fmtClock = (ms: number) => { const s = Math.ceil(ms / 1000); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };

const TaskPicker = ({ close }: { close: () => void }) => {
  const app = useApp();
  const tm = useTimer();
  const today = todayKey();
  const list = useMemo(() => [...occurrencesOn(app.tasks, today, app.settings.defaultDuration), ...app.tasks.filter((t0) => t0.repeat === 'none' && t0.date && t0.date < today && t0.doneAt == null).map((t0) => ({ task: t0, date: t0.date!, done: false, start: t0.start, end: t0.end, dur: 30 }))].filter((o) => !o.done), [app.tasks, today, app.settings.defaultDuration]);
  return (
    <SheetFrame title={t('Прив’язати до завдання')} onClose={close}>
      <div className="card overflow-hidden">
        <button onClick={() => { setTask(null); close(); }} className="pressable w-full flex items-center justify-between px-4 h-[52px] hair-b text-left"><span className="font-medium text-mute">{t('Без завдання')}</span>{!tm.taskId && <span className="text-accent font-bold">✓</span>}</button>
        {list.map((o) => (
          <button key={o.task.id} onClick={() => { setTask(o.task.id); close(); }} className="pressable w-full flex items-center justify-between px-4 min-h-[52px] py-2 hair-b last:border-b-0 text-left">
            <span className="font-medium truncate pr-3">{o.task.title}</span>{tm.taskId === o.task.id && <span className="text-accent font-bold">✓</span>}
          </button>
        ))}
      </div>
      {!list.length && <div className="text-center text-mute text-[14px] py-6">{t('Немає невиконаних завдань на сьогодні')}</div>}
    </SheetFrame>
  );
};

const Controls = ({ big }: { big?: boolean }) => {
  const tm = useTimer();
  const sz = big ? 'h-16' : 'h-14';
  return (
    <div className="flex items-center justify-center gap-3">
      <button aria-label={t('Скинути')} onClick={reset} className={cx('pressable w-14 h-14 rounded-full bg-card2 flex items-center justify-center', tm.status === 'idle' && 'opacity-40')}><RotateCcw size={22} /></button>
      {tm.status === 'running'
        ? <button onClick={pause} aria-label={t('Пауза')} className={cx('pressable px-10 rounded-full bg-warn/20 text-warn font-bold text-[18px] flex items-center gap-2', sz)}><Pause size={24} fill="currentColor" />{t('Пауза')}</button>
        : <button onClick={() => { unlockAudio(); tm.status === 'paused' ? resume() : start(); }} aria-label={tm.status === 'paused' ? t('Продовжити') : t('Старт')} className={cx('pressable px-10 rounded-full bg-accent text-white font-bold text-[18px] flex items-center gap-2 shadow-[0_10px_26px_-8px_rgb(var(--accent)/.8)]', sz)}><Play size={24} fill="currentColor" />{tm.status === 'paused' ? t('Продовжити') : t('Старт')}</button>}
      <button aria-label={t('Пропустити')} onClick={skipPhase} className="pressable w-14 h-14 rounded-full bg-card2 flex items-center justify-center"><SkipForward size={22} /></button>
    </div>
  );
};

const FullScreen = () => {
  const tm = useTimer();
  const app = useApp();
  const task = app.tasks.find((x) => x.id === tm.taskId);
  const left = remaining();
  const total = tm.planned * 60000;
  const lock = useRef<any>(null);
  useEffect(() => {
    (async () => { try { lock.current = await (navigator as any).wakeLock?.request('screen'); } catch { /* не підтримується */ } })();
    return () => { lock.current?.release?.().catch(() => {}); };
  }, []);
  return (
    <div className="fixed inset-0 z-[55] bg-bg flex flex-col items-center justify-center anim-fade" style={{ paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}>
      <button aria-label={t('Закрити')} onClick={() => ui.setFocusFull(false)} className="pressable absolute right-4 w-11 h-11 rounded-full bg-card2 flex items-center justify-center" style={{ top: 'calc(var(--sat) + 12px)' }}><X size={22} /></button>
      <div className={cx('text-[14px] font-bold uppercase tracking-[.2em] mb-6', tm.phase === 'focus' ? 'text-accent' : 'text-good')}>{tm.phase === 'focus' ? t('Фокус') : t('Перерва')}</div>
      <Ring value={total ? 1 - left / total : 0} size={Math.min(320, window.innerWidth - 56)} stroke={12} color={tm.phase === 'focus' ? 'rgb(var(--accent))' : 'rgb(var(--good))'}>
        <div className="text-center"><div className="text-[68px] font-extralight tabular leading-none tracking-tight">{fmtClock(left)}</div>
          {task && <div className="text-[14px] text-mute mt-3 max-w-[220px] truncate">{task.title}</div>}</div>
      </Ring>
      <div className="mt-12"><Controls big /></div>
      <div className="text-[12px] text-mute mt-8 px-10 text-center">{t('Екран не вимикатиметься, поки відкрито цей режим (якщо підтримує iOS).')}</div>
    </div>
  );
};

export const FocusScreen = () => {
  const app = useApp();
  const tm = useTimer();
  const { focusFull } = useUI();
  const [, force] = useState(0);
  useEffect(() => { const i = setInterval(() => force((x) => x + 1), 500); return () => clearInterval(i); }, []);
  const today = todayKey();
  const task = app.tasks.find((x) => x.id === tm.taskId);
  const left = remaining();
  const total = tm.planned * 60000;
  const todayMin = focusMinutesOn(app.sessions, today);
  const weekMin = Array.from({ length: 7 }, (_, i) => focusMinutesOn(app.sessions, addDays(today, -i))).reduce((a, b) => a + b, 0);
  const sessionsToday = app.sessions.filter((s) => localKey(s.start) === today && s.completed).length;
  const recent = [...app.sessions].sort((a, b) => b.start - a.start).slice(0, 12);
  const goal = app.settings.focusGoalMin;
  const custom = tm.presetId === 'custom';

  return (
    <div className="absolute inset-0 scroll" style={{ paddingBottom: 'calc(var(--sab) + 110px)' }}>
      {focusFull && <FullScreen />}
      <div className="safe-top">
        <div className="px-4 pt-3 flex items-center justify-between">
          <h1 className="text-[30px] font-extrabold tracking-tight">{t('Фокус')}</h1>
          <div className="flex gap-2">
            <button aria-label={t('Звук')} onClick={() => S.updateSettings({ timerSound: !app.settings.timerSound })} className="pressable w-10 h-10 rounded-full bg-card2/80 flex items-center justify-center">{app.settings.timerSound ? <Volume2 size={19} /> : <VolumeX size={19} className="text-mute" />}</button>
            <button aria-label={t('Повний екран')} onClick={() => ui.setFocusFull(true)} className="pressable w-10 h-10 rounded-full bg-card2/80 flex items-center justify-center"><Maximize2 size={19} /></button>
          </div>
        </div>

        <div className="px-4 mt-3">
          <Segmented value={tm.presetId} onChange={(v) => setPreset(v)} options={[...PRESETS.map((p) => ({ v: p.id, label: p.label })), { v: 'custom', label: t('Власний') }]} />
          {tm.status !== 'idle' && <div className="text-[12px] text-mute text-center mt-1.5">{t('Режим можна змінити після скидання таймера')}</div>}
        </div>

        <div className="flex flex-col items-center mt-6">
          <Ring value={total ? 1 - left / total : 0} size={268} stroke={14} color={tm.phase === 'focus' ? 'rgb(var(--accent))' : 'rgb(var(--good))'}>
            <div className="text-center">
              <div className={cx('text-[12px] font-bold uppercase tracking-[.2em]', tm.phase === 'focus' ? 'text-accent' : 'text-good')}>{tm.phase === 'focus' ? t('Фокус') : t('Перерва')}</div>
              <div className="text-[62px] font-extralight tabular leading-none tracking-tight mt-1">{fmtClock(left)}</div>
              <div className="text-[13px] text-mute mt-1.5">{tm.status === 'paused' ? t('Пауза') : tm.status === 'running' ? t('Триває') : `${tm.planned} ${t('хв')}`}</div>
            </div>
          </Ring>
        </div>

        {custom && tm.status === 'idle' && (
          <div className="px-4 mt-5 grid grid-cols-2 gap-3">
            {([['customFocus', 'Фокус, хв', 5, 180], ['customRest', 'Перерва, хв', 1, 60]] as const).map(([k, label, lo, hi]) => (
              <Card key={k} className="p-3 flex items-center justify-between">
                <div className="text-[12.5px] text-mute font-semibold">{t(label)}</div>
                <div className="flex items-center gap-2">
                  <button aria-label="-" className="pressable w-8 h-8 rounded-full bg-card2 flex items-center justify-center" onClick={() => { S.updateSettings({ [k]: Math.max(lo, app.settings[k] - 5) } as any); setTimeout(() => setPreset('custom'), 0); }}><Minus size={15} /></button>
                  <span className="w-8 text-center font-bold tabular">{app.settings[k]}</span>
                  <button aria-label="+" className="pressable w-8 h-8 rounded-full bg-card2 flex items-center justify-center" onClick={() => { S.updateSettings({ [k]: Math.min(hi, app.settings[k] + 5) } as any); setTimeout(() => setPreset('custom'), 0); }}><Plus size={15} /></button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="px-4 mt-6"><Controls /></div>

        <div className="px-4 mt-5">
          <Card onClick={() => ui.sheet((c) => <TaskPicker close={c} />)} className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center"><Link2 size={18} /></div>
            <div className="flex-1 min-w-0"><div className="text-[12px] font-bold uppercase tracking-wider text-mute">{t('Завдання')}</div><div className="font-semibold truncate">{task?.title ?? t('Без завдання — торкніться, щоб обрати')}</div></div>
          </Card>
        </div>

        <div className="px-4 mt-6">
          <SectionTitle>{t('Статистика фокусу')}</SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            {[[fmtDur(todayMin), t('Сьогодні')], [String(sessionsToday), t('Сесій')], [fmtDur(weekMin), t('7 днів')]].map(([v, l]) => (
              <Card key={l} className="p-3 text-center"><div className="text-[19px] font-extrabold tabular">{v}</div><div className="text-[12px] text-mute">{l}</div></Card>
            ))}
          </div>
          {goal > 0 && <div className="mt-3 text-[12.5px] text-mute text-center">{t('Ціль на день')}: {Math.min(100, Math.round((todayMin / goal) * 100))}% ({todayMin}/{goal} {t('хв')})</div>}
        </div>

        {recent.length > 0 && (
          <div className="px-4 mt-6">
            <SectionTitle>{t('Історія сесій')}</SectionTitle>
            <Card className="overflow-hidden">
              {recent.map((s) => {
                const tk = app.tasks.find((x) => x.id === s.taskId);
                const d = new Date(s.start);
                return (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3 hair-b last:border-b-0">
                    <div className={cx('w-2 h-2 rounded-full', s.completed ? 'bg-good' : 'bg-warn')} />
                    <div className="flex-1 min-w-0"><div className="font-semibold truncate">{tk?.title ?? t('Без завдання')}</div>
                      <div className="text-[12.5px] text-mute tabular">{localKey(s.start) === today ? t('Сьогодні') : localKey(s.start)} · {pad(d.getHours())}:{pad(d.getMinutes())} · {fmtDur(s.minutes)}{s.completed ? '' : ' · ' + t('перервано')}</div></div>
                    <button aria-label={t('Видалити')} onClick={() => S.deleteSession(s.id)} className="pressable text-mute w-8 h-8 flex items-center justify-center"><Trash2 size={16} /></button>
                  </div>
                );
              })}
            </Card>
          </div>
        )}

        <div className="px-4 mt-6 mb-2 text-[12px] text-mute leading-snug">
          ℹ️ {t('На iPhone застосунок призупиняється у фоні: таймер рахується за годинником і покаже правильний залишок після повернення. Сповіщення про завершення в закритому застосунку приходить лише через Web Push (потрібен сервер, див. Налаштування → Сповіщення).')}
        </div>
      </div>
    </div>
  );
};
export { presetMinutes };
