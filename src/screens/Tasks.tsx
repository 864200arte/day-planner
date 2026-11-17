import { useMemo, useState } from 'react';
import { ArrowDownUp, CheckCheck, ListChecks, Search, X } from 'lucide-react';
import { useApp } from '../lib/store';
import { Chip, Empty, SheetFrame, Segmented, Btn, cx } from '../ui/kit';
import { ui } from '../ui/uiStore';
import { addDays, diffDays, dayMonthShort, nowMin, relDay, todayKey, toMin } from '../lib/dates';
import { isOverdue, occurrencesOn, toOcc } from '../lib/recur';
import type { Occ } from '../lib/types';
import { TaskRow } from '../ui/TaskRow';
import { catLabel, PRIORITIES, useCats } from '../ui/hooks';
import { openQuickCapture } from './QuickCapture';
import { priorityScore } from '../lib/planner';
import { t } from '../lib/i18n';
import * as S from '../lib/store';

type When = 'today' | 'upcoming' | 'overdue' | 'all' | 'nodate' | 'done';
type Sort = 'date' | 'priority' | 'title' | 'created' | 'smart';

const WHENS: { v: When; label: string }[] = [
  { v: 'today', label: 'Сьогодні' }, { v: 'upcoming', label: 'Майбутні' }, { v: 'overdue', label: 'Прострочені' },
  { v: 'nodate', label: 'Без дати' }, { v: 'done', label: 'Виконані' }, { v: 'all', label: 'Усі' },
];
const SORTS: { v: Sort; label: string }[] = [
  { v: 'date', label: 'За датою' }, { v: 'smart', label: 'За важливістю (розумно)' }, { v: 'priority', label: 'За пріоритетом' }, { v: 'title', label: 'За назвою' }, { v: 'created', label: 'Нещодавно додані' },
];

