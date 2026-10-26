import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { formatShortDate } from '../lib/dates';
import { formatScore } from '../lib/stats';
import type { MeetingRatingStats } from '../lib/types';
import { cx } from './ui/primitives';

/** Clickable 1–10 scale (radio group; arrow keys supported). */
export function RatingPicker({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (score: number) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, score: number) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = Math.min(10, Math.max(1, score + delta));
    refs.current[next - 1]?.focus();
    onChange(next);
  };
  return (
    <div role="radiogroup" aria-label={t('rating.choose')} className="grid grid-cols-5 gap-2 sm:grid-cols-10">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => {
        const selected = value === score;
        const tabbable = value === null ? score === 1 : selected;
        return (
          <button
            key={score}
            ref={(el) => {
              refs.current[score - 1] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t('rating.scoreLabel', { score })}
            tabIndex={tabbable ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(score)}
            onKeyDown={(e) => onKey(e, score)}
            className={cx(
              'h-12 rounded-2xl border text-base font-semibold tabular-nums transition-all disabled:opacity-50',
              selected
                ? 'scale-105 border-primary bg-primary text-primary-ink shadow-md'
                : 'border-line bg-surface hover:border-primary hover:bg-primary-soft',
            )}
          >
            {score}
          </button>
        );
      })}
    </div>
  );
}

/** Horizontal bars, 10 at the top. Counts are always printed as text. */
export function RatingDistribution({ distribution }: { distribution: number[] }) {
  const { t } = useI18n();
  const max = Math.max(1, ...distribution);
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{t('rating.distribution')}</p>
      <ol className="flex flex-col gap-1.5">
        {[...distribution]
          .map((count, i) => ({ score: i + 1, count }))
          .reverse()
          .map(({ score, count }) => (
            <li key={score} className="grid grid-cols-[1.5rem_1fr_2rem] items-center gap-2 text-sm">
              <span className="text-right font-medium tabular-nums text-muted">{score}</span>
              <span className="h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <span
                  className="block h-full rounded-full bg-chart transition-[width]"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </span>
              <span className="text-right tabular-nums text-muted">
                {count}
                <span className="sr-only"> {count === 1 ? t('common.vote', { count }) : t('common.votes', { count })}</span>
              </span>
            </li>
          ))}
      </ol>
    </div>
  );
}

/** Big ring showing an average out of 10. */
export function RatingGauge({ value, size = 128 }: { value: number | null; size?: number }) {
  const { locale, t } = useI18n();
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fraction = value === null ? 0 : value / 10;
  return (
    <div className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--chart)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * fraction} ${c}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tracking-tight tabular-nums" data-testid="gauge-value">
          {formatScore(value, locale)}
        </span>
        <span className="text-xs text-muted">{t('rating.outOf')}</span>
      </div>
    </div>
  );
}

/**
 * Average rating per meeting over time. Single series on a fixed 1–10
 * axis, crosshair + tooltip on hover/focus, and a table alternative.
 */
export function RatingLineChart({ stats }: { stats: MeetingRatingStats[] }) {
  const { locale, t } = useI18n();
  const id = useId();
  const points = stats.filter((s) => s.average !== null).sort((a, b) => a.date.localeCompare(b.date));
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  if (points.length === 0) return <p className="py-8 text-center text-sm text-muted">{t('stats.chartEmpty')}</p>;

  const W = 640;
  const H = 240;
  const pad = { top: 16, right: 16, bottom: 32, left: 32 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - ((v - 1) / 9) * innerH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.average as number).toFixed(1)}`).join(' ');
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  const activePoint = active !== null ? points[active] : undefined;

  const onMove = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const vx = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    points.forEach((_, i) => {
      if (Math.abs(x(i) - vx) < Math.abs(x(best) - vx)) best = i;
    });
    setActive(best);
  };

  return (
    <div>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-pan-y"
          role="img"
          aria-labelledby={`${id}-title`}
          onPointerMove={(e) => onMove(e.clientX)}
          onPointerDown={(e) => onMove(e.clientX)}
          onPointerLeave={() => setActive(null)}
        >
          <title id={`${id}-title`}>{t('stats.chart')}</title>
          {[2, 4, 6, 8, 10].map((v) => (
            <g key={v}>
              <line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
              <text x={pad.left - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
                {v}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % labelEvery === 0 || i === points.length - 1 ? (
              <text key={p.meetingId} x={x(i)} y={H - 10} textAnchor="middle" fontSize={11} fill="var(--muted)">
                {formatShortDate(p.date, locale, false)}
              </text>
            ) : null,
          )}
          {activePoint && active !== null && (
            <line x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + innerH} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 3" />
          )}
          <path d={path} fill="none" stroke="var(--chart)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <g key={p.meetingId}>
              <circle
                cx={x(i)}
                cy={y(p.average as number)}
                r={active === i ? 6 : 4.5}
                fill="var(--chart)"
                stroke="var(--surface)"
                strokeWidth={2}
              />
              {/* larger invisible hit/focus target */}
              <circle
                cx={x(i)}
                cy={y(p.average as number)}
                r={14}
                fill="transparent"
                tabIndex={0}
                role="presentation"
                aria-label={`${formatShortDate(p.date, locale)}: ${formatScore(p.average, locale)}`}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            </g>
          ))}
        </svg>
        {activePoint && active !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-card"
            style={{ left: `${(x(active) / W) * 100}%`, top: 0 }}
            role="tooltip"
          >
            <p className="text-base font-semibold tabular-nums">{formatScore(activePoint.average, locale)}</p>
            <p className="text-muted">{formatShortDate(activePoint.date, locale)}</p>
            <p className="text-muted">
              {activePoint.count === 1 ? t('common.vote', { count: 1 }) : t('common.votes', { count: activePoint.count })}
            </p>
          </div>
        )}
      </div>
      <button
        type="button"
        className="no-print mt-2 text-xs font-medium text-primary hover:underline"
        onClick={() => setShowTable((s) => !s)}
        aria-expanded={showTable}
      >
        {showTable ? '▾' : '▸'} {t('stats.table')}
      </button>
      {showTable && (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 font-medium">{t('meetings.date')}</th>
              <th className="py-1 font-medium">{t('rating.average')}</th>
              <th className="py-1 font-medium">{t('rating.votes')}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.meetingId} className="border-t border-line">
                <td className="py-1.5">
                  <Link className="hover:underline" to={`/moter/${p.date}`}>
                    {formatShortDate(p.date, locale)}
                  </Link>
                </td>
                <td className="py-1.5 tabular-nums">{formatScore(p.average, locale)}</td>
                <td className="py-1.5 tabular-nums">{p.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
