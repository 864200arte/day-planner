// Прості SVG-графіки без бібліотек.
import { cx } from './kit';

export const BarChart = ({ data, height = 120, color = 'rgb(var(--accent))', max, labels, highlight, fmt }: { data: (number | null)[]; height?: number; color?: string; max?: number; labels?: string[]; highlight?: number; fmt?: (v: number) => string }) => {
  const m = max ?? Math.max(1, ...data.map((d) => d ?? 0));
  const n = data.length;
  const gap = n > 14 ? 2 : 6;
  return (
    <div>
      <div className="flex items-end" style={{ height, gap }}>
        {data.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end h-full items-center min-w-0">
            {v != null && v > 0 && n <= 8 && <div className="text-[10px] text-mute tabular mb-0.5">{fmt ? fmt(v) : v}</div>}
            <div className="w-full rounded-t-md" style={{ height: `${v ? Math.max(3, (v / m) * 100) : 2}%`, background: v ? color : 'rgb(var(--line) / .1)', opacity: highlight != null && highlight !== i ? 0.6 : 1, transition: 'height .5s cubic-bezier(.2,.8,.2,1)' }} />
          </div>
        ))}
      </div>
      {labels && <div className="flex mt-1.5" style={{ gap }}>{labels.map((l, i) => <div key={i} className="flex-1 text-center text-[10px] text-mute truncate tabular">{l}</div>)}</div>}
    </div>
  );
};

export const LineChart = ({ data, height = 110, color = 'rgb(var(--accent))', labels }: { data: (number | null)[]; height?: number; color?: string; labels?: string[] }) => {
  const W = 320, H = height, P = 6;
  const pts = data.map((v, i) => (v == null ? null : [P + (i / Math.max(1, data.length - 1)) * (W - 2 * P), P + (1 - v / 100) * (H - 2 * P)] as [number, number]));
  const segs: [number, number][][] = []; let cur: [number, number][] = [];
  for (const p of pts) { if (p) cur.push(p); else { if (cur.length) segs.push(cur); cur = []; } }
  if (cur.length) segs.push(cur);
  const path = (s: [number, number][]) => s.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {[0, 50, 100].map((g) => <line key={g} x1={0} x2={W} y1={P + (1 - g / 100) * (H - 2 * P)} y2={P + (1 - g / 100) * (H - 2 * P)} stroke="rgb(var(--line) / .1)" strokeDasharray="3 4" />)}
        {segs.map((s, i) => s.length > 1 && <path key={i} d={path(s)} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
        {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={3.2} fill={color} vectorEffect="non-scaling-stroke" />)}
      </svg>
      {labels && <div className="flex mt-1">{labels.map((l, i) => <div key={i} className="flex-1 text-center text-[10px] text-mute truncate">{l}</div>)}</div>}
    </div>
  );
};

export const Donut = ({ parts, size = 120, stroke = 18 }: { parts: { v: number; color: string }[]; size?: number; stroke?: number }) => {
  const total = parts.reduce((a, p) => a + p.v, 0);
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line) / .08)" strokeWidth={stroke} />
      {total > 0 && parts.map((p, i) => { const len = (p.v / total) * c; const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke} strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-off} />; off += len; return el; })}
    </svg>
  );
};

export const Heat = ({ cells, color = 'var(--accent)' }: { cells: { key: string; v: number | null }[]; color?: string }) => (
  <div className="grid grid-cols-7 gap-1.5">
    {cells.map((c) => <div key={c.key} title={c.key} className={cx('aspect-square rounded-md')} style={{ background: c.v == null ? 'rgb(var(--line) / .06)' : `rgb(${color} / ${0.15 + (c.v / 100) * 0.85})` }} />)}
  </div>
);
