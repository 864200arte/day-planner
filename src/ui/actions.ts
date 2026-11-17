// Спільні дії над завданнями з тостами та можливістю скасувати.
import type { Task } from '../lib/types';
import * as S from '../lib/store';
import { addDays, todayKey } from '../lib/dates';
import { ui } from './uiStore';
import { playSound } from '../lib/sound';
import { t } from '../lib/i18n';

export const toggleTask = (task: Task, date: string) => {
  const done = S.toggleDone(task.id, date);
  if (done) {
    const st = S.getState().settings;
    playSound('done', st.volume * 0.6);
    ui.toast(`${t('Виконано')}: ${task.title}`, { tone: 'good', action: { label: t('Скасувати'), fn: () => S.toggleDone(task.id, date) }, ms: 3200 });
  }
  return done;
};

export const removeTask = async (task: Task, date: string) => {
  if (task.repeat !== 'none') {
    const choice = await new Promise<'one' | 'all' | null>((resolve) => {
      ui.sheet((close) => {
        const pick = (v: 'one' | 'all' | null) => { close(); resolve(v); };
        return ChoiceBody(pick);
      });
    });
    if (!choice) return false;
    if (choice === 'one') { S.skipOccurrence(task.id, date); ui.toast(t('Подію видалено'), { action: { label: t('Скасувати'), fn: () => S.restoreTask(task) } }); return true; }
  }
  const old = S.deleteTask(task.id);
  ui.toast(t('Завдання видалено'), { action: old ? { label: t('Скасувати'), fn: () => S.restoreTask(old) } : undefined });
  return true;
};

export const postpone = (task: Task, date: string, to?: string) => {
  const target = to ?? addDays(date < todayKey() ? todayKey() : date, 1);
  S.moveOccurrence(task.id, date, { date: target });
  ui.toast(`${t('Перенесено на')} ${target}`, { action: { label: t('Скасувати'), fn: () => S.moveOccurrence(task.id, target, { date }) } });
};

// Невеликий хак: компонент вибору для «цей/усі» реєструється з kit-подібного модуля нижче (щоб не тягнути React сюди)
let ChoiceBody: (pick: (v: 'one' | 'all' | null) => void) => any = () => null;
export const registerChoiceBody = (fn: typeof ChoiceBody) => { ChoiceBody = fn; };
