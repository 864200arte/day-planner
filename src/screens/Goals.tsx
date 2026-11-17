import { useState } from 'react';
import { Check, Flag, Plus, Trash2, X } from 'lucide-react';
import { useApp } from '../lib/store';
import * as S from '../lib/store';
import { Bar, Btn, Card, Empty, Field, PageShell, Ring, SheetFrame, TextArea, TextInput, cx } from '../ui/kit';
import { ui } from '../ui/uiStore';
import { dayMonthShort, diffDays, todayKey } from '../lib/dates';
import { PALETTE } from '../lib/defaults';
import { uid } from '../lib/ids';
import type { Goal } from '../lib/types';
import { t } from '../lib/i18n';

const progress = (g: Goal) => (g.milestones.length ? g.milestones.filter((m) => m.done).length / g.milestones.length : g.doneAt ? 1 : 0);

const GoalEditor = ({ id, close }: { id?: string; close: () => void }) => {
  const app = useApp();
  const g = id ? app.goals.find((x) => x.id === id) : undefined;
  const [title, setTitle] = useState(g?.title ?? '');
  const [desc, setDesc] = useState(g?.description ?? '');
  const [deadline, setDeadline] = useState(g?.deadline ?? '');
  const [color, setColor] = useState(g?.color ?? '#8b7cff');
  const [ms, setMs] = useState(g?.milestones ?? []);
  const [newMs, setNewMs] = useState('');
  const [newDue, setNewDue] = useState('');
  const addMs = () => { if (!newMs.trim()) return; setMs([...ms, { id: uid(), title: newMs.trim(), due: newDue || null, done: false }]); setNewMs(''); setNewDue(''); };
  const save = () => {
    if (!title.trim()) return;
    const patch = { title: title.trim(), description: desc.trim(), deadline: deadline || null, color, milestones: ms };
    if (g) S.updateGoal(g.id, patch); else S.addGoal(patch);
    close();
  };
  return (
    <SheetFrame title={g ? t('Ціль') : t('Нова ціль')} onClose={close} footer={<Btn full disabled={!title.trim()} onClick={save}>{t('Зберегти')}</Btn>}>
      <div className="flex flex-col gap-4">
        <TextInput autoFocus={!g} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('Назва цілі')} className="!text-[18px] font-semibold" />
        <TextArea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('Опис: навіщо це вам?')} />
        <Field label={t('Дедлайн')}><input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full h-12 px-4 rounded-2xl bg-card2 outline-none" /></Field>
        <Field label={t('Колір')}><div className="flex gap-2.5 flex-wrap">{PALETTE.map((c) => <button key={c} aria-label={c} onClick={() => setColor(c)} className="pressable w-8 h-8 rounded-full" style={{ background: c, boxShadow: color === c ? '0 0 0 3px rgb(var(--bg)), 0 0 0 5px ' + c : 'none' }} />)}</div></Field>
        <Field label={`${t('Підцілі та етапи')} (${ms.length})`}>
          <div className="card overflow-hidden mb-2">
            {ms.map((m) => (
              <div key={m.id} className="flex items-center gap-2 px-3 min-h-[48px] hair-b last:border-b-0">
                <button aria-label="done" onClick={() => setMs(ms.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)))} className={cx('pressable w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0', m.done ? 'bg-good border-good text-white' : 'border-mute/50')}>{m.done && <Check size={14} strokeWidth={3.5} />}</button>
                <div className={cx('flex-1 text-[15px] py-2', m.done && 'line-through text-mute')}>{m.title}{m.due && <span className="text-[12px] text-mute"> · {dayMonthShort(m.due)}</span>}</div>
                <button aria-label={t('Видалити')} onClick={() => setMs(ms.filter((x) => x.id !== m.id))} className="pressable text-mute w-8 h-8 flex items-center justify-center"><X size={16} /></button>
              </div>
            ))}
            {!ms.length && <div className="px-4 py-3 text-[13.5px] text-mute">{t('Розбийте ціль на 3–5 кроків — так прогрес видно щодня.')}</div>}
          </div>
          <div className="flex gap-2"><input value={newMs} onChange={(e) => setNewMs(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addMs(); }} placeholder={t('Новий етап')} className="flex-1 min-w-0 h-11 px-4 rounded-2xl bg-card2 outline-none" /><input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} className="w-[132px] h-11 px-2 rounded-2xl bg-card2 outline-none" /><button aria-label={t('Додати')} onClick={addMs} className="pressable w-11 h-11 rounded-2xl bg-accent text-white flex items-center justify-center"><Plus size={20} /></button></div>
        </Field>
        {g && <Btn variant="danger" icon={<Trash2 size={17} />} onClick={async () => { if (await ui.confirm({ title: t('Видалити ціль?'), ok: t('Видалити'), danger: true })) { S.deleteGoal(g.id); close(); } }}>{t('Видалити ціль')}</Btn>}
      </div>
    </SheetFrame>
  );
};

