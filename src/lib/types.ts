export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface Task {
  id: string;
  title: string;
  notes: string;
  date: string | null;        // YYYY-MM-DD
  start: string | null;       // HH:MM
  end: string | null;         // HH:MM
  estimate: number | null;    // хвилин, якщо немає start/end
  categoryId: string;
  priority: 0 | 1 | 2 | 3;    // 0 немає … 3 високий
  important: boolean;
  color: string | null;       // перекриває колір категорії
  remind: number[];           // за скільки хвилин до початку (0 = у момент початку)
  repeat: Repeat;
  repeatUntil: string | null;
  exceptions: string[];       // дати серії, що пропущені/перенесені
  doneAt: number | null;      // для разових
  doneDates: Record<string, number>; // для повторюваних: дата -> timestamp
  movedCount: number;
  moves: { from: string | null; to: string | null; at: number }[];
  createdAt: number;
  updatedAt: number;
}

export interface Category { id: string; name: string; color: string; builtin?: boolean; updatedAt: number }

export interface Habit {
  id: string; name: string; emoji: string; color: string;
  days: number[];             // 0=пн … 6=нд, коли звичка активна
  log: Record<string, number>; // дата -> timestamp виконання
  createdAt: number; updatedAt: number; archived?: boolean;
}

export interface Milestone { id: string; title: string; due: string | null; done: boolean }
export interface Goal {
  id: string; title: string; description: string; deadline: string | null;
  color: string; milestones: Milestone[]; createdAt: number; updatedAt: number; doneAt: number | null;
}

export interface JournalEntry {
  id: string;                 // = date
  date: string; text: string; mood: number | null; thoughts: string[]; updatedAt: number;
}

export interface FocusSession {
  id: string; taskId: string | null; start: number; minutes: number; planned: number;
  mode: string; completed: boolean; updatedAt: number;
}

export interface EnergyLog { id: string; ts: number; level: number; updatedAt: number } // level 1..5

export interface TemplateItem { title: string; start: string | null; end: string | null; estimate: number | null; categoryId: string; priority: 0 | 1 | 2 | 3 }
export interface Template { id: string; name: string; emoji: string; items: TemplateItem[]; builtin?: boolean; updatedAt: number }

export interface Countdown { id: string; title: string; date: string; emoji: string; updatedAt: number }

export interface DayInfo {
  id: string;                 // = date
  date: string;
  top: string[];              // id завдань — «три головні цілі дня»
  rating: number | null;      // 1..5
  results: string;
  startedAt: number | null;
  finishedAt: number | null;
  updatedAt: number;
}

export interface HomeBlock { id: string; visible: boolean }

export interface Settings {
  theme: 'dark' | 'light' | 'auto';
  accent: string;
  timeFormat: '24' | '12';
  lang: 'uk' | 'en';
  weekStartsMonday: boolean;
  name: string;
  workStart: string; workEnd: string;
  bufferMin: number; defaultDuration: number;
  morningEnabled: boolean; morningTime: string;
  eveningEnabled: boolean; eveningTime: string;
  defaultReminders: number[];
  remindOverdue: boolean;
  soundId: string; volume: number;
  focusGoalMin: number;
  customFocus: number; customRest: number;
  timerSound: boolean;
  homeBlocks: HomeBlock[];
  personalization: boolean;
  aiEnabled: boolean; aiServer: string;
  pushServer: string;
  pushAuto: boolean;          // підхоплювати адресу сервера автоматично (файл у GitHub)
}

export interface Occ {
  task: Task; date: string; done: boolean;
  start: string | null; end: string | null; dur: number;
}

export interface AppData {
  tasks: Task[]; categories: Category[]; habits: Habit[]; goals: Goal[];
  journal: JournalEntry[]; sessions: FocusSession[]; energy: EnergyLog[];
  templates: Template[]; countdowns: Countdown[]; days: DayInfo[];
  settings: Settings; achievements: Record<string, number>;
}
