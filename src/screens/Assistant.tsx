import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { useApp } from '../lib/store';
import * as S from '../lib/store';
import { Btn, cx } from '../ui/kit';
import { cloudAssistant, localAssistant, type Proposal } from '../lib/ai';
import { ui } from '../ui/uiStore';
import { fmtDur, fmtTime, fromMin, relDay } from '../lib/dates';
import { toTaskPatch } from './QuickCapture';
import { t } from '../lib/i18n';
import { ChevronLeft } from 'lucide-react';

interface Msg { role: 'user' | 'assistant'; text: string; proposal?: Proposal; source?: 'local' | 'cloud'; resolved?: boolean }

const SUGGEST = ['Завтра о 15:00 хочу навчатися дві години, а ввечері залишити час для відпочинку', 'Сплануй завтра', 'Яке навантаження на тиждень?', 'Перенеси прострочене на завтра', 'Проаналізуй мою продуктивність', 'Що з моїми цілями?'];

export const Assistant = () => {
  const app = useApp();
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'assistant', text: t('Привіт! Я допоможу створити завдання, спланувати день, оцінити навантаження та проаналізувати продуктивність. Усі зміни — лише після вашого підтвердження.'), source: 'local' }]);
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const cloud = app.settings.aiEnabled && !!app.settings.aiServer;
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const send = async (text: string) => {
    const s = text.trim(); if (!s || busy) return;
    setVal(''); setMsgs((m) => [...m, { role: 'user', text: s }]); setBusy(true);
    try {
      let r;
      if (cloud) {
        try { r = await cloudAssistant(app.settings.aiServer, s, S.snapshotData() as any, msgs.map((m) => ({ role: m.role, text: m.text }))); }
        catch (e: any) { r = localAssistant(s, S.snapshotData() as any); r.text = `⚠️ ${t('Хмарний AI недоступний')} (${e?.message || e}). ${t('Відповідаю локально:')}\n\n` + r.text; }
      } else r = localAssistant(s, S.snapshotData() as any);
      setMsgs((m) => [...m, { role: 'assistant', text: r.text, proposal: r.proposal, source: r.source }]);
    } finally { setBusy(false); }
  };

  const apply = (i: number) => {
    const m = msgs[i]; const p = m.proposal; if (!p) return;
    if (p.kind === 'tasks') {
      p.items.forEach((it) => S.addTask(toTaskPatch(it, app.settings)));
      ui.toast(`${t('Додано завдань')}: ${p.items.length}`, { tone: 'good' });
    } else if (p.kind === 'plan') {
      p.plan.items.forEach((it) => { const t0 = S.getState().tasks.find((x) => x.id === it.taskId); if (!t0) return; S.updateTask(it.taskId, { date: p.date, start: fromMin(it.start), end: fromMin(Math.min(1439, it.end)), estimate: null, remind: t0.remind.length ? t0.remind : [...app.settings.defaultReminders] }); });
      ui.toast(t('Розклад застосовано'), { tone: 'good' });
    } else if (p.kind === 'move') {
      p.items.forEach((it) => S.moveOccurrence(it.taskId, it.from, { date: it.to }));
      ui.toast(`${t('Перенесено')}: ${p.items.length}`, { tone: 'good' });
    }
    setMsgs((x) => x.map((mm, k) => (k === i ? { ...mm, resolved: true } : mm)));
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-bg">
      <div className="safe-top glass hair-b shrink-0 z-10">
        <div className="h-[52px] flex items-center px-2">
          <button onClick={() => ui.pop()} className="pressable flex items-center text-accent h-10 pl-1 pr-3 font-medium text-[17px]"><ChevronLeft size={26} strokeWidth={2.4} />{t('Назад')}</button>
          <div className="flex-1 text-center font-bold text-[16px] flex items-center justify-center gap-1.5"><Sparkles size={16} className="text-accent" />{t('AI-помічник')}</div>
          <div className="w-[84px] text-right pr-2 text-[11px] text-mute font-semibold">{cloud ? t('хмарний') : t('локальний')}</div>
        </div>
      </div>
      <div className="flex-1 scroll px-4 pt-3 flex flex-col gap-3">
        {msgs.map((m, i) => (
          <div key={i} className={cx('flex flex-col anim-rise', m.role === 'user' ? 'items-end' : 'items-start')}>
            <div className={cx('max-w-[88%] rounded-[20px] px-4 py-2.5 text-[15.5px] leading-snug whitespace-pre-line', m.role === 'user' ? 'bg-accent text-white rounded-br-md' : 'bg-card rounded-bl-md')} style={{ userSelect: 'text' }}>{m.text}</div>
            {m.proposal && (
              <div className="card mt-2 p-3 max-w-[92%] w-full">
                {m.proposal.kind === 'tasks' && m.proposal.items.map((it, k) => (
                  <div key={k} className="py-1.5 hair-b last:border-b-0"><div className="font-semibold">{it.title}</div>
                    <div className="text-[12.5px] text-mute">{it.date ? relDay(it.date) : t('без дати')}{it.start ? ` · ${fmtTime(it.start, app.settings.timeFormat)}${it.end ? '–' + fmtTime(it.end, app.settings.timeFormat) : ''}` : ''}{it.duration ? ` · ${fmtDur(it.duration)}` : ''}</div></div>
                ))}
                {m.proposal.kind === 'plan' && m.proposal.plan.items.map((it) => (
                  <div key={it.taskId} className="py-1.5 hair-b last:border-b-0 flex gap-3"><div className="w-[84px] tabular text-accent font-bold text-[13.5px]">{fmtTime(fromMin(it.start), app.settings.timeFormat)}–{fmtTime(fromMin(it.end), app.settings.timeFormat)}</div><div className="flex-1"><div className="font-semibold">{it.title}</div><div className="text-[12px] text-mute">{it.reason}</div></div></div>
                ))}
                {m.proposal.kind === 'move' && m.proposal.items.map((it) => <div key={it.taskId} className="py-1.5 hair-b last:border-b-0"><div className="font-semibold">{it.title}</div><div className="text-[12.5px] text-mute">{it.from} → {it.to}</div></div>)}
                <div className="flex gap-2 mt-2.5">
                  <Btn size="sm" full disabled={m.resolved} onClick={() => apply(i)}>{m.resolved ? t('Застосовано ✓') : t('Підтвердити')}</Btn>
                  {!m.resolved && <Btn size="sm" variant="ghost" onClick={() => setMsgs((x) => x.map((mm, k) => (k === i ? { ...mm, proposal: undefined } : mm)))}>{t('Відхилити')}</Btn>}
                </div>
              </div>
            )}
            {m.role === 'assistant' && m.source && i > 0 && <div className="text-[10.5px] text-mute mt-1 px-1">{m.source === 'cloud' ? t('хмарний AI') : t('локальний помічник')}</div>}
          </div>
        ))}
        {busy && <div className="self-start bg-card rounded-[20px] px-4 py-3 anim-pulse text-mute">…</div>}
        {msgs.length < 2 && <div className="flex flex-wrap gap-2 mt-1">{SUGGEST.map((s) => <button key={s} onClick={() => send(s)} className="pressable text-left text-[13.5px] bg-card2 rounded-2xl px-3 py-2 text-mute">{s}</button>)}</div>}
        <div ref={end} className="h-2" />
      </div>
      <div className="glass hair-t px-3 pt-2 shrink-0" style={{ paddingBottom: 'calc(var(--sab) + 8px)', marginBottom: 'var(--kb)' }}>
        <div className="flex gap-2 items-end">
          <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(val); }} placeholder={t('Напишіть команду або завдання…')} enterKeyHint="send" className="flex-1 h-12 px-4 rounded-full bg-card2 outline-none" />
          <button aria-label={t('Надіслати')} onClick={() => send(val)} disabled={!val.trim() || busy} className="pressable w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center disabled:opacity-40"><Send size={20} /></button>
        </div>
      </div>
    </div>
  );
};
