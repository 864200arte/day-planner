import { useMemo, useState } from 'react';
import { BookOpen, CalendarClock, CheckSquare, Command as Cmd, Flag, Repeat2, Search as SearchIcon } from 'lucide-react';
import { SheetFrame, cx } from '../ui/kit';
import { ui } from '../ui/uiStore';
import { useApp } from '../lib/store';
import * as S from '../lib/store';
import { addDays, dayMonthShort, fmtTime, todayKey } from '../lib/dates';
import { openTaskEditor } from './TaskEditor';
import { openQuickCapture } from './QuickCapture';
import { start as startTimer, setPreset } from '../lib/timer';
import { downloadFile, buildExport, exportFileName } from '../lib/backup';
import { t } from '../lib/i18n';

export const openSearch = (q = '') => ui.sheet((close) => <Search close={close} initial={q} />, { tall: true });

interface Cmd { id: string; label: string; hint?: string; run: () => void }

const Search = ({ close, initial }: { close: () => void; initial: string }) => {
  const app = useApp();
  const [q, setQ] = useState(initial);
  const today = todayKey();
  const run = (fn: () => void) => { close(); setTimeout(fn, 280); };

  const commands: Cmd[] = useMemo(() => [
    { id: 'new', label: t('Нове завдання'), hint: 'N', run: () => openQuickCapture() },
    { id: 'tomorrow', label: t('Додати на завтра'), run: () => openQuickCapture({ date: addDays(today, 1) }) },
    { id: 'focus25', label: t('Почати фокус 25/5'), run: () => { setPreset('25-5'); startTimer(); ui.go('focus'); } },
    { id: 'focus50', label: t('Почати фокус 50/10'), run: () => { setPreset('50-10'); startTimer(); ui.go('focus'); } },
    { id: 'morning', label: t('Ранковий огляд'), run: () => ui.push('morning') },
    { id: 'evening', label: t('Вечірній огляд'), run: () => ui.push('evening') },
    { id: 'plan', label: t('Спланувати сьогодні (Smart Planner)'), run: () => ui.push('planner', { date: today }) },
    { id: 'plan2', label: t('Спланувати завтра'), run: () => ui.push('planner', { date: addDays(today, 1) }) },
    { id: 'ai', label: t('Відкрити AI-помічника'), run: () => ui.push('assistant') },
    { id: 'cal', label: t('Календар: сьогодні'), run: () => ui.openDay(today) },
    { id: 'stats', label: t('Статистика'), run: () => ui.push('stats') },
    { id: 'habits', label: t('Звички'), run: () => ui.push('habits') },
    { id: 'journal', label: t('Записати у щоденник'), run: () => ui.push('journal', {}) },
    { id: 'theme', label: t('Змінити тему (темна/світла)'), run: () => { const dark = document.documentElement.dataset.theme === 'dark'; S.updateSettings({ theme: dark ? 'light' : 'dark' }); } },
    { id: 'export', label: t('Експортувати резервну копію (JSON)'), run: async () => { await downloadFile(exportFileName(), JSON.stringify(buildExport(), null, 2)); } },
    { id: 'settings', label: t('Налаштування'), run: () => ui.push('settings') },
  ], [today]);

  const ql = q.trim().toLowerCase();
  const isCmd = ql.startsWith('>');
  const needle = isCmd ? ql.slice(1).trim() : ql;

  const res = useMemo(() => {
    if (!needle) return null;
    const has = (s: string) => s.toLowerCase().includes(needle);
    return {
      tasks: app.tasks.filter((x) => has(x.title) || has(x.notes)).slice(0, 12),
      journal: app.journal.filter((j) => has(j.text) || j.thoughts.some(has)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
      goals: app.goals.filter((g) => has(g.title) || has(g.description) || g.milestones.some((m) => has(m.title))).slice(0, 8),
      habits: app.habits.filter((h) => has(h.name)).slice(0, 8),
      events: [...app.countdowns.filter((c) => has(c.title)).map((c) => ({ id: c.id, title: c.title, date: c.date, kind: 'cd' as const })),
        ...app.tasks.filter((x) => x.start && x.date && has(x.title)).slice(0, 6).map((x) => ({ id: x.id, title: x.title, date: x.date!, kind: 'ev' as const, start: x.start }))].slice(0, 10),
    };
  }, [needle, app]);

  const cmdList = commands.filter((c) => !needle || !isCmd ? true : c.label.toLowerCase().includes(needle));
  const cmdMatches = needle && !isCmd ? commands.filter((c) => c.label.toLowerCase().includes(needle)).slice(0, 4) : [];
  const empty = res && !res.tasks.length && !res.journal.length && !res.goals.length && !res.habits.length && !res.events.length && !cmdMatches.length;

  const Group = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="mb-4"><div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-mute mb-1.5 px-1">{icon}{title}</div><div className="card overflow-hidden">{children}</div></div>
  );
  const Item = ({ onClick, title, sub }: { onClick: () => void; title: string; sub?: string }) => (
    <button onClick={onClick} className="pressable w-full text-left px-4 py-3 hair-b last:border-b-0"><div className="font-semibold truncate">{title}</div>{sub && <div className="text-[12.5px] text-mute truncate">{sub}</div>}</button>
  );

  return (
    <SheetFrame title={t('Пошук і команди')} onClose={close}>
      <div className="relative mb-4">
        <SearchIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Завдання, нотатки, цілі, звички… або > команда')} className="w-full h-12 pl-11 pr-4 rounded-2xl bg-card2 outline-none" enterKeyHint="search" />
      </div>

      {(!needle || isCmd) && (
        <Group title={t('Швидкі команди')} icon={<Cmd size={13} />}>
          {cmdList.map((c) => <Item key={c.id} title={c.label} sub={c.hint ? `⌨ ${c.hint}` : undefined} onClick={() => run(c.run)} />)}
        </Group>
      )}
      {res && !isCmd && (
        <>
          {cmdMatches.length > 0 && <Group title={t('Команди')} icon={<Cmd size={13} />}>{cmdMatches.map((c) => <Item key={c.id} title={c.label} onClick={() => run(c.run)} />)}</Group>}
          {res.tasks.length > 0 && <Group title={t('Завдання')} icon={<CheckSquare size={13} />}>{res.tasks.map((x) => <Item key={x.id} title={x.title} sub={`${x.date ? dayMonthShort(x.date) : t('без дати')}${x.start ? ' · ' + fmtTime(x.start) : ''}${x.doneAt || Object.keys(x.doneDates).length && x.repeat !== 'none' && false ? ' · ✓' : ''}`} onClick={() => run(() => openTaskEditor({ id: x.id, date: x.date ?? undefined }))} />)}</Group>}
          {res.events.length > 0 && <Group title={t('Події')} icon={<CalendarClock size={13} />}>{res.events.map((x) => <Item key={x.kind + x.id} title={x.title} sub={`${dayMonthShort(x.date)}${(x as any).start ? ' · ' + (x as any).start : ''}`} onClick={() => run(() => (x.kind === 'cd' ? ui.push('countdowns') : ui.openDay(x.date)))} />)}</Group>}
          {res.journal.length > 0 && <Group title={t('Нотатки')} icon={<BookOpen size={13} />}>{res.journal.map((j) => <Item key={j.id} title={dayMonthShort(j.date)} sub={snippet(j.text, needle)} onClick={() => run(() => ui.push('journal', { date: j.date }))} />)}</Group>}
          {res.goals.length > 0 && <Group title={t('Цілі')} icon={<Flag size={13} />}>{res.goals.map((g) => <Item key={g.id} title={g.title} sub={`${g.milestones.filter((m) => m.done).length}/${g.milestones.length}`} onClick={() => run(() => ui.push('goals'))} />)}</Group>}
          {res.habits.length > 0 && <Group title={t('Звички')} icon={<Repeat2 size={13} />}>{res.habits.map((h) => <Item key={h.id} title={`${h.emoji} ${h.name}`} onClick={() => run(() => ui.push('habits'))} />)}</Group>}
          {empty && <div className={cx('text-center text-mute py-10')}>{t('Нічого не знайдено')}</div>}
        </>
      )}
    </SheetFrame>
  );
};

const snippet = (text: string, needle: string) => {
  const i = text.toLowerCase().indexOf(needle);
  if (i < 0) return text.slice(0, 90);
  return (i > 20 ? '…' : '') + text.slice(Math.max(0, i - 20), i + needle.length + 60);
};
