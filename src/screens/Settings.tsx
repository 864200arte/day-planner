import { useEffect, useState } from 'react';
import { Bell, Play, Plus, Trash2 } from 'lucide-react';
import { useApp, snapshotData } from '../lib/store';
import * as S from '../lib/store';
import { Btn, Card, Chip, Field, Group, PageShell, Row, SectionTitle, Segmented, TextInput, Toggle, cx } from '../ui/kit';
import { ui } from '../ui/uiStore';
import { ACCENTS, PALETTE } from '../lib/defaults';
import { SOUNDS, playSound, unlockAudio } from '../lib/sound';
import { REMIND_OPTIONS, buildDue } from '../lib/reminders';
import { disablePush, enablePush, getSubscription, pingServer, pushSupport, sendTestPush, syncPush } from '../lib/push';
import { catLabel, useCats } from '../ui/hooks';
import { dayMonthShort, fmtTime, pad } from '../lib/dates';
import { createSnapshot } from '../lib/backup';
import { t } from '../lib/i18n';

const Time = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
  <input aria-label={label} type="time" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} className="h-10 px-3 rounded-xl bg-card2 outline-none w-[112px] text-right" />
);
const Stepper = ({ value, onChange, min, max, step = 5, unit }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit: string }) => (
  <div className="flex items-center gap-2"><button aria-label="-" onClick={() => onChange(Math.max(min, value - step))} className="pressable w-9 h-9 rounded-full bg-card2 flex items-center justify-center">−</button><span className="w-16 text-center font-bold tabular">{value} {unit}</span><button aria-label="+" onClick={() => onChange(Math.min(max, value + step))} className="pressable w-9 h-9 rounded-full bg-card2 flex items-center justify-center">+</button></div>
);

