import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ui, registerConfirmBody } from './uiStore';
import { t } from '../lib/i18n';

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

export const Card = ({ className, onClick, children, style }: { className?: string; onClick?: () => void; children: ReactNode; style?: CSSProperties }) => (
  <div onClick={onClick} style={style} className={cx('card', onClick && 'pressable cursor-pointer', className)}>{children}</div>
);

type BtnProps = { variant?: 'primary' | 'soft' | 'ghost' | 'danger' | 'good'; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode; full?: boolean; disabled?: boolean; onClick?: (e: React.MouseEvent) => void; children?: ReactNode; className?: string; type?: 'button' | 'submit' };
export const Btn = ({ variant = 'primary', size = 'md', icon, full, disabled, onClick, children, className, type = 'button' }: BtnProps) => (
  <button type={type} disabled={disabled} onClick={onClick}
    className={cx('pressable inline-flex items-center justify-center gap-2 font-semibold rounded-2xl select-none disabled:opacity-40',
      size === 'sm' ? 'h-9 px-3.5 text-[14px]' : size === 'lg' ? 'h-14 px-6 text-[17px]' : 'h-12 px-5 text-[16px]',
      variant === 'primary' && 'bg-accent text-white shadow-[0_6px_18px_-6px_rgb(var(--accent)/.7)]',
      variant === 'soft' && 'bg-accent/15 text-accent',
      variant === 'ghost' && 'bg-card2 text-ink',
      variant === 'danger' && 'bg-bad/15 text-bad',
      variant === 'good' && 'bg-good/15 text-good',
      full && 'w-full', className)}>
    {icon}{children}
  </button>
);

export const IconBtn = ({ children, onClick, label, className, active }: { children: ReactNode; onClick?: () => void; label: string; className?: string; active?: boolean }) => (
  <button aria-label={label} onClick={onClick} className={cx('pressable w-10 h-10 rounded-full flex items-center justify-center', active ? 'bg-accent text-white' : 'bg-card2/80 text-ink', className)}>{children}</button>
);

export const Segmented = <T extends string>({ options, value, onChange, className }: { options: { v: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string }) => (
  <div className={cx('flex p-1 rounded-xl bg-card2 gap-1', className)}>
    {options.map((o) => (
      <button key={o.v} onClick={() => onChange(o.v)}
        className={cx('flex-1 h-8 rounded-[9px] text-[14px] font-semibold transition-all', value === o.v ? 'bg-card text-ink shadow-[0_1px_4px_rgb(0_0_0/.25)]' : 'text-mute')}>
        {o.label}
      </button>
    ))}
  </div>
);

export const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) => (
  <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
    className={cx('relative w-[51px] h-[31px] rounded-full transition-colors shrink-0', checked ? 'bg-good' : 'bg-mute/35')}>
    <span className={cx('absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
  </button>
);

export const Chip = ({ active, color, onClick, children, className }: { active?: boolean; color?: string; onClick?: () => void; children: ReactNode; className?: string }) => (
  <button onClick={onClick} style={active && color ? { backgroundColor: color + '2e', color, borderColor: color + '66' } : undefined}
    className={cx('pressable shrink-0 h-9 px-3.5 rounded-full text-[14px] font-semibold border flex items-center gap-1.5 whitespace-nowrap',
      active ? (color ? '' : 'bg-accent/15 text-accent border-accent/40') : 'bg-card2 text-mute border-transparent', className)}>
    {children}
  </button>
);

export const Field = ({ label, children, hint }: { label?: string; children: ReactNode; hint?: string }) => (
  <label className="block">
    {label && <div className="text-[12px] font-semibold uppercase tracking-wide text-mute mb-1.5 px-1">{label}</div>}
    {children}
    {hint && <div className="text-[12px] text-mute mt-1.5 px-1">{hint}</div>}
  </label>
);

export const inputCls = 'w-full h-12 px-4 rounded-2xl bg-card2 text-ink outline-none border border-transparent focus:border-accent/60 transition-colors';
export const TextInput = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const TextArea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx('w-full px-4 py-3 rounded-2xl bg-card2 text-ink outline-none border border-transparent focus:border-accent/60 resize-none leading-snug', p.className)} />;

export const Ring = ({ value, size = 64, stroke = 7, color = 'rgb(var(--accent))', children, track = 'rgb(var(--line) / .1)' }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode; track?: string }) => {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
};

