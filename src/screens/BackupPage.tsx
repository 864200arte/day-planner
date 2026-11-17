import { useEffect, useRef, useState } from 'react';
import { Download, Upload, RotateCcw, Trash2, Camera } from 'lucide-react';
import { useApp, snapshotData, getState, replaceData } from '../lib/store';
import { Btn, Card, PageShell, SectionTitle, SheetFrame, Segmented } from '../ui/kit';
import { ui } from '../ui/uiStore';
import { buildExport, createSnapshot, deleteSnapshot, downloadFile, exportFileName, listSnapshots, mergeInto, restoreSnapshot, validateBackup, type Snapshot, type Validation } from '../lib/backup';
import { fmtTs, dayMonthShort, dkey } from '../lib/dates';
import { dbAvailable } from '../lib/db';
import { t } from '../lib/i18n';

const LABELS: Record<string, string> = { tasks: 'Завдань', habits: 'Звичок', goals: 'Цілей', journal: 'Записів щоденника', sessions: 'Фокус-сесій', templates: 'Шаблонів', countdowns: 'Подій відліку', days: 'Днів (огляди)', categories: 'Категорій', energy: 'Записів енергії' };

const ImportSheet = ({ v, name, close }: { v: Validation; name: string; close: () => void }) => {
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (mode === 'replace') {
      const ok = await ui.confirm({ title: t('Замінити всі дані?'), message: t('Поточні дані буде замінено вмістом файлу. Перед цим автоматично створюється знімок, з якого можна відновитись.'), ok: t('Замінити'), danger: true });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await createSnapshot('Перед імпортом', true);
      const data = mode === 'replace' ? v.data! : mergeInto(snapshotData(), v.data!);
      await replaceData(data);
      ui.toast(mode === 'replace' ? t('Дані замінено') : t('Дані об’єднано'), { tone: 'good' });
      close();
    } catch (e: any) { ui.toast(t('Помилка імпорту') + ': ' + (e?.message || e), { tone: 'warn' }); }
    setBusy(false);
  };
  return (
    <SheetFrame title={t('Імпорт даних')} onClose={close} footer={<Btn full disabled={busy} onClick={run}>{mode === 'replace' ? t('Замінити дані') : t('Об’єднати')}</Btn>}>
      <div className="text-[13.5px] text-mute mb-3 truncate">{name}</div>
      <Card className="overflow-hidden mb-4">{Object.entries(v.counts).filter(([, n]) => n > 0).map(([k, n]) => <div key={k} className="flex justify-between px-4 py-2.5 hair-b last:border-b-0 text-[14.5px]"><span>{t(LABELS[k] ?? k)}</span><b className="tabular">{n}</b></div>)}
        {!Object.values(v.counts).some((n) => n > 0) && <div className="px-4 py-3 text-mute">{t('Файл порожній')}</div>}</Card>
      {v.warnings.map((w) => <div key={w} className="text-[13px] text-warn mb-1.5">⚠️ {w}</div>)}
      <Segmented value={mode} onChange={setMode} options={[{ v: 'merge', label: t('Об’єднати') }, { v: 'replace', label: t('Замінити') }]} />
      <div className="text-[13px] text-mute mt-3 leading-snug">{mode === 'merge' ? t('Нові записи додаються; для однакових записів лишається той, що змінений пізніше. Нічого не втрачається.') : t('Усі поточні дані буде замінено. Створюється страхувальний знімок.')}</div>
    </SheetFrame>
  );
};

