import { Check, Plus, Share, Smartphone, Globe, X } from 'lucide-react';
import { Card, PageShell, SectionTitle } from '../ui/kit';
import { isStandalone, pushSupport } from '../lib/push';
import { t } from '../lib/i18n';

export const Install = () => {
  const standalone = isStandalone();
  const sup = pushSupport();
  const steps = [
    { icon: <Globe size={22} />, title: t('Відкрийте сайт у Safari'), text: t('Саме в Safari — Chrome та інші браузери на iPhone не вміють додавати PWA на головний екран повноцінно.') },
    { icon: <Share size={22} />, title: t('Натисніть «Поділитися»'), text: t('Іконка квадрата зі стрілкою вгору в нижній панелі Safari (на новіших iOS — у меню «⋯»).') },
    { icon: <Plus size={22} />, title: t('Оберіть «На початковий екран»'), text: t('Прокрутіть список дій униз, якщо пункту одразу не видно.') },
    { icon: <Check size={22} />, title: t('Натисніть «Додати»'), text: t('Можете змінити назву. Іконка з’явиться серед ваших програм.') },
    { icon: <Smartphone size={22} />, title: t('Відкрийте з головного екрана'), text: t('Застосунок запуститься без адресного рядка Safari — у standalone-режимі, на весь екран.') },
  ];
  const can: [boolean, string][] = [
    [true, t('Встановлення на головний екран, повноекранний режим')], [true, t('Робота офлайн (усі ресурси кешуються)')], [true, t('Локальне сховище IndexedDB, резервні копії JSON')],
    [true, t('Нагадування та звуки, поки застосунок відкрито')], [true, t('Web Push (iOS 16.4+, лише з головного екрана, потрібен ваш сервер)')],
    [false, t('Віджети iOS, Dynamic Island, Live Activities — потрібен нативний застосунок')], [false, t('Точні таймери та звуки у фоні без push')], [false, t('Вібрація (iOS не підтримує її для вебу)')],
  ];
  return (
    <PageShell title={t('Встановлення на iPhone')} sub={t('П’ять простих кроків')}>
      <div className="flex flex-col gap-5">
        <Card className={'p-4 flex items-center gap-3 ' + (standalone ? '!bg-good/12' : '')}>
          <div className="text-[26px]">{standalone ? '✅' : '📱'}</div>
          <div className="flex-1"><div className="font-bold">{standalone ? t('Ви вже в standalone-режимі') : t('Зараз відкрито у браузері')}</div>
            <div className="text-[13px] text-mute">{standalone ? t('Застосунок запущено з головного екрана.') : t('Виконайте кроки нижче, щоб встановити.')}</div></div>
        </Card>
        <div className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <Card key={i} className="p-4 flex gap-4 items-start anim-rise" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="w-11 h-11 rounded-2xl bg-accent/15 text-accent flex items-center justify-center shrink-0">{s.icon}</div>
              <div><div className="text-[12px] font-bold text-accent">{t('Крок')} {i + 1}</div><div className="font-bold text-[16.5px] leading-snug">{s.title}</div><div className="text-[13.5px] text-mute mt-0.5 leading-snug">{s.text}</div></div>
            </Card>
          ))}
        </div>
        <div><SectionTitle>{t('Що працює, а що ні')}</SectionTitle>
          <Card className="overflow-hidden">{can.map(([ok, text], i) => <div key={i} className="flex gap-3 px-4 py-3 hair-b last:border-b-0 items-start">{ok ? <Check size={18} className="text-good shrink-0 mt-0.5" /> : <X size={18} className="text-bad shrink-0 mt-0.5" />}<div className="text-[14px] leading-snug">{text}</div></div>)}</Card></div>
        <Card className="p-4 text-[13px] text-mute leading-snug">
          <b className="text-ink">{t('Важливо')}:</b> {t('сайт має відкриватися через HTTPS (див. інструкцію з публікації). Дані зберігаються лише на цьому iPhone. Якщо видалити іконку з екрана, дані PWA можуть бути стерті системою — робіть резервні копії (Профіль → Резервні копії).')}
          {sup.ios ? '' : ' ' + t('(Зараз це не iPhone — інструкція для Safari на iOS.)')}
        </Card>
      </div>
    </PageShell>
  );
};
