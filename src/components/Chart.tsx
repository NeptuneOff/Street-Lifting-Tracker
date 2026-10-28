import { number } from '../lib/training';
export interface ChartPoint {
  date: string;
  value: number;
  label?: string;
}
export interface ChartSeries {
  name: string;
  points: ChartPoint[];
}
const colors = ['#c2f36b', '#7bbaed', '#edac72', '#d198ed', '#6cd4b6', '#e67b99'];
export function Chart({
  series,
  limit,
  unit = 'kg',
  title,
}: {
  series: ChartSeries[];
  limit?: number;
  unit?: string;
  title: string;
}) {
  const points = series.flatMap((s) => s.points);
  if (!points.length)
    return (
      <div className="empty-chart">
        <span className="chart-baseline" />
        <p>Le prochain point, c’est toi.</p>
        <small>Valide un pic pour lancer ta courbe.</small>
      </div>
    );
  const all = points.map((p) => p.value);
  if (limit !== undefined) all.push(limit);
  const minY = Math.min(...all),
    maxY = Math.max(...all),
    padding = Math.max(2, (maxY - minY) * 0.2);
  const low = minY - padding,
    high = maxY + padding;
  const times = points.map((p) => new Date(p.date).getTime()),
    first = Math.min(...times),
    last = Math.max(...times);
  const x = (date: string) =>
    first === last ? 320 : 50 + ((new Date(date).getTime() - first) / (last - first)) * 540;
  const y = (value: number) => 160 - ((value - low) / (high - low)) * 130;
  return (
    <div className="chart">
      <svg role="img" aria-label={title} viewBox="0 0 620 200">
        <title>{title}</title>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1="50"
              x2="590"
              y1={y(low + (high - low) * t)}
              y2={y(low + (high - low) * t)}
              stroke="#303730"
              strokeDasharray="4 5"
            />
            <text
              x="40"
              y={y(low + (high - low) * t) + 4}
              textAnchor="end"
              fill="#8b948a"
              fontSize="18"
            >
              {number(low + (high - low) * t)}
            </text>
          </g>
        ))}
        {limit !== undefined && (
          <g>
            <line
              x1="50"
              x2="590"
              y1={y(limit)}
              y2={y(limit)}
              stroke="#edac72"
              strokeDasharray="7 5"
            />
            <text x="590" y={y(limit) - 7} fill="#edac72" textAnchor="end" fontSize="18">
              Catégorie {number(limit)} {unit}
            </text>
          </g>
        )}
        {series.map((s, i) => (
          <g key={s.name}>
            <polyline
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth="2.5"
              strokeLinejoin="round"
              points={s.points.map((p) => `${x(p.date)},${y(p.value)}`).join(' ')}
            />
            {s.points.map((p, j) => (
              <circle
                key={`${p.date}:${j}`}
                cx={x(p.date)}
                cy={y(p.value)}
                r="4.5"
                fill={colors[i % colors.length]}
                stroke="#1b201c"
                strokeWidth="2"
              >
                <title>
                  {new Date(p.date).toLocaleDateString('fr-FR')} · {s.name} · {number(p.value)}{' '}
                  {unit}
                  {p.label ? ` · ${p.label}` : ''}
                </title>
              </circle>
            ))}
          </g>
        ))}
        <text
          x={first === last ? 320 : 50}
          y="190"
          textAnchor={first === last ? 'middle' : 'start'}
          fill="#8b948a"
          fontSize="18"
        >
          {new Date(first).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </text>
        {first !== last && (
          <text x="590" y="190" textAnchor="end" fill="#8b948a" fontSize="18">
            {new Date(last).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </text>
        )}
      </svg>
      <div className="chart-legend">
        {series
          .filter((s) => s.points.length)
          .map((s, i) => (
            <span key={s.name}>
              <i style={{ background: colors[i % colors.length] }} />
              {s.name}
            </span>
          ))}
      </div>
    </div>
  );
}
