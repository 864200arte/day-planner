import { useMemo } from 'react';
import { Card, PageShell, Toggle } from '../ui/kit';
import { buildInsights } from '../lib/personalize';
import { snapshotData, useApp } from '../lib/store';
import * as S from '../lib/store';
import { t } from '../lib/i18n';

export const Insights = () => {
  const app = useApp();
  const { insights, need } = useMemo(() => buildInsights(snapshotData()), [app.tasks, app.sessions, app.habits, app.days]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <PageShell title={t('Персональні підказки')} sub={t('Аналіз ваших реальних даних. Це лише пропозиції — план ніколи не змінюється автоматично.')}>
      <div className="flex flex-col gap-3">
        <Card className="p-4 flex items-center justify-between"><div><div className="font-semibold">{t('Враховувати мої записи енергії')}</div><div className="text-[12.5px] text-mute">{t('Smart Planner підлаштовується під ваші години')}</div></div><Toggle checked={app.settings.personalization} onChange={(v) => S.updateSettings({ personalization: v })} label="personalization" /></Card>
        {insights.map((i) => <Card key={i.id} className="p-4 anim-rise"><div className="flex items-center gap-2.5"><span className="text-[24px]">{i.icon}</span><div className="font-bold text-[16.5px]">{i.title}</div></div><div className="text-[14.5px] text-mute mt-2 leading-snug">{i.text}</div></Card>)}
        {need && <Card className="p-5 text-center text-[14px] text-mute"><div className="text-[30px] mb-1">🔍</div>{need}</Card>}
      </div>
    </PageShell>
  );
};