export const Goals = () => {
  const app = useApp();
  const today = todayKey();
  const active = app.goals.filter((g) => !g.doneAt), done = app.goals.filter((g) => g.doneAt);
  const open = (id?: string) => ui.sheet((c) => <GoalEditor id={id} close={c} />);
  const Item = ({ g }: { g: Goal }) => {
    const p = progress(g); const left = g.deadline ? diffDays(today, g.deadline) : null;
    const next = g.milestones.find((m) => !m.done);
    return (
      <Card className="p-4">
        <div className="flex items-center gap-4" onClick={() => open(g.id)}>
          <Ring value={p} size={64} stroke={7} color={g.color}><span className="text-[15px] font-extrabold tabular">{Math.round(p * 100)}%</span></Ring>
          <div className="flex-1 min-w-0"><div className="font-bold text-[17px] leading-snug">{g.title}</div>
            <div className="text-[12.5px] text-mute mt-0.5">{g.milestones.filter((m) => m.done).length}/{g.milestones.length} {t('етапів')}{left != null && ` · ${left >= 0 ? `${left} ${t('дн. до дедлайну')}` : `${t('дедлайн минув')} ${-left} ${t('дн. тому')}`}`}</div></div>
        </div>
        {g.milestones.length > 0 && (
          <div className="mt-3 pt-3 hair-t flex flex-col gap-1.5">
            {g.milestones.map((m) => (
              <button key={m.id} onClick={() => S.updateGoal(g.id, { milestones: g.milestones.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)) })} className="pressable flex items-center gap-2.5 text-left py-1">
                <span className={cx('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0', m.done ? 'bg-good border-good text-white' : 'border-mute/50')}>{m.done && <Check size={12} strokeWidth={3.5} />}</span>
                <span className={cx('flex-1 text-[14.5px]', m.done && 'line-through text-mute')}>{m.title}</span>
                {m.due && <span className={cx('text-[12px] tabular', !m.done && m.due < today ? 'text-bad' : 'text-mute')}>{dayMonthShort(m.due)}</span>}
              </button>
            ))}
          </div>
        )}
        {next && <div className="mt-2 text-[12.5px] text-mute">{t('Наступний крок')}: <b className="text-ink">{next.title}</b></div>}
        {g.milestones.length === 0 && (
          <div className="mt-3">{g.doneAt
            ? <Btn size="sm" variant="ghost" onClick={() => S.updateGoal(g.id, { doneAt: null })}>{t('Повернути в роботу')}</Btn>
            : <Btn size="sm" variant="good" onClick={() => { S.updateGoal(g.id, { doneAt: Date.now() }); ui.toast('🏆 ' + t('Ціль досягнуто!'), { tone: 'good' }); }}>{t('Позначити досягнутою')}</Btn>}</div>
        )}
        <div className="mt-3"><Bar value={p} color={g.color} h={6} /></div>
      </Card>
    );
  };
  return (
    <PageShell title={t('Цілі')} right={<button aria-label={t('Додати')} onClick={() => open()} className="pressable w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center"><Plus size={21} /></button>}>
      {!app.goals.length ? <Empty icon={<Flag size={30} />} title={t('Поставте першу ціль')} text={t('Велика мета + дедлайн + кілька етапів = видимий прогрес.')} action={<Btn onClick={() => open()}>{t('Створити ціль')}</Btn>} /> : (
        <div className="flex flex-col gap-3">{active.map((g) => <Item key={g.id} g={g} />)}
          {done.length > 0 && <><div className="text-[13px] font-bold uppercase tracking-wider text-mute mt-3 px-1">{t('Досягнуті')} 🏆</div>{done.map((g) => <Item key={g.id} g={g} />)}</>}</div>
      )}
    </PageShell>
  );
};