export const Settings = () => {
  const app = useApp();
  const s = app.settings;
  const up = S.updateSettings;
  return (
    <PageShell title={t('Налаштування')}>
      <div className="flex flex-col gap-5">
        <div><SectionTitle>{t('Профіль')}</SectionTitle>
          <TextInput value={s.name} onChange={(e) => up({ name: e.target.value })} placeholder={t("Ваше ім'я (для привітання)")} /></div>

        <div><SectionTitle>{t('Вигляд')}</SectionTitle>
          <Card className="p-4 flex flex-col gap-4">
            <Field label={t('Тема')}><Segmented value={s.theme} onChange={(v) => up({ theme: v })} options={[{ v: 'dark', label: t('Темна') }, { v: 'light', label: t('Світла') }, { v: 'auto', label: t('Авто') }]} /></Field>
            <Field label={t('Колір акценту')}><div className="flex gap-3 flex-wrap">{ACCENTS.map((c) => <button key={c} aria-label={c} onClick={() => up({ accent: c })} className="pressable w-9 h-9 rounded-full" style={{ background: c, boxShadow: s.accent === c ? '0 0 0 3px rgb(var(--card)), 0 0 0 5px ' + c : 'none' }} />)}
              <label className="pressable w-9 h-9 rounded-full overflow-hidden relative ring-1 ring-line/20" style={{ background: 'conic-gradient(red,yellow,lime,aqua,blue,magenta,red)' }}><input type="color" value={s.accent} onChange={(e) => up({ accent: e.target.value })} className="opacity-0 absolute inset-0 w-full h-full" aria-label="custom color" /></label></div></Field>
          </Card></div>

        <div><SectionTitle>{t('Мова та формати')}</SectionTitle>
          <Card className="p-4 flex flex-col gap-4">
            <Field label={t('Мова')} hint={t('Англійська — часткова: переклад основних підписів інтерфейсу.')}><Segmented value={s.lang} onChange={(v) => up({ lang: v })} options={[{ v: 'uk', label: 'Українська' }, { v: 'en', label: 'English' }]} /></Field>
            <Field label={t('Формат часу')}><Segmented value={s.timeFormat} onChange={(v) => up({ timeFormat: v })} options={[{ v: '24', label: '24 год' }, { v: '12', label: '12 год AM/PM' }]} /></Field>
            <Field label={t('Тиждень починається з')}><Segmented value={s.weekStartsMonday ? 'm' : 's'} onChange={(v) => up({ weekStartsMonday: v === 'm' })} options={[{ v: 'm', label: t('Понеділка') }, { v: 's', label: t('Неділі') }]} /></Field>
          </Card></div>

        <div><SectionTitle>{t('Розклад')}</SectionTitle>
          <Group>
            <Row title={t('Початок робочого дня')} right={<Time label="start" value={s.workStart} onChange={(v) => up({ workStart: v })} />} />
            <Row title={t('Кінець робочого дня')} right={<Time label="end" value={s.workEnd} onChange={(v) => up({ workEnd: v })} />} />
            <Row title={t('Буфер між справами')} sub="Time Buffer" right={<Stepper value={s.bufferMin} onChange={(v) => up({ bufferMin: v })} min={0} max={60} unit={t('хв')} />} />
            <Row title={t('Тривалість за замовчуванням')} right={<Stepper value={s.defaultDuration} onChange={(v) => up({ defaultDuration: v })} min={5} max={240} unit={t('хв')} />} />
            <Row title={t('Ціль фокусу на день')} right={<Stepper value={s.focusGoalMin} onChange={(v) => up({ focusGoalMin: v })} min={0} max={480} step={15} unit={t('хв')} />} />
          </Group></div>

        <div><SectionTitle>{t('Огляди дня')}</SectionTitle>
          <Group>
            <Row title={t('Ранковий огляд')} right={<Toggle checked={s.morningEnabled} onChange={(v) => up({ morningEnabled: v })} label="morning" />} />
            {s.morningEnabled && <Row title={t('Час ранкового огляду')} right={<Time label="morning" value={s.morningTime} onChange={(v) => up({ morningTime: v })} />} />}
            <Row title={t('Вечірній огляд')} right={<Toggle checked={s.eveningEnabled} onChange={(v) => up({ eveningEnabled: v })} label="evening" />} />
            {s.eveningEnabled && <Row title={t('Час вечірнього огляду')} right={<Time label="evening" value={s.eveningTime} onChange={(v) => up({ eveningTime: v })} />} />}
          </Group></div>

        <div><SectionTitle>{t('Сповіщення та звуки')}</SectionTitle>
          <Group><Row icon={<Bell size={17} />} title={t('Нагадування, push, звуки')} sub={t('Дозвіл, сервер, вибір звуку')} chevron onClick={() => ui.push('notifications')} /></Group></div>

        <div><SectionTitle>{t('Категорії')}</SectionTitle><Group><Row title={t('Керувати категоріями')} chevron onClick={() => ui.push('categories')} /></Group></div>

        <div><SectionTitle>AI</SectionTitle>
          <Card className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between"><div><div className="font-semibold">{t('Хмарний AI через ваш сервер')}</div><div className="text-[12.5px] text-mute">{t('Вимкнено — працює локальний помічник без інтернету')}</div></div><Toggle checked={s.aiEnabled} onChange={(v) => up({ aiEnabled: v })} label="ai" /></div>
            {s.aiEnabled && <><TextInput value={s.aiServer} onChange={(e) => up({ aiServer: e.target.value.trim() })} placeholder="https://your-server.example.com" inputMode="url" autoCapitalize="off" autoCorrect="off" />
              <div className="text-[12.5px] text-mute leading-snug">{t('Ключ AI зберігається тільки на сервері (папка server/, змінна ANTHROPIC_API_KEY) і ніколи не потрапляє в застосунок. Використання API платне — вмикайте лише свідомо.')}</div></>}
          </Card></div>

        <div><SectionTitle>{t('Персоналізація')}</SectionTitle>
          <Group><Row title={t('Враховувати мої дані в підказках')} right={<Toggle checked={s.personalization} onChange={(v) => up({ personalization: v })} label="personalization" />} /><Row title={t('Переглянути підказки')} chevron onClick={() => ui.push('insights')} /></Group></div>

        <div><SectionTitle>{t('Дані')}</SectionTitle>
          <Group><Row title={t('Резервні копії')} sub={t('Експорт, імпорт, знімки')} chevron onClick={() => ui.push('backup')} />
            <Row title={t('Стерти всі дані')} danger onClick={async () => { if (await ui.confirm({ title: t('Стерти всі дані?'), message: t('Спершу буде створено автоматичний знімок, з якого можна відновитись у розділі «Резервні копії».'), ok: t('Стерти'), danger: true })) { await createSnapshot('Перед очищенням', true); await S.resetAll(); ui.popAll(); ui.toast(t('Дані стерто. Знімок збережено.')); } }} /></Group></div>
        <div className="text-center text-[12px] text-mute pb-2">Мій день · v1.0 · {t('усі дані зберігаються лише на цьому пристрої')}</div>
      </div>
    </PageShell>
  );
};

