import { useEffect, type ReactNode } from 'react';
import { loadAll, useApp, getState, markFired, hasFired, setAchievements, snapshotData } from './lib/store';
import { SheetHost, TabBar, Toasts, PageLayer } from './ui/Host';
import { ui, useUI, type PageName, type Tab } from './ui/uiStore';
import { useVisualViewport } from './ui/kit';
import { startReminderEngine, type Due } from './lib/reminders';
import { playSound } from './lib/sound';
import { syncPush } from './lib/push';
import { autoSnapshotIfNeeded } from './lib/backup';
import { ACHIEVEMENTS, computeMetrics, newlyUnlocked } from './lib/achievements';
import { applyTheme } from './lib/store';
import { openQuickCapture } from './screens/QuickCapture';
import { openSearch } from './screens/Search';
import { openTaskEditor } from './screens/TaskEditor';
import { Home } from './screens/Home';
import { CalendarScreen } from './screens/Calendar';
import { TasksScreen } from './screens/Tasks';
import { FocusScreen } from './screens/Focus';
import { Profile } from './screens/Profile';
import { Morning } from './screens/Morning';
import { Evening } from './screens/Evening';
import { PlannerPage } from './screens/SmartPlanner';
import { Assistant } from './screens/Assistant';
import { Habits } from './screens/Habits';
import { Goals } from './screens/Goals';
import { Journal } from './screens/Journal';
import { Stats } from './screens/Stats';
import { Templates } from './screens/Templates';
import { Countdowns } from './screens/Countdowns';
import { Achievements } from './screens/Achievements';
import { Settings, Categories, NotificationsPage } from './screens/Settings';
import { Install } from './screens/Install';
import { BackupPage } from './screens/BackupPage';
import { Insights } from './screens/Insights';
import { ScoreExplain } from './screens/ScoreExplain';
import { t } from './lib/i18n';
import { resumeFromStorage } from './lib/timer';
import { Boundary } from './ui/Boundary';

const PAGES: Record<PageName, (p: any) => ReactNode> = {
  morning: () => <Morning />, evening: (p) => <Evening {...p} />, planner: (p) => <PlannerPage {...p} />, assistant: () => <Assistant />,
  habits: () => <Habits />, goals: () => <Goals />, journal: (p) => <Journal {...p} />, stats: () => <Stats />, templates: (p) => <Templates {...p} />,
  countdowns: () => <Countdowns />, achievements: () => <Achievements />, settings: () => <Settings />, install: () => <Install />,
  backup: () => <BackupPage />, insights: () => <Insights />, score: (p) => <ScoreExplain {...p} />, categories: () => <Categories />, notifications: () => <NotificationsPage />,
};

const TAB_VIEWS: Record<Tab, () => ReactNode> = {
  home: () => <Home />, calendar: () => <CalendarScreen />, tasks: () => <TasksScreen />, focus: () => <FocusScreen />, profile: () => <Profile />,
};

