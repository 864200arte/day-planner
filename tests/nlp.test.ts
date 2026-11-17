import { describe, expect, it } from 'vitest';
import { parseCapture, parseOne } from '../src/lib/nlp';

// Фіксований «зараз»: середа, 18 листопада 2026, 10:07
const NOW = new Date(2026, 10, 18, 10, 7, 0);

describe('parseCapture', () => {
  it('приклад із ТЗ: навчання + вечірній відпочинок', () => {
    const r = parseCapture('Завтра о 15:00 хочу навчатися дві години, а ввечері залишити час для відпочинку', NOW);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ date: '2026-11-19', start: '15:00', end: '17:00', duration: 120, categoryId: 'study' });
    expect(r[0].title).toBe('Навчатися');
    expect(r[1]).toMatchObject({ date: '2026-11-19', start: '19:00', fuzzyTime: true, categoryId: 'rest' });
    expect(r[1].title.toLowerCase()).toContain('відпочинк');
  });

  it('приклад із ТЗ: тренування на годину', () => {
    const [p] = parseCapture('Завтра о 18:00 тренування на годину', NOW);
    expect(p).toMatchObject({ date: '2026-11-19', start: '18:00', end: '19:00', duration: 60, categoryId: 'sport', title: 'Тренування' });
  });

  it('не ділить перелік без часових ознак', () => {
    const r = parseCapture('Купити хліб, молоко завтра', NOW);
    expect(r).toHaveLength(1);
    expect(r[0].date).toBe('2026-11-19');
    expect(r[0].categoryId).toBe('shop');
  });

  it('використовує дату за замовчуванням', () => {
    const [p] = parseCapture('Подзвонити мамі о 20:30', NOW, '2026-11-25');
    expect(p.date).toBe('2026-11-25');
    expect(p.start).toBe('20:30');
  });
});

describe('parseOne', () => {
  it('дні тижня — наступне входження', () => {
    expect(parseOne('у п\'ятницю зустріч', NOW).date).toBe('2026-11-20');
    expect(parseOne('в середу зустріч', NOW).date).toBe('2026-11-25'); // сьогодні середа → наступна
  });
  it('числова дата та місяць словом', () => {
    expect(parseOne('25.12 подарунки', NOW).date).toBe('2026-12-25');
    expect(parseOne('15 грудня екзамен', NOW).date).toBe('2026-12-15');
    expect(parseOne('1 листопада щось', NOW).date).toBe('2027-11-01'); // вже минуло → наступний рік
  });
  it('інтервал часу', () => {
    const p = parseOne('з 14:00 до 16:30 проєкт', NOW);
    expect(p).toMatchObject({ start: '14:00', end: '16:30', duration: 150 });
    const q = parseOne('з 10 до 12 лекція', NOW);
    expect(q).toMatchObject({ start: '10:00', end: '12:00' });
  });
  it('тривалості', () => {
    expect(parseOne('читати півтори години', NOW).duration).toBe(90);
    expect(parseOne('йога 45 хв', NOW).duration).toBe(45);
    expect(parseOne('проєкт 1 год 30 хв', NOW).duration).toBe(90);
    expect(parseOne('прогулянка пів години', NOW).duration).toBe(30);
  });
  it('час із ранку/вечора', () => {
    expect(parseOne('о 7 вечора вечеря', NOW).start).toBe('19:00');
    expect(parseOne('о 8 ранку зарядка', NOW).start).toBe('08:00');
  });
  it('відносний час', () => {
    const p = parseOne('через 2 години подзвонити', NOW);
    expect(p.start).toBe('12:10');
    expect(p.date).toBe('2026-11-18');
  });
  it('повторення, пріоритет, нагадування', () => {
    const p = parseOne('щодня о 7:30 зарядка, нагадай за 15 хвилин', NOW);
    expect(p.repeat).toBe('daily');
    expect(p.remind).toEqual([15]);
    expect(p.start).toBe('07:30');
    expect(parseOne('терміново здати звіт завтра', NOW)).toMatchObject({ priority: 3, important: true });
    const w = parseOne('щопонеділка зустріч', NOW);
    expect(w.repeat).toBe('weekly');
    expect(w.date).toBe('2026-11-23');
  });
  it('не плутає тривалість із часом', () => {
    const p = parseOne('навчання на 2 години', NOW);
    expect(p.start).toBeNull();
    expect(p.duration).toBe(120);
  });
});