export const Bar = ({ value, color = 'rgb(var(--accent))', h = 8 }: { value: number; color?: string; h?: number }) => (
  <div className="w-full rounded-full overflow-hidden" style={{ height: h, background: 'rgb(var(--line) / .1)' }}>
    <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color, transition: 'width .6s cubic-bezier(.2,.8,.2,1)' }} />
  </div>
);

export const Empty = ({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center text-center py-10 px-6 anim-rise">
    <div className="w-16 h-16 rounded-3xl bg-accent/12 text-accent flex items-center justify-center mb-4">{icon}</div>
    <div className="text-[18px] font-bold">{title}</div>
    {text && <div className="text-[14px] text-mute mt-1.5 max-w-[280px] leading-snug">{text}</div>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const SectionTitle = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="flex items-center justify-between px-1 mb-2 mt-1"><h3 className="text-[13px] font-bold uppercase tracking-wider text-mute">{children}</h3>{right}</div>
);

export const Row = ({ icon, title, sub, right, onClick, chevron, danger, color }: { icon?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void; chevron?: boolean; danger?: boolean; color?: string }) => (
  <div onClick={onClick} className={cx('flex items-center gap-3 px-4 min-h-[52px] py-2.5 hair-b last:border-b-0', onClick && 'pressable cursor-pointer')}>
    {icon && <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 text-white" style={{ background: color || 'rgb(var(--accent))' }}>{icon}</div>}
    <div className="flex-1 min-w-0">
      <div className={cx('text-[16px] font-medium leading-tight', danger && 'text-bad')}>{title}</div>
      {sub && <div className="text-[13px] text-mute mt-0.5 leading-snug">{sub}</div>}
    </div>
    {right}
    {chevron && <ChevronRight size={18} className="text-mute shrink-0" />}
  </div>
);

export const Group = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cx('card overflow-hidden', className)}>{children}</div>;

export const Dot = ({ color, size = 10 }: { color: string; size?: number }) => <span className="inline-block rounded-full shrink-0" style={{ width: size, height: size, background: color }} />;

export const Check2 = ({ done, color, onClick, size = 26 }: { done: boolean; color?: string; onClick?: (e: React.MouseEvent) => void; size?: number }) => (
  <button aria-label={done ? t('Позначити невиконаним') : t('Виконати')} onClick={onClick} className="pressable shrink-0 flex items-center justify-center rounded-full border-2 transition-colors"
    style={{ width: size, height: size, borderColor: color || 'rgb(var(--accent))', background: done ? color || 'rgb(var(--accent))' : 'transparent' }}>
    {done && <Check size={size * 0.62} strokeWidth={3.4} color="#fff" className="anim-pop" />}
  </button>
);

export const Stars = ({ value, onChange }: { value: number | null; onChange?: (v: number) => void }) => (
  <div className="flex gap-1.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} onClick={() => onChange?.(n)} aria-label={`${n}`} className="pressable text-[30px] leading-none" style={{ filter: (value ?? 0) >= n ? 'none' : 'grayscale(1) opacity(.35)' }}>⭐</button>
    ))}
  </div>
);