export const TasksScreen = () => {
  const app = useApp();
  const cats = useCats();
  const today = todayKey();
  const [when, setWhen] = useState<When>('today');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [prio, setPrio] = useState<number | null>(null);
  const [onlyImp, setOnlyImp] = useState(false);
  const [sort, setSort] = useState<Sort>('date');
  const [searching, setSearching] = useState(false);

  const nm = nowMin();
  const occs = useMemo(() => {
    const out: Occ[] = [];
    const fb = app.settings.defaultDuration;
    for (const t0 of app.tasks) {
      if (t0.repeat !== 'none') {
        // повторювані: показуємо найближче входження (або сьогоднішнє)
        const list = [today, ...Array.from({ length: 30 }, (_, i) => addDays(today, i + 1))].filter((k) => occurrencesOn([t0], k, fb).length);
        if (when === 'done') { for (const k of Object.keys(t0.doneDates)) out.push(toOcc(t0, k, fb)); continue; }
        if (when === 'overdue' || when === 'nodate') continue;
        if (when === 'today') { if (list[0] === today) out.push(toOcc(t0, today, fb)); continue; }
        if (list[0]) out.push(toOcc(t0, list[0], fb));
        continue;
      }
      out.push(toOcc(t0, t0.date ?? '', fb));
    }
    return out;
  }, [app.tasks, when, today, app.settings.defaultDuration]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let list = occs.filter((o) => {
      const t0 = o.task;
      const d = t0.date;
      switch (when) {
        case 'today': if (t0.repeat === 'none' && !(d === today || (d && d < today && !o.done))) return false; if (t0.repeat !== 'none' && o.date !== today) return false; break;
        case 'upcoming': if (o.done) return false; if (t0.repeat === 'none' && !(d && d > today)) return false; if (t0.repeat !== 'none' && o.date <= today && false) return false; break;
        case 'overdue': if (!isOverdue(t0, today, nm)) return false; break;
        case 'nodate': if (t0.date || o.done) return false; break;
        case 'done': if (!o.done) return false; break;
        case 'all': break;
      }
      if (cat && t0.categoryId !== cat) return false;
      if (prio != null && t0.priority !== prio) return false;
      if (onlyImp && !t0.important) return false;
      if (ql && !(t0.title.toLowerCase().includes(ql) || t0.notes.toLowerCase().includes(ql))) return false;
      return true;
    });
    const cmpDate = (a: Occ, b: Occ) => (a.date || '9999').localeCompare(b.date || '9999') || (a.start ? toMin(a.start) : 9999) - (b.start ? toMin(b.start) : 9999) || b.task.priority - a.task.priority;
    list = [...list].sort(
      sort === 'date' ? cmpDate
        : sort === 'priority' ? (a, b) => b.task.priority - a.task.priority || cmpDate(a, b)
          : sort === 'title' ? (a, b) => a.task.title.localeCompare(b.task.title, 'uk')
            : sort === 'created' ? (a, b) => b.task.createdAt - a.task.createdAt
              : (a, b) => priorityScore(b.task, today, b.date || null).score - priorityScore(a.task, today, a.date || null).score,
    );
    if (when === 'done') list.reverse();
    return list;
  }, [occs, when, q, cat, prio, onlyImp, sort, today, nm]);

  const groups = useMemo(() => {
    if (sort !== 'date') return [{ key: '', label: '', items: filtered }];
    const m = new Map<string, Occ[]>();
    for (const o of filtered) { const k = o.task.repeat === 'none' && o.task.date && o.task.date < today && !o.done ? 'overdue' : o.date || 'none'; (m.get(k) ?? m.set(k, []).get(k)!).push(o); }
    const keys = [...m.keys()].sort((a, b) => (a === 'overdue' ? -1 : b === 'overdue' ? 1 : a === 'none' ? 1 : b === 'none' ? -1 : when === 'done' ? b.localeCompare(a) : a.localeCompare(b)));
    return keys.map((k) => ({ key: k, label: k === 'overdue' ? t('Прострочені') : k === 'none' ? t('Без дати') : relDay(k, today), items: m.get(k)! }));
  }, [filtered, sort, today, when]);

  const counts = useMemo(() => {
    const c = { today: 0, overdue: 0 };
    for (const o of occs) { if (o.date === today && !o.done) c.today++; if (isOverdue(o.task, today, nm)) c.overdue++; }
    return c;
  }, [occs, today, nm]);

  const filtersOn = !!cat || prio != null || onlyImp;
  const completeAll = () => { for (const o of filtered.filter((x) => !x.done)) S.toggleDone(o.task.id, o.date); ui.toast(t('Усе в цьому списку виконано'), { tone: 'good' }); };

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="safe-top shrink-0 glass hair-b z-20">
        <div className="px-4 pt-2 pb-2 flex items-center gap-2">
          <h1 className="text-[30px] font-extrabold tracking-tight flex-1">{t('Завдання')}</h1>
          <button aria-label={t('Пошук')} onClick={() => setSearching((s) => !s)} className={cx('pressable w-10 h-10 rounded-full flex items-center justify-center', searching ? 'bg-accent text-white' : 'bg-card2/80')}><Search size={19} /></button>
          <button aria-label={t('Сортування')} onClick={() => ui.sheet((c) => <SortSheet sort={sort} setSort={setSort} close={c} />)} className="pressable w-10 h-10 rounded-full bg-card2/80 flex items-center justify-center"><ArrowDownUp size={19} /></button>
        </div>
        {searching && (
          <div className="px-4 pb-2 anim-rise"><div className="relative"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Пошук за назвою та описом')} className="w-full h-11 pl-10 pr-10 rounded-2xl bg-card2 outline-none" />
            {q && <button aria-label="clear" onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-mute"><X size={17} /></button>}</div></div>
        )}
        <div className="flex gap-2 overflow-x-auto scroll px-4 pb-2.5">
          {WHENS.map((w) => (
            <Chip key={w.v} active={when === w.v} onClick={() => setWhen(w.v)}>{t(w.label)}{w.v === 'today' && counts.today > 0 ? <b className="text-[12px] opacity-80">{counts.today}</b> : null}{w.v === 'overdue' && counts.overdue > 0 ? <b className="text-[12px] text-bad">{counts.overdue}</b> : null}</Chip>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto scroll px-4 pb-2.5">
          <Chip active={onlyImp} onClick={() => setOnlyImp((v) => !v)}>⭐ {t('Важливі')}</Chip>
          {PRIORITIES.slice(1).reverse().map((p) => <Chip key={p.v} active={prio === p.v} color={p.color} onClick={() => setPrio(prio === p.v ? null : p.v)}>{p.short}</Chip>)}
          <span className="w-px bg-line/15 mx-0.5 shrink-0" />
          {cats.list.map((c) => <Chip key={c.id} active={cat === c.id} color={c.color} onClick={() => setCat(cat === c.id ? null : c.id)}><span className="w-2 h-2 rounded-full" style={{ background: c.color }} />{catLabel(c)}</Chip>)}
        </div>
      </div>

      <div className="flex-1 scroll px-4 pt-3" style={{ paddingBottom: 'calc(var(--sab) + 110px)' }}>
        {groups.map((g) => (
          <div key={g.key || 'all'} className="mb-4">
            {g.label && <div className={cx('flex items-center justify-between text-[13px] font-bold uppercase tracking-wider mb-2 px-1', g.key === 'overdue' ? 'text-bad' : 'text-mute')}><span className="cap1">{g.label}</span><span className="tabular">{g.items.length}</span></div>}
            <div className="flex flex-col gap-2">{g.items.map((o) => <TaskRow key={o.task.id + o.date} occ={o} showDate={when !== 'today' && sort !== 'date'} />)}</div>
          </div>
        ))}
        {!filtered.length && (
          <Empty icon={<ListChecks size={30} />} title={q || filtersOn ? t('Нічого не знайдено') : when === 'done' ? t('Виконаних ще немає') : when === 'overdue' ? t('Прострочених немає 🎉') : t('Список порожній')}
            text={q || filtersOn ? t('Спробуйте змінити фільтри або запит') : t('Додайте завдання кнопкою «+» — наприклад, «Сьогодні о 16:00 звіт на годину»')}
            action={filtersOn ? <Btn variant="soft" onClick={() => { setCat(null); setPrio(null); setOnlyImp(false); setQ(''); }}>{t('Скинути фільтри')}</Btn> : <Btn onClick={() => openQuickCapture()}>{t('Додати завдання')}</Btn>} />
        )}
        {filtered.some((o) => !o.done) && when !== 'done' && filtered.length > 1 && (
          <div className="flex justify-center pb-4"><button onClick={completeAll} className="pressable text-[13.5px] text-mute flex items-center gap-1.5 h-9 px-3"><CheckCheck size={16} />{t('Виконати все в списку')}</button></div>
        )}
        <div className="text-[11px] text-center text-mute pb-2">{filtered.length > 0 && `${filtered.length} ${t('завд.')} · ${diffDays(today, today) === 0 ? dayMonthShort(today) : ''}`}</div>
      </div>
    </div>
  );
};

const SortSheet = ({ sort, setSort, close }: { sort: Sort; setSort: (s: Sort) => void; close: () => void }) => (
  <SheetFrame title={t('Сортування')} onClose={close}>
    <Segmented value={'x' as any} onChange={() => {}} options={[]} className="hidden" />
    <div className="card overflow-hidden">
      {SORTS.map((s) => (
        <button key={s.v} onClick={() => { setSort(s.v); close(); }} className="pressable w-full flex items-center justify-between px-4 h-[52px] hair-b last:border-b-0 text-left">
          <span className="text-[16px] font-medium">{t(s.label)}</span>{sort === s.v && <span className="text-accent font-bold">✓</span>}
        </button>
      ))}
    </div>
  </SheetFrame>
);