export const Categories = () => {
  const app = useApp();
  const cats = useCats();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[2]);
  const used = (id: string) => app.tasks.filter((x) => x.categoryId === id).length;
  const add = () => { if (!name.trim()) return; S.addCategory(name.trim(), color); setName(''); };
  return (
    <PageShell title={t('Категорії')} sub={t('Вбудовані й власні. Перейменування та колір — одним дотиком.')}>
      <div className="flex flex-col gap-4">
        <Card className="overflow-hidden">
          {cats.list.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 hair-b last:border-b-0">
              <label className="relative w-9 h-9 rounded-full shrink-0 overflow-hidden" style={{ background: c.color }}><input type="color" value={c.color} onChange={(e) => S.updateCategory(c.id, { color: e.target.value })} className="opacity-0 absolute inset-0 w-full h-full" aria-label="color" /></label>
              <input value={catLabel(c)} onChange={(e) => S.updateCategory(c.id, { name: e.target.value })} className="flex-1 min-w-0 h-10 bg-transparent outline-none text-[16px] font-medium" />
              <span className="text-[12px] text-mute tabular">{used(c.id)}</span>
              <button aria-label={t('Видалити')} disabled={cats.list.length <= 1} onClick={async () => { if (await ui.confirm({ title: `${t('Видалити')} «${catLabel(c)}»?`, message: used(c.id) ? t('Її завдання перейдуть до іншої категорії.') : undefined, ok: t('Видалити'), danger: true })) S.deleteCategory(c.id); }} className="pressable text-mute w-9 h-9 flex items-center justify-center disabled:opacity-30"><Trash2 size={17} /></button>
            </div>
          ))}
        </Card>
        <SectionTitle>{t('Нова категорія')}</SectionTitle>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder={t('Назва')} />
        <div className="flex gap-2.5 flex-wrap">{PALETTE.map((c) => <button key={c} aria-label={c} onClick={() => setColor(c)} className="pressable w-9 h-9 rounded-full" style={{ background: c, boxShadow: color === c ? '0 0 0 3px rgb(var(--bg)), 0 0 0 5px ' + c : 'none' }} />)}</div>
        <Btn icon={<Plus size={18} />} disabled={!name.trim()} onClick={add}>{t('Додати категорію')}</Btn>
      </div>
    </PageShell>
  );
};

