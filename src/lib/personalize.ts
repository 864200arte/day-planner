// Personalization Engine: лише ПРОПОЗИЦІЇ на основі реальних даних. Нічого не змінює автоматично.
import type { AppData } from './types';
import { addDays, todayKey } from './dates';
import { dayStats, toCtx, weekdayProductivity, categoryBreakdown } from './stats';
import { localKey } from './score';
import { fmtDur } from './dates';

export interface Insight { id: string; icon: string; title: string; text: string }

const WD = ['понеділок', 'вівторок', 'середа', 'четвер', "п'ятниця", 'субота', 'неділя'];
export const MIN_COMPLETIONS = 10;

export const buildInsights = (d: AppData): { insights: Insight[]; need: string | null } => {
  const out: Insight[] = [];
  const today = todayKey();
  const doneTs: number[] = [];
  for (const t of d.tasks) {
    if (t.repeat === 'none') { if (t.doneAt) doneTs.push(t.doneAt); }
    else for (const ts of Object.values(t.doneDates)) doneTs.push(ts);
  }
  if (doneTs.length < MIN_COMPLETIONS) {
    return { insights: [], need: `Потрібно хоча б ${MIN_COMPLETIONS} виконаних завдань, щоб робити висновки. Зараз: ${doneTs.length}.` };
  }

  // 1. Часто переносимі завдання
  const moved = d.tasks.filter((t) => t.movedCount >= 2 && t.doneAt == null).sort((a, b) => b.movedCount - a.movedCount);
  if (moved.length) {
    const t = moved[0];
    out.push({ id: 'moved', icon: '↪️', title: 'Завдання, що постійно переноситься', text: `«${t.title}» перенесено ${t.movedCount} р. Спробуйте розбити його на менші кроки або призначити менший обсяг на один захід.` });
  }

  // 2. Звичні години активності
  const hours = new Array(24).fill(0);
  for (const ts of doneTs) hours[new Date(ts).getHours()]++;
  const total = hours.reduce((a, b) => a + b, 0);
  let bestH = 0, bestSum = -1;
  for (let h = 0; h < 23; h++) { const s = hours[h] + hours[h + 1]; if (s > bestSum) { bestSum = s; bestH = h; } }
  if (total >= MIN_COMPLETIONS && bestSum / total >= 0.25) {
    out.push({ id: 'peak', icon: '⏰', title: 'Ваші пікові години', text: `Найбільше завдань ви закриваєте о ${String(bestH).padStart(2, '0')}:00–${String(bestH + 2).padStart(2, '0')}:00 (${Math.round((bestSum / total) * 100)}%). Плануйте найважливіше на цей проміжок.` });
  }

  // 3. Час концентрації
  if (d.sessions.length >= 3) {
    const byHour = new Array(24).fill(0);
    for (const s of d.sessions) byHour[new Date(s.start).getHours()] += s.minutes;
    const h = byHour.indexOf(Math.max(...byHour));
    const avg = d.sessions.reduce((a, s) => a + s.minutes, 0) / d.sessions.length;
    out.push({ id: 'focus', icon: '🎯', title: 'Час концентрації', text: `Найбільше фокусу — близько ${String(h).padStart(2, '0')}:00. Середня сесія: ${fmtDur(avg)}.` });
  }

  // 4. Найпопулярніші категорії
  const days30 = Array.from({ length: 30 }, (_, i) => addDays(today, -29 + i));
  const cats = categoryBreakdown(days30, d);
  if (cats.length) {
    const c = d.categories.find((x) => x.id === cats[0].id);
    out.push({ id: 'cat', icon: '🏷️', title: 'Головна категорія місяця', text: `Більшість виконаного — «${c?.name ?? '—'}» (${cats[0].done} завд.). ${cats.length > 1 ? '' : 'Інші сфери поки без активності.'}` });
  }

  // 5. Продуктивні дні
  const st = dayStats(days30, d, toCtx(d));
  const wp = weekdayProductivity(st).filter((x) => x.avg != null && x.n >= 2);
  if (wp.length >= 3) {
    const best = wp.reduce((a, b) => ((b.avg as number) > (a.avg as number) ? b : a));
    const worst = wp.reduce((a, b) => ((b.avg as number) < (a.avg as number) ? b : a));
    if ((best.avg as number) - (worst.avg as number) >= 10)
      out.push({ id: 'weekday', icon: '📅', title: 'Продуктивні дні', text: `Найкраще йде в ${WD[best.weekday]} (середня оцінка ${best.avg}), найважче — у ${WD[worst.weekday]} (${worst.avg}). У «важкий» день плануйте менше.` });
  }

  // 6. Перевантаження планування
  const recent = st.slice(-14).filter((s) => s.planned > 0);
  if (recent.length >= 5) {
    const rate = recent.reduce((a, s) => a + s.done / s.planned, 0) / recent.length;
    const planned = recent.reduce((a, s) => a + s.planned, 0) / recent.length;
    if (rate < 0.55) out.push({ id: 'over', icon: '🪶', title: 'Забагато планів на день', text: `За два тижні виконується ~${Math.round(rate * 100)}% запланованого при ${planned.toFixed(1)} завд./день. Спробуйте планувати на 1–2 завдання менше.` });
    else if (rate > 0.9) out.push({ id: 'room', icon: '🌿', title: 'Є запас потужності', text: `Ви виконуєте ~${Math.round(rate * 100)}% плану. Можна сміливо брати трохи більше або додати амбітну ціль.` });
  }

  // 7. Часті ранкові/вечірні відкладання — частка завдань, виконаних із запізненням
  const late = d.tasks.filter((t) => t.repeat === 'none' && t.doneAt && t.date && localKey(t.doneAt) > t.date).length;
  const single = d.tasks.filter((t) => t.repeat === 'none' && t.doneAt && t.date).length;
  if (single >= 8 && late / single > 0.4)
    out.push({ id: 'late', icon: '🕰️', title: 'Часті запізнення', text: `${Math.round((late / single) * 100)}% завдань завершуються пізніше запланованого дня. Додайте часовий буфер у Smart Planner (Налаштування → Розклад).` });

  return { insights: out, need: out.length ? null : 'Поки що закономірностей не видно — продовжуйте користуватися, і підказки з’являться.' };
};