export const PageShell = ({ title, children, right, onBack, sub }: { title: string; children: ReactNode; right?: ReactNode; onBack?: () => void; sub?: string }) => (
  <div className="absolute inset-0 flex flex-col bg-bg">
    <div className="safe-top glass hair-b shrink-0 z-10">
      <div className="h-[52px] flex items-center px-2">
        <button onClick={onBack ?? (() => ui.pop())} className="pressable flex items-center text-accent h-10 pl-1 pr-3 font-medium text-[17px]" aria-label={t('Назад')}>
          <ChevronLeft size={26} strokeWidth={2.4} />{t('Назад')}
        </button>
        <div className="flex-1" />
        <div className="min-w-[40px] flex justify-end gap-1 pr-1">{right}</div>
      </div>
    </div>
    <div className="scroll flex-1 px-4 pt-3" style={{ paddingBottom: 'calc(var(--sab) + 28px)' }}>
      <h1 className="text-[32px] font-extrabold tracking-tight leading-tight mb-0.5">{title}</h1>
      {sub && <p className="text-[14px] text-mute mb-3">{sub}</p>}
      <div className={sub ? '' : 'mt-3'}>{children}</div>
    </div>
  </div>
);

export const SheetFrame = ({ title, children, right, onClose, footer }: { title?: string; children: ReactNode; right?: ReactNode; onClose?: () => void; footer?: ReactNode }) => (
  <div className="flex flex-col min-h-0 max-h-full">
    {(title || right) && (
      <div className="flex items-center justify-between px-5 pt-1 pb-3 shrink-0">
        <h2 className="text-[22px] font-extrabold tracking-tight">{title}</h2>
        <div className="flex items-center gap-2">{right}<button aria-label={t('Закрити')} onClick={onClose} className="pressable w-8 h-8 rounded-full bg-card2 flex items-center justify-center text-mute"><X size={17} strokeWidth={2.6} /></button></div>
      </div>
    )}
    <div className="scroll px-5 min-h-0 flex-1">{children}<div className="h-4" /></div>
    {footer && <div className="px-5 pt-2 shrink-0" style={{ paddingBottom: 'calc(var(--sab) + 14px)' }}>{footer}</div>}
    {!footer && <div style={{ height: 'calc(var(--sab) + 6px)' }} className="shrink-0" />}
  </div>
);

registerConfirmBody(({ title, message, ok, danger, cancel, onAnswer }: any) => (
  <SheetFrame>
    <div className="text-center pt-1 pb-4">
      <div className="text-[20px] font-extrabold">{title}</div>
      {message && <div className="text-[15px] text-mute mt-2 leading-snug whitespace-pre-line">{message}</div>}
    </div>
    <div className="flex flex-col gap-2">
      <Btn variant={danger ? 'danger' : 'primary'} full onClick={() => onAnswer(true)}>{ok || 'OK'}</Btn>
      <Btn variant="ghost" full onClick={() => onAnswer(false)}>{cancel || t('Скасувати')}</Btn>
    </div>
  </SheetFrame>
));

/** Піднімає елемент над клавіатурою та звітує про розмір візуального viewport */
export const useVisualViewport = () => {
  useEffect(() => {
    const vv = window.visualViewport;
    const apply = () => {
      const h = vv ? vv.height : window.innerHeight;
      const kb = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
      const root = document.documentElement.style;
      root.setProperty('--vvh', h + 'px');
      root.setProperty('--kb', (kb > 80 ? kb : 0) + 'px');
    };
    apply();
    vv?.addEventListener('resize', apply); vv?.addEventListener('scroll', apply); window.addEventListener('resize', apply);
    return () => { vv?.removeEventListener('resize', apply); vv?.removeEventListener('scroll', apply); window.removeEventListener('resize', apply); };
  }, []);
};

export const useNow = (ms = 20000) => {
  const [n, setN] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setN(new Date()), ms); return () => clearInterval(i); }, [ms]);
  return n;
};

export const useLongPress = (cb: () => void, ms = 380) => {
  const timer = useRef<number | null>(null);
  return {
    onTouchStart: () => { timer.current = window.setTimeout(cb, ms); },
    onTouchEnd: () => { if (timer.current) clearTimeout(timer.current); },
    onTouchMove: () => { if (timer.current) clearTimeout(timer.current); },
  };
};
