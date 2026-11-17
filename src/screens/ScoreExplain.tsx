import { useState } from 'react';
import { Card, PageShell, Ring, SectionTitle, Bar } from '../ui/kit';
import { useScore } from '../ui/derived';
import { addDays, fullDate, todayKey } from '../lib/dates';
import { FORMULA } from '../lib/score';
import { t } from '../lib/i18n';

export const ScoreExplain = ({ date: d0 }: { date?: string }) => {
  const [date, setDate] = useState(d0 ?? todayKey());
  const sc = useScore(date);
  const use = sc.parts.filter((p) => p.value != null);
  const sw = use.reduce((a, p) => a + p.weight, 0);
  return (
    <PageShell title={t('Оцінка дня')} sub={t('Показуємо формулу й вклад кожної складової')}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button aria-label="prev" onClick={() => setDate(addDays(date, -1))} className="pressable w-10 h-10 rounded-full bg-card2 flex items-center justify-center">‹</button>
          <div className="font-extrabold cap1">{fullDate(date)}</div>
          <button aria-label="next" onClick={() => setDate(addDays(date, 1))} disabled={date >= todayKey()} className="pressable w-10 h-10 rounded-full bg-card2 flex items-center justify-center disabled:opacity-30">›</button>
        </div>
        <Card className="p-5 flex items-center gap-5 aurora"><Ring value={(sc.score ?? 0) / 100} size={110} stroke={12}><span className="text-[34px] font-extrabold tabular">{sc.score ?? '—'}</span></Ring>
          <div className="text-[14px] text-mute leading-snug">{sc.score == null ? t('Для цього дня ще немає даних: немає завдань, цілей, звичок чи фокус-сесій.') : sc.score >= 80 ? t('Чудовий день! Ви багато встигли.') : sc.score >= 50 ? t('Продуктивний день — гарний темп.') : t('Спокійний день. Це нормально: завтра нова можливість.')}</div></Card>

        <div><SectionTitle>{t('Складові')}</SectionTitle>
          <Card className="overflow-hidden">{sc.parts.map((p) => (
            <div key={p.key} className="px-4 py-3.5 hair-b last:border-b-0" style={{ opacity: p.value == null ? 0.5 : 1 }}>
              <div className="flex justify-between items-baseline"><div className="font-semibold">{t(p.label)}</div><div className="text-[13px] text-mute tabular">{t('вага')} {p.weight}</div></div>
              <div className="mt-2"><Bar value={p.value ?? 0} color="rgb(var(--accent))" h={6} /></div>
              <div className="flex justify-between text-[12.5px] text-mute mt-1.5"><span>{p.detail}</span><span className="tabular">{p.value == null ? t('не враховується') : `${Math.round(p.value * 100)}% → ${(Math.round(((p.weight * p.value) / (sw || 1)) * 1000) / 10).toString()} ${t('балів')}`}</span></div>
            </div>))}</Card></div>

        <Card className="p-4"><div className="text-[12px] font-bold uppercase tracking-wider text-mute mb-1.5">{t('Формула')}</div>
          <div className="text-[14px] leading-snug">{t(FORMULA)}.</div>
          <div className="text-[13px] text-mute mt-2 leading-snug">{t('Ваги: завдання 40, головні цілі 20, розклад 15, фокус 15, звички 10. Складова, для якої немає даних (наприклад, не обрано цілей), не враховується — ваги перераховуються між рештою. Фокус враховується, лише якщо ви хоч раз користувались таймером.')}</div></Card>
      </div>
    </PageShell>
  );
};