export const App = () => {
  const app = useApp();
  const { tab, pages, mounted } = useUI();
  useVisualViewport();

  useEffect(() => { loadAll(); }, []);

  // тема «авто» реагує на системну
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => { if (getState().settings.theme === 'auto') applyTheme(getState().settings); };
    mq.addEventListener?.('change', fn);
    return () => mq.removeEventListener?.('change', fn);
  }, []);

  // рушій нагадувань, знімки, постійне сховище
  useEffect(() => {
    if (!app.ready) return;
    const stop = startReminderEngine(() => snapshotData(), hasFired, markFired, (du: Due) => {
      const s = getState().settings;
      playSound(s.soundId, s.volume);
      ui.toast(`${du.kind === 'overdue' ? '⏰ ' : du.kind === 'task' ? '🔔 ' : '☀️ '}${du.title}: ${du.body}`, {
        tone: du.kind === 'overdue' ? 'warn' : 'info', ms: 9000,
        action: du.kind === 'morning' ? { label: t('Відкрити'), fn: () => ui.push('morning') } : du.kind === 'evening' ? { label: t('Відкрити'), fn: () => ui.push('evening') } : du.taskId ? { label: t('Відкрити'), fn: () => openTaskEditor({ id: du.taskId, date: du.date }) } : undefined,
      });
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        navigator.serviceWorker?.getRegistration().then((r) => r?.showNotification(du.title, { body: du.body, tag: du.key, data: { url: './' } })).catch(() => {});
      }
    });
    resumeFromStorage();
    // ярлики з manifest (довге натискання на іконку): ?action=new, ?tab=focus
    try {
      const q = new URLSearchParams(location.search);
      const tabParam = q.get('tab') as Tab | null;
      if (tabParam && ['home', 'calendar', 'tasks', 'focus', 'profile'].includes(tabParam)) ui.go(tabParam);
      if (q.get('action') === 'new') setTimeout(() => openQuickCapture(), 350);
      if (q.has('tab') || q.has('action')) history.replaceState(null, '', location.pathname);
    } catch { /* ігноруємо */ }
    autoSnapshotIfNeeded().catch(() => {});
    navigator.storage?.persist?.().catch(() => {});
    return stop;
  }, [app.ready]);

  // досягнення
  useEffect(() => {
    if (!app.ready) return;
    const id = setTimeout(() => {
      const st = getState();
      const { metrics } = computeMetrics(snapshotData());
      const fresh = newlyUnlocked(metrics, st.achievements);
      if (fresh.length) {
        const next = { ...st.achievements }; const now = Date.now();
        fresh.forEach((f) => { next[f] = now; });
        setAchievements(next);
        const a = ACHIEVEMENTS.find((x) => x.id === fresh[0])!;
        if (Object.keys(st.achievements).length || fresh.length < 3) ui.toast(`${a.emoji} ${t('Нове досягнення')}: ${a.title}`, { tone: 'good', ms: 5200, action: { label: t('Усі'), fn: () => ui.push('achievements') } });
      }
    }, 900);
    return () => clearTimeout(id);
  }, [app.tasks, app.habits, app.goals, app.sessions, app.journal, app.days, app.ready]);

  // синхронізація push-розкладу
  useEffect(() => { if (app.ready) syncPush(); }, [app.tasks, app.settings.morningEnabled, app.settings.morningTime, app.settings.eveningEnabled, app.settings.eveningTime, app.settings.remindOverdue, app.ready]);

  // гарячі клавіші — лише додатково для зовнішньої клавіатури
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
      else if (e.key === 'n' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openQuickCapture(); }
      else if (e.key === '/') { e.preventDefault(); openSearch(); }
      else if (e.key === 'Escape') { ui.closeSheet(); }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  if (!app.ready) return <div className="fixed inset-0 flex items-center justify-center bg-bg"><div className="w-12 h-12 rounded-2xl bg-accent/20 anim-pulse" /></div>;

  return (
    <div className="fixed inset-0 bg-bg text-ink overflow-hidden">
      {(['home', 'calendar', 'tasks', 'focus', 'profile'] as Tab[]).map((id) =>
        mounted.includes(id) ? (
          // visibility замість display:none — так Safari зберігає позицію прокрутки неактивних вкладок
          <div key={id} className={tab === id ? 'absolute inset-0' : 'absolute inset-0 invisible pointer-events-none'} aria-hidden={tab !== id} {...(tab !== id ? ({ inert: '' } as any) : {})}><Boundary label={id}>{TAB_VIEWS[id]()}</Boundary></div>
        ) : null,
      )}
      {app.persistError && <div className="fixed left-3 right-3 z-[70] rounded-xl bg-warn/90 text-black text-[12.5px] font-medium px-3 py-2" style={{ bottom: 'calc(var(--sab) + 86px)' }}>{app.persistError}</div>}
      {pages.map((p) => <PageLayer key={p.id} p={p}><Boundary label={p.name}>{PAGES[p.name]?.(p.props || {})}</Boundary></PageLayer>)}
      <TabBar onAdd={() => openQuickCapture()} />
      <SheetHost />
      <Toasts />
    </div>
  );
};
