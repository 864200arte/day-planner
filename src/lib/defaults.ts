import type { Category, Settings, Task, Template } from './types';

export const NOW = () => Date.now();

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'personal', name: 'Особисте', color: '#8b7cff', builtin: true, updatedAt: 0 },
  { id: 'work', name: 'Робота', color: '#3b82f6', builtin: true, updatedAt: 0 },
  { id: 'study', name: 'Навчання', color: '#f59e0b', builtin: true, updatedAt: 0 },
  { id: 'sport', name: 'Спорт', color: '#22c55e', builtin: true, updatedAt: 0 },
  { id: 'rest', name: 'Відпочинок', color: '#14b8a6', builtin: true, updatedAt: 0 },
  { id: 'shop', name: 'Покупки', color: '#ec4899', builtin: true, updatedAt: 0 },
  { id: 'other', name: 'Інше', color: '#94a3b8', builtin: true, updatedAt: 0 },
];

export const HOME_BLOCKS = ['progress', 'next', 'top', 'score', 'briefing', 'habits', 'goals', 'energy', 'countdowns'];

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  accent: '#8b7cff',
  timeFormat: '24',
  lang: 'uk',
  weekStartsMonday: true,
  name: '',
  workStart: '08:00',
  workEnd: '22:00',
  bufferMin: 10,
  defaultDuration: 30,
  morningEnabled: true,
  morningTime: '08:00',
  eveningEnabled: true,
  eveningTime: '21:00',
  defaultReminders: [10],
  remindOverdue: true,
  soundId: 'chime',
  volume: 0.7,
  focusGoalMin: 90,
  customFocus: 40,
  customRest: 8,
  timerSound: true,
  homeBlocks: HOME_BLOCKS.map((id) => ({ id, visible: true })),
  personalization: true,
  aiEnabled: false,
  aiServer: '',
  pushServer: '',
  pushAuto: true,
};

export const ACCENTS = ['#8b7cff', '#3b82f6', '#06b6d4', '#22c55e', '#f59e0b', '#f43f5e', '#ec4899'];
export const PALETTE = ['#8b7cff', '#3b82f6', '#06b6d4', '#14b8a6', '#22c55e', '#f59e0b', '#f97316', '#f43f5e', '#ec4899', '#94a3b8'];

export const blankTask = (over: Partial<Task> = {}): Task => {
  const now = Date.now();
  return {
    id: '', title: '', notes: '', date: null, start: null, end: null, estimate: null,
    categoryId: 'personal', priority: 0, important: false, color: null, remind: [],
    repeat: 'none', repeatUntil: null, exceptions: [], doneAt: null, doneDates: {},
    movedCount: 0, moves: [], createdAt: now, updatedAt: now, ...over,
  };
};

const it = (title: string, start: string | null, end: string | null, categoryId: string, priority: 0 | 1 | 2 | 3 = 0, estimate: number | null = null) =>
  ({ title, start, end, estimate, categoryId, priority });

export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'tpl-normal', name: 'Звичайний день', emoji: '🌤️', builtin: true, updatedAt: 0,
    items: [
      it('Ранкова розминка', '07:30', '08:00', 'sport'),
      it('Головна справа дня', '09:00', '11:00', 'personal', 3),
      it('Обід і відпочинок', '13:00', '14:00', 'rest'),
      it('Другорядні справи', '15:00', '16:30', 'personal', 1),
      it('Прогулянка', '19:00', '19:45', 'rest'),
    ],
  },
  {
    id: 'tpl-study', name: 'Навчальний день', emoji: '📚', builtin: true, updatedAt: 0,
    items: [
      it('Лекції / пари', '09:00', '12:30', 'study', 2),
      it('Обід', '12:30', '13:30', 'rest'),
      it('Самостійна робота', '14:00', '16:00', 'study', 3),
      it('Повторення матеріалу', '17:00', '18:00', 'study', 1),
      it('Спорт', '18:30', '19:30', 'sport'),
    ],
  },
  {
    id: 'tpl-work', name: 'Робочий день', emoji: '💼', builtin: true, updatedAt: 0,
    items: [
      it('Планування дня', '09:00', '09:15', 'work', 1),
      it('Глибока робота', '09:30', '11:30', 'work', 3),
      it('Пошта та повідомлення', '11:30', '12:00', 'work', 1),
      it('Обід', '13:00', '14:00', 'rest'),
      it('Зустрічі / дзвінки', '14:00', '16:00', 'work', 2),
      it('Підсумки дня', '17:30', '17:45', 'work', 1),
    ],
  },
  {
    id: 'tpl-weekend', name: 'Вихідний', emoji: '🏖️', builtin: true, updatedAt: 0,
    items: [
      it('Неспішний сніданок', '10:00', '11:00', 'rest'),
      it('Прибирання', '11:30', '12:30', 'personal', 1),
      it('Прогулянка або спорт', '15:00', '16:30', 'sport'),
      it('Час для хобі', '17:00', '19:00', 'rest'),
      it('Планування тижня', '20:00', '20:30', 'personal', 2),
    ],
  },
];