export const NotificationsPage = () => {
  const app = useApp();
  const s = app.settings;
  const [sup, setSup] = useState(pushSupport());
  const [subbed, setSubbed] = useState<boolean | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [server, setServer] = useState(s.pushServer);
  const [alive, setAlive] = useState<boolean | null>(null);
  useEffect(() => { getSubscription().then((x) => setSubbed(!!x)); }, []);
  const upcoming = buildDue(snapshotData(), Date.now(), Date.now() + 3 * 86400000).slice(0, 8);

  const askPermission = async () => {
    if (!('Notification' in window)) { setMsg(t('Цей браузер не підтримує сповіщення.')); return; }
    const p = await Notification.requestPermission(); setSup(pushSupport());
    setMsg(p === 'granted' ? t('Дозвіл надано.') : t('Дозвіл не надано — змініть у Налаштуваннях iPhone → Сповіщення.'));
  };
  const saveServer = (v: string) => { setServer(v); S.updateSettings({ pushServer: v.trim() }); setAlive(null); };

  return (
    <PageShell title={t('Сповіщення')} sub={t('Що можливо на iPhone — чесно й без обіцянок зайвого.')}>
      <div className="flex flex-col gap-5">
        <Card className="p-4">
          <div className="text-[12px] font-bold uppercase tracking-wider text-mute mb-2">{t('Стан пристрою')}</div>
          {[[t('Запущено з головного екрана'), sup.standalone], [t('Service Worker'), sup.hasSW], [t('Web Push підтримується'), sup.hasPush], [t('Дозвіл на сповіщення'), sup.permission === 'granted']].map(([l, ok]) => (
            <div key={String(l)} className="flex justify-between py-1.5 text-[14.5px]"><span>{l}</span><b className={ok ? 'text-good' : 'text-mute'}>{ok ? '✓' : '—'}</b></div>))}
          {sup.reason && <div className="text-[13px] text-warn mt-2 leading-snug">{sup.reason}</div>}
          <div className="flex gap-2 mt-3"><Btn size="sm" variant="soft" onClick={askPermission} disabled={sup.permission === 'granted'}>{t('Запросити дозвіл')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => { unlockAudio(); playSound(s.soundId, s.volume); ui.toast('🔔 ' + t('Тестове нагадування'), { ms: 2500 }); if (sup.permission === 'granted') navigator.serviceWorker?.getRegistration().then((r) => r?.showNotification(t('Мій день'), { body: t('Локальне тестове сповіщення') })); }}>{t('Перевірити')}</Btn></div>
          {msg && <div className="text-[13px] text-mute mt-2">{msg}</div>}
        </Card>

        <div><SectionTitle>Web Push ({t('опційно, потрібен сервер')})</SectionTitle>
          <Card className="p-4 flex flex-col gap-3">
            <div className="text-[13px] text-mute leading-snug">{t('Без сервера нагадування спрацьовують лише коли застосунок відкрито: iOS не дозволяє вебзастосункам запускати таймери у фоні. Для нагадувань у закритому застосунку запустіть push-сервер (папка server/ — безкоштовний, див. README) і вкажіть його адресу.')}</div>
            <TextInput value={server} onChange={(e) => saveServer(e.target.value)} placeholder="https://your-push-server.example.com" inputMode="url" autoCapitalize="off" autoCorrect="off" />
            <div className="flex flex-wrap gap-2">
              <Btn size="sm" variant="ghost" onClick={async () => setAlive(await pingServer(server))}>{t('Перевірити сервер')}{alive != null ? (alive ? ' ✓' : ' ✕') : ''}</Btn>
              {!subbed ? <Btn size="sm" disabled={busy || !server} onClick={async () => { setBusy(true); const r = await enablePush(server); setMsg(r.msg); setSubbed((await getSubscription()) != null); setSup(pushSupport()); setBusy(false); }}>{t('Увімкнути push')}</Btn>
                : <><Btn size="sm" variant="soft" onClick={async () => { const r = await sendTestPush(server); setMsg(r.msg); }}>{t('Тестовий push')}</Btn><Btn size="sm" variant="danger" onClick={async () => { await disablePush(server); setSubbed(false); setMsg(t('Push вимкнено.')); }}>{t('Вимкнути')}</Btn><Btn size="sm" variant="ghost" onClick={() => { syncPush(); setMsg(t('Розклад нагадувань надіслано на сервер.')); }}>{t('Синхронізувати')}</Btn></>}
            </div>
            {subbed && <div className="text-[12.5px] text-good font-semibold">✓ {t('Підписку активовано на цьому пристрої')}</div>}
          </Card></div>

        <div><SectionTitle>{t('Нагадування за замовчуванням')}</SectionTitle>
          <Card className="p-4"><div className="flex flex-wrap gap-2">{REMIND_OPTIONS.map((o) => <Chip key={o.v} active={s.defaultReminders.includes(o.v)} onClick={() => S.updateSettings({ defaultReminders: s.defaultReminders.includes(o.v) ? s.defaultReminders.filter((x) => x !== o.v) : [...s.defaultReminders, o.v].sort((a, b) => a - b) })}>{t(o.label)}</Chip>)}</div>
            <div className="text-[12.5px] text-mute mt-2">{t('Застосовується до нових завдань із часом початку; для кожного завдання можна змінити окремо.')}</div>
            <div className="flex items-center justify-between mt-4 pt-3 hair-t"><div><div className="font-semibold">{t('Нагадувати про прострочені')}</div><div className="text-[12.5px] text-mute">{t('Через 5 хв після закінчення; для завдань без часу — о 18:00')}</div></div><Toggle checked={s.remindOverdue} onChange={(v) => S.updateSettings({ remindOverdue: v })} label="overdue" /></div></Card></div>

        <div><SectionTitle>{t('Звук нагадувань')}</SectionTitle>
          <Card className="overflow-hidden">{SOUNDS.map((x) => (
            <div key={x.id} className="flex items-center gap-3 px-4 min-h-[52px] hair-b last:border-b-0">
              <button onClick={() => S.updateSettings({ soundId: x.id })} className="flex-1 text-left py-3 pressable font-medium">{t(x.name)}</button>
              {s.soundId === x.id && <span className="text-accent font-bold">✓</span>}
              <button aria-label="play" onClick={() => { unlockAudio(); playSound(x.id, s.volume); }} className="pressable w-9 h-9 rounded-full bg-card2 flex items-center justify-center"><Play size={15} fill="currentColor" /></button>
            </div>))}
            <div className="px-4 py-3.5"><div className="flex justify-between text-[13px] text-mute mb-1.5"><span>{t('Гучність')}</span><b className="tabular">{Math.round(s.volume * 100)}%</b></div>
              <input type="range" min={0} max={100} value={Math.round(s.volume * 100)} onChange={(e) => S.updateSettings({ volume: +e.target.value / 100 })} onPointerUp={() => playSound(s.soundId, S.getState().settings.volume)} className="w-full accent-[rgb(var(--accent))]" aria-label="volume" /></div></Card>
          <div className="text-[12px] text-mute mt-2 leading-snug">{t('Власні звуки грають, коли застосунок відкрито, й підпорядковуються перемикачу «Без звуку» на iPhone. Системні push-сповіщення використовують звук iOS — змінити його з вебзастосунку неможливо.')}</div></div>

        <div><SectionTitle>{t('Найближчі нагадування')}</SectionTitle>
          <Card className="overflow-hidden">{upcoming.map((d) => <div key={d.key} className="flex items-center gap-3 px-4 py-3 hair-b last:border-b-0"><span>{d.kind === 'task' ? '🔔' : d.kind === 'overdue' ? '⏰' : d.kind === 'morning' ? '☀️' : '🌙'}</span><div className="flex-1 min-w-0"><div className="font-semibold truncate">{d.title}</div><div className="text-[12.5px] text-mute truncate">{d.body}</div></div><div className="text-[12.5px] text-mute tabular text-right">{dayMonthShort(`${new Date(d.at).getFullYear()}-${pad(new Date(d.at).getMonth() + 1)}-${pad(new Date(d.at).getDate())}`)}<br />{fmtTime(`${pad(new Date(d.at).getHours())}:${pad(new Date(d.at).getMinutes())}`, s.timeFormat)}</div></div>)}
            {!upcoming.length && <div className="p-4 text-[14px] text-mute">{t('Нагадувань немає.')}</div>}</Card></div>
      </div>
    </PageShell>
  );
};
export { cx };
