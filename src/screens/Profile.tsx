import { BarChart3, BookOpen, Bot, CalendarClock, DatabaseBackup, Flag, Flame, Layers, Lightbulb, Moon, Repeat2, Search, Settings as Cog, Smartphone, Sparkles, Sun, Target, Timer, Trophy, Wand2 } from 'lucide-react';
import { useApp } from '../lib/store';
import { Group, Ring, Row, SectionTitle, Card } from '../ui/kit';
import { ui } from '../ui/uiStore';
import { useScore, useStreaks } from '../ui/derived';
import { todayKey } from '../lib/dates';
import { openSearch } from './Search';
import { ACHIEVEMENTS } from '../lib/achievements';
import { t } from '../lib/i18n';

export const Profile = () => {
  const app = useApp();
  const today = todayKey();
  const score = useScore(today);
  const streaks = useStreaks();
  const unlocked = Object.keys(app.achievements).length;
  const name = app.settings.name || t('Мій профіль');
  return (
    <div className="absolute inset-0 scroll" style={{ paddingBottom: 'calc(var(--sab) + 110px)' }}>
      <div className="safe-top">
        <div className="px-4 pt-3 flex items-center justify-between">
          <h1 className="text-[30px] font-extrabold tracking-tight">{t('Профіль')}</h1>
          <button aria-label={t('Пошук')} onClick={() => openSearch()} className="pressable w-10 h-10 rounded-full bg-card2/80 flex items-center justify-center"><Search size={19} /></button>
        </div>

        <div className="px-4 mt-3 flex flex-col gap-5">
          <Card className="p-4 aurora flex items-center gap-4" onClick={() => ui.push('settings')}>
            <div className="w-16 h-16 rounded-full bg-accent text-white text-[28px] font-extrabold flex items-center justify-center">{(app.settings.name || 'Я')[0].toUpperCase()}</div>
            <div className="flex-1 min-w-0"><div className="text-[20px] font-extrabold truncate">{name}</div>
              <div className="text-[13px] text-mute mt-0.5 flex items-center gap-3"><span className="flex items-center gap-1"><Flame size={14} className="text-warn" />{streaks.current}</span><span className="flex items-center gap-1"><Trophy size={14} />{unlocked}/{ACHIEVEMENTS.length}</span></div></div>
            <Ring value={(score.score ?? 0) / 100} size={54} stroke={6}><span className="text-[15px] font-extrabold tabular">{score.score ?? '—'}</span></Ring>
          </Card>

          <div><SectionTitle>{t('День')}</SectionTitle>
            <Group>
              <Row icon={<Sun size={18} />} color="#f59e0b" title={t('Ранковий огляд')} sub={t('План, цілі, вільні проміжки')} chevron onClick={() => ui.push('morning')} />
              <Row icon={<Moon size={18} />} color="#6366f1" title={t('Вечірній огляд')} sub={t('Підсумки, нотатки, завтра')} chevron onClick={() => ui.push('evening')} />
              <Row icon={<Wand2 size={18} />} color="#8b5cf6" title="Smart Planner" sub={t('Автоматичний розклад за підтвердженням')} chevron onClick={() => ui.push('planner', {})} />
              <Row icon={<Bot size={18} />} color="#06b6d4" title={t('AI-помічник')} sub={t('Створення завдань, аналіз, планування')} chevron onClick={() => ui.push('assistant')} />
              <Row icon={<Layers size={18} />} color="#14b8a6" title={t('Шаблони днів')} chevron onClick={() => ui.push('templates', {})} />
            </Group></div>

          <div><SectionTitle>{t('Розвиток')}</SectionTitle>
            <Group>
              <Row icon={<Repeat2 size={18} />} color="#22c55e" title={t('Звички')} sub={`${app.habits.length} ${t('активних')}`} chevron onClick={() => ui.push('habits')} />
              <Row icon={<Flag size={18} />} color="#ef4444" title={t('Цілі')} sub={`${app.goals.filter((g) => !g.doneAt).length} ${t('у роботі')}`} chevron onClick={() => ui.push('goals')} />
              <Row icon={<CalendarClock size={18} />} color="#ec4899" title={t('Зворотний відлік')} chevron onClick={() => ui.push('countdowns')} />
              <Row icon={<BookOpen size={18} />} color="#f97316" title={t('Щоденник')} sub={`${app.journal.length} ${t('записів')}`} chevron onClick={() => ui.push('journal', {})} />
            </Group></div>

          <div><SectionTitle>{t('Аналітика')}</SectionTitle>
            <Group>
              <Row icon={<BarChart3 size={18} />} color="#3b82f6" title={t('Статистика та звіти')} sub={t('Тиждень, місяць, фокус')} chevron onClick={() => ui.push('stats')} />
              <Row icon={<Target size={18} />} color="#8b7cff" title={t('Оцінка дня')} sub={t('Формула та пояснення')} chevron onClick={() => ui.push('score', { date: today })} />
              <Row icon={<Trophy size={18} />} color="#eab308" title={t('Досягнення та рекорди')} sub={`${unlocked} ${t('з')} ${ACHIEVEMENTS.length}`} chevron onClick={() => ui.push('achievements')} />
              <Row icon={<Lightbulb size={18} />} color="#0ea5e9" title={t('Персональні підказки')} sub={t('Лише пропозиції — без автозмін')} chevron onClick={() => ui.push('insights')} />
              <Row icon={<Timer size={18} />} color="#a855f7" title={t('Фокус-таймер')} chevron onClick={() => ui.go('focus')} />
            </Group></div>

          <div><SectionTitle>{t('Застосунок')}</SectionTitle>
            <Group>
              <Row icon={<Cog size={18} />} color="#64748b" title={t('Налаштування')} chevron onClick={() => ui.push('settings')} />
              <Row icon={<DatabaseBackup size={18} />} color="#10b981" title={t('Резервні копії')} sub={t('Експорт, імпорт, знімки')} chevron onClick={() => ui.push('backup')} />
              <Row icon={<Smartphone size={18} />} color="#38bdf8" title={t('Встановлення на iPhone')} sub={t('Інструкція «На початковий екран»')} chevron onClick={() => ui.push('install')} />
              <Row icon={<Sparkles size={18} />} color="#f43f5e" title={t('Категорії')} chevron onClick={() => ui.push('categories')} />
            </Group></div>
        </div>
      </div>
    </div>
  );
};