export const BackupPage = () => {
  const app = useApp();
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const refresh = () => listSnapshots().then(setSnaps).catch(() => setSnaps([]));
  useEffect(() => { refresh(); navigator.storage?.persisted?.().then(setPersisted); }, []);

  const doExport = async () => {
    const r = await downloadFile(exportFileName(), JSON.stringify(buildExport(), null, 2));
    if (r !== 'cancelled') ui.toast(r === 'shared' ? t('Файл відкрито для збереження (наприклад, у «Файли»)') : t('Файл збережено'), { tone: 'good' });
  };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (f.size > 40 * 1024 * 1024) { ui.toast(t('Файл завеликий'), { tone: 'warn' }); return; }
    try {
      const obj = JSON.parse(await f.text());
      const v = validateBackup(obj);
      if (!v.ok) { ui.toast(v.errors[0], { tone: 'warn', ms: 6000 }); return; }
      ui.sheet((c) => <ImportSheet v={v} name={f.name} close={() => { c(); refresh(); }} />);
    } catch { ui.toast(t('Не вдалося прочитати файл: це не JSON'), { tone: 'warn', ms: 6000 }); }
  };
  const restore = async (s: Snapshot) => {
    if (!(await ui.confirm({ title: t('Відновити цей знімок?'), message: `${fmtTs(s.createdAt)} · ${s.label}\n${t('Поточний стан буде збережено окремим знімком.')}`, ok: t('Відновити') }))) return;
    try { await restoreSnapshot(s); ui.toast(t('Знімок відновлено'), { tone: 'good' }); refresh(); } catch (e: any) { ui.toast(String(e?.message || e), { tone: 'warn' }); }
  };
  const last = [...snaps].sort((a, b) => b.createdAt - a.createdAt)[0];
  const total = app.tasks.length + app.habits.length + app.goals.length + app.journal.length + app.sessions.length;

  return (
    <PageShell title={t('Резервні копії')} sub={t('Ваші дані живуть лише на цьому пристрої — робіть копії.')}>
      <div className="flex flex-col gap-5">
        <Card className="p-4 text-[14px] leading-snug">
          <div className="flex justify-between"><span className="text-mute">{t('Записів у сховищі')}</span><b className="tabular">{total}</b></div>
          <div className="flex justify-between mt-1.5"><span className="text-mute">{t('IndexedDB')}</span><b className={dbAvailable ? 'text-good' : 'text-bad'}>{dbAvailable ? t('працює') : t('недоступна')}</b></div>
          <div className="flex justify-between mt-1.5"><span className="text-mute">{t('Захист від очищення')}</span><b>{persisted == null ? '—' : persisted ? t('надано') : t('не надано')}</b></div>
          <div className="flex justify-between mt-1.5"><span className="text-mute">{t('Останній знімок')}</span><b>{last ? `${dayMonthShort(dkey(new Date(last.createdAt)))}, ${fmtTs(last.createdAt)}` : '—'}</b></div>
          <div className="text-[12.5px] text-mute mt-3">{t('Автоматичні знімки створюються раз на добу (зберігається останні 8). Дані також можна експортувати у файл і зберегти в «Файли» чи iCloud.')}</div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Btn icon={<Download size={18} />} onClick={doExport}>{t('Експорт JSON')}</Btn>
          <Btn variant="ghost" icon={<Upload size={18} />} onClick={() => file.current?.click()}>{t('Імпорт JSON')}</Btn>
        </div>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />

        <div>
          <SectionTitle right={<button onClick={async () => { await createSnapshot('Ручний знімок'); refresh(); ui.toast(t('Знімок створено'), { tone: 'good' }); }} className="text-accent text-[14px] font-semibold pressable flex items-center gap-1"><Camera size={15} />{t('Створити')}</button>}>{t('Знімки в застосунку')}</SectionTitle>
          <Card className="overflow-hidden">
            {snaps.map((s) => (
              <div key={s.id} className="flex items-center gap-2 px-4 py-3 hair-b last:border-b-0">
                <div className="flex-1 min-w-0"><div className="font-semibold truncate">{s.label}</div><div className="text-[12px] text-mute tabular">{dayMonthShort(dkey(new Date(s.createdAt)))}, {fmtTs(s.createdAt)} · {s.counts.tasks ?? 0} {t('завд.')}</div></div>
                <button aria-label={t('Відновити')} onClick={() => restore(s)} className="pressable w-9 h-9 rounded-full bg-accent/15 text-accent flex items-center justify-center"><RotateCcw size={16} /></button>
                <button aria-label={t('Експорт')} onClick={() => downloadFile(`planner-snapshot-${dkey(new Date(s.createdAt))}.json`, s.json)} className="pressable w-9 h-9 rounded-full bg-card2 flex items-center justify-center"><Download size={16} /></button>
                <button aria-label={t('Видалити')} onClick={async () => { await deleteSnapshot(s.id); refresh(); }} className="pressable w-9 h-9 rounded-full bg-card2 text-mute flex items-center justify-center"><Trash2 size={16} /></button>
              </div>
            ))}
            {!snaps.length && <div className="p-4 text-[14px] text-mute">{t('Знімків ще немає.')}</div>}
          </Card>
        </div>

        <Card className="p-4 text-[12.5px] text-mute leading-snug"><b className="text-ink">{t('Синхронізація між пристроями')}:</b> {t('поки не реалізована. Дані вже мають поля updatedAt та стабільні ідентифікатори, а імпорт з об’єднанням розв’язує конфлікти за «пізніший виграє» — це основа для майбутньої синхронізації. Тим часом переносьте дані файлом.')}</Card>
      </div>
    </PageShell>
  );
};
export { getState };
