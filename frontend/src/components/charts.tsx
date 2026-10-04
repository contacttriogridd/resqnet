import { Table2, BarChart3 } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cn } from '../utils/cn';

/**
 * Lightweight, dependency-free charts for the admin dashboard.
 * Conventions: single series → one hue (info token), no legend box; bars
 * ≤ 24 px with 4 px rounded data-ends; values in text colour; hairline
 * baseline; hover tooltip on every mark; a table view for every chart.
 */

export function StatTile({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'critical' }) {
  return (
    <div className={cn('rounded-2xl border bg-surface p-4', tone === 'critical' ? 'border-2 border-critical-line' : 'border-line')}>
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="tabular mt-1 text-3xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
    </div>
  );
}

function ChartFrame({
  title,
  subtitle,
  table,
  children,
}: {
  title: string;
  subtitle?: string;
  table: { head: [string, string]; rows: [string, number][] };
  children: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  return (
    <section className="rounded-2xl border border-line bg-surface p-4" aria-labelledby={id}>
      <div className="mb-3 flex items-start gap-2">
        <div className="flex-1">
          <h3 id={id} className="font-bold">
            {title}
          </h3>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-info hover:bg-surface-2"
          aria-pressed={asTable}
        >
          {asTable ? <BarChart3 className="size-4" aria-hidden /> : <Table2 className="size-4" aria-hidden />}
          {asTable ? 'Chart' : 'Table'}
        </button>
      </div>
      {asTable ? (
        <table className="w-full text-left text-[0.95rem]">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="py-1.5 font-semibold">{table.head[0]}</th>
              <th className="py-1.5 text-right font-semibold">{table.head[1]}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map(([k, v]) => (
              <tr key={k} className="border-b border-line/60">
                <td className="py-1.5">{k}</td>
                <td className="tabular py-1.5 text-right">{v.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        children
      )}
    </section>
  );
}

/** Horizontal bar list: magnitude by category, value at the bar tip. */
export function BarList({
  title,
  subtitle,
  data,
  unit = 'incidents',
  emptyText = 'No data for this period.',
}: {
  title: string;
  subtitle?: string;
  data: { label: string; value: number }[];
  unit?: string;
  emptyText?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartFrame title={title} subtitle={subtitle} table={{ head: ['Category', unit], rows: data.map((d) => [d.label, d.value]) }}>
      {data.length === 0 ? (
        <p className="text-muted">{emptyText}</p>
      ) : (
        <ul className="space-y-2.5">
          {data.map((d) => (
            <li key={d.label} className="group relative">
              <div className="mb-1 flex justify-between gap-2 text-sm">
                <span className="truncate">{d.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-5 flex-1 border-l border-line-strong">
                  <div
                    className="h-full max-h-6 rounded-r-[4px] bg-info transition-opacity group-hover:opacity-80"
                    style={{ width: `${Math.max(1.5, (d.value / max) * 100)}%` }}
                  />
                </div>
                <span className="tabular w-10 text-right text-sm font-semibold">{d.value}</span>
              </div>
              <span
                role="tooltip"
                className="pointer-events-none absolute -top-8 left-0 z-10 hidden rounded-lg bg-text px-2 py-1 text-sm whitespace-nowrap text-bg shadow group-hover:block"
              >
                {d.label}: {d.value} {unit} ({total ? Math.round((d.value / total) * 100) : 0}%)
              </span>
            </li>
          ))}
        </ul>
      )}
    </ChartFrame>
  );
}

/** Daily column chart (single series). Labels only the peak and the latest day. */
export function ColumnChart({
  title,
  subtitle,
  data,
  unit = 'incidents',
}: {
  title: string;
  subtitle?: string;
  data: { date: string; count: number }[];
  unit?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 200;
  const pad = { l: 28, r: 8, t: 22, b: 24 };
  const max = Math.max(1, ...data.map((d) => d.count));
  const niceMax = Math.max(2, Math.ceil(max / 2) * 2);
  const band = (W - pad.l - pad.r) / Math.max(1, data.length);
  const bw = Math.min(24, band - 4);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / niceMax);
  const peak = data.reduce((best, d, i) => (d.count > (data[best]?.count ?? -1) ? i : best), 0);
  const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });

  return (
    <ChartFrame title={title} subtitle={subtitle} table={{ head: ['Day (UTC)', unit], rows: data.map((d) => [fmtDay(d.date), d.count]) }}>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${title}. Use the Table button for values.`}>
          {[0, niceMax / 2, niceMax].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
              <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">
                {t}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = pad.l + i * band + (band - bw) / 2;
            const top = y(d.count);
            const h = Math.max(0, y(0) - top);
            const r = Math.min(4, h / 2, bw / 2);
            const showLabel = d.count > 0 && (i === peak || i === data.length - 1);
            return (
              <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                {/* Hit target larger than the mark. */}
                <rect x={pad.l + i * band} y={pad.t} width={band} height={H - pad.t - pad.b} fill="transparent" />
                {h > 0 && (
                  <path
                    d={`M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${y(0)} Z`}
                    fill="var(--info)"
                    opacity={hover === null || hover === i ? 1 : 0.55}
                  />
                )}
                {showLabel && (
                  <text x={x + bw / 2} y={top - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--text)">
                    {d.count}
                  </text>
                )}
                {(i % Math.ceil(data.length / 7) === 0 || i === data.length - 1) && (
                  <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
                    {fmtDay(d.date)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover !== null && data[hover] && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-0 rounded-lg bg-text px-2 py-1 text-sm whitespace-nowrap text-bg shadow"
            style={{ left: `${((pad.l + hover * band + band / 2) / W) * 100}%`, transform: 'translateX(-50%)' }}
          >
            {fmtDay(data[hover].date)}: {data[hover].count} {unit}
          </div>
        )}
      </div>
    </ChartFrame>
  );
}
