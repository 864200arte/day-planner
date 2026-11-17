import { useMemo, useState } from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../lib/store';
import * as S from '../lib/store';
import { Btn, Card, Field, PageShell, SectionTitle, SheetFrame, TextInput } from '../ui/kit';
import { ui } from '../ui/uiStore';
import { BUILTIN_TEMPLATES } from '../lib/defaults';
import { addDays, fmtDur, fmtTime, todayKey, toMin } from '../lib/dates';
import { occurrencesOn } from '../lib/recur';
import type { Template, TemplateItem } from '../lib/types';
import { useCats } from '../ui/hooks';
import { t } from '../lib/i18n';

const itemDur = (i: TemplateItem) => (i.start && i.end ? toMin(i.end) - toMin(i.start) : i.estimate ?? 30);

const ApplySheet = ({ tpl, initial, close }: { tpl: Template; initial: string; close: () => void }) => {
  const app = useApp();
  const cats = useCats();
  const [date, setDate] = useState(initial);
  const existing = useMemo(() => occurrencesOn(app.tasks, date, app.settings.defaultDuration).filter((o) => o.start), [app.tasks, date, app.settings.defaultDuration]);
  const clash = tpl.items.filter((i) => i.start && existing.some((o) => toMin(o.start!) < toMin(i.end ?? i.start!) && toMin(o.start!) + o.dur > toMin(i.start!)));
  const apply = () => {
    for (const i of tpl.items) S.addTask({ title: i.title, date, start: i.start, end: i.end, estimate: i.start && i.end ? null : i.estimate, categoryId: cats.list.some((c) => c.id === i.categoryId) ? i.categoryId : 'other', priority: i.priority, remind: i.start ? [...app.settings.defaultReminders] : [] });
    ui.toast(`${t('Додано завдань')}: ${tpl.items.length}`, { tone: 'good' }); close(); ui.pop(); ui.openDay(date);
  };
  return (
    <SheetFrame title={`${tpl.emoji} ${tpl.name}`} onClose={close} footer={<Btn full onClick={apply} disabled={!tpl.items.length}>{t('Додати до календаря')} ({tpl.items.length})</Btn>}>
      <Field label={t('На дату')}><div className="flex gap-2"><input type="date" value={date} onChange={(e) => setDate(e.target.value || initial)} className="flex-1 h-12 px-4 rounded-2xl bg-card2 outline-none min-w-0" />
        <Btn variant={date === todayKey() ? 'soft' : 'ghost'} size="sm" className="!h-12" onClick={() => setDate(todayKey())}>{t('Сьогодні')}</Btn><Btn variant={date === addDays(todayKey(), 1) ? 'soft' : 'ghost'} size="sm" className="!h-12" onClick={() => setDate(addDays(todayKey(), 1))}>{t('Завтра')}</Btn></div></Field>
      <div className="card overflow-hidden mt-4">
        {tpl.items.map((i, k) => <div key={k} className="flex items-center gap-3 px-4 py-3 hair-b last:border-b-0"><div className="w-[96px] text-[13.5px] tabular text-accent font-semibold">{i.start ? `${fmtTime(i.start, app.settings.timeFormat)}–${fmtTime(i.end, app.settings.timeFormat)}` : fmtDur(itemDur(i))}</div><div className="flex-1 font-medium">{i.title}</div></div>)}
        {!tpl.items.length && <div className="p-4 text-mute">{t('Шаблон порожній')}</div>}
      </div>
      {clash.length > 0 && <div className="mt-3 rounded-2xl bg-warn/15 text-warn p-3 text-[13px]">⚠️ {t('Накладається на наявні події')}: {clash.map((c) => c.title).join(', ')}. {t('Ви можете додати все одно й виправити потім.')}</div>}
    </SheetFrame>
  );
};

const SaveSheet = ({ close }: { close: () => void }) => {
  const app = useApp();
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayKey());
  const occs = occurrencesOn(app.tasks, date, app.settings.defaultDuration);
  const save = () => {
    if (!name.trim() || !occs.length) return;
    S.saveTemplate({ name: name.trim(), emoji: '🗓️', items: occs.map((o) => ({ title: o.task.title, start: o.start, end: o.task.end, estimate: o.task.estimate, categoryId: o.task.categoryId, priority: o.task.priority })) });
    ui.toast(t('Шаблон збережено'), { tone: 'good' }); close();
  };
  return (
    <SheetFrame title={t('Зберегти день як шаблон')} onClose={close} footer={<Btn full disabled={!name.trim() || !occs.length} onClick={save}>{t('Зберегти')}</Btn>}>
      <div className="flex flex-col gap-4"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Назва шаблону')} />
        <Field label={t('З якого дня взяти завдання')}><input type="date" value={date} onChange={(e) => setDate(e.target.value || todayKey())} className="w-full h-12 px-4 rounded-2xl bg-card2 outline-none" /></Field>
        <div className="text-[14px] text-mute">{occs.length ? `${occs.length} ${t('завдань потрапить у шаблон')}` : t('На цей день немає завдань')}</div></div>
    </SheetFrame>
  );
};

export const Templates = ({ date }: { date?: string }) => {
  const app = useApp();
  const initial = date ?? todayKey();
  const open = (tpl: Template) => ui.sheet((c) => <ApplySheet tpl={tpl} initial={initial} close={c} />);
  const all: Template[] = [...BUILTIN_TEMPLATES, ...app.templates];
  return (
    <PageShell title={t('Шаблони днів')} sub={t('Готові каркаси дня — застосуйте й підправте.')} right={<button aria-label={t('Додати')} onClick={() => ui.sheet((c) => <SaveSheet close={c} />)} className="pressable w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center"><Plus size={21} /></button>}>
      <div className="flex flex-col gap-3">
        <SectionTitle>{t('Готові')}</SectionTitle>
        {all.filter((x) => x.builtin).map((tpl) => <Card key={tpl.id} onClick={() => open(tpl)} className="p-4 flex items-center gap-3"><div className="text-[30px]">{tpl.emoji}</div><div className="flex-1"><div className="font-bold text-[17px]">{t(tpl.name)}</div><div className="text-[12.5px] text-mute">{tpl.items.length} {t('пунктів')}</div></div><span className="text-accent font-bold">›</span></Card>)}
        <SectionTitle>{t('Мої шаблони')}</SectionTitle>
        {all.filter((x) => !x.builtin).map((tpl) => <Card key={tpl.id} className="p-4 flex items-center gap-3"><div className="flex-1 flex items-center gap-3" onClick={() => open(tpl)}><div className="text-[30px]">{tpl.emoji}</div><div><div className="font-bold text-[17px]">{tpl.name}</div><div className="text-[12.5px] text-mute">{tpl.items.length} {t('пунктів')}</div></div></div>
          <button aria-label={t('Видалити')} onClick={async () => { if (await ui.confirm({ title: t('Видалити шаблон?'), ok: t('Видалити'), danger: true })) S.deleteTemplate(tpl.id); }} className="pressable text-mute w-9 h-9 flex items-center justify-center"><Trash2 size={18} /></button></Card>)}
        {!all.some((x) => !x.builtin) && <Card className="p-5 text-center text-[14px] text-mute"><Layers size={26} className="mx-auto mb-2 text-accent" />{t('Збережіть вдалий день як власний шаблон кнопкою «+».')}</Card>}
      </div>
    </PageShell>
  );
};
