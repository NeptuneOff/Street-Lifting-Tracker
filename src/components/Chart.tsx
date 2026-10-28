import { useId, useState, type CSSProperties, type PointerEvent } from 'react';
import { Check, ChevronLeft, ChevronRight, Crosshair, Eye, Pin, RotateCcw } from 'lucide-react';
import { number } from '../lib/training';

export interface ChartPoint {
  date: string;
  value: number;
  label?: string;
  sessionId?: string;
}
export interface ChartSeries {
  name: string;
  points: ChartPoint[];
  color?: string;
  dash?: string;
}
const colors = ['#c2f36b', '#79c6ff', '#f7b579', '#cbadff', '#75dfca', '#ff9cb5'];
const dateLabel = (date: number, full = false) =>
  new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: full ? 'long' : 'short',
    ...(full ? { year: 'numeric' } : {}),
  });

export function Chart({
  series,
  limit,
  unit = 'kg',
  title,
  showPoints = true,
  onOpenSession,
}: {
  series: ChartSeries[];
  limit?: number;
  unit?: string;
  title: string;
  showPoints?: boolean;
  onOpenSession?: (id: string) => void;
}) {
  const id = useId();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const [showLimit, setShowLimit] = useState(true);
  const available = series
    .map((s, index) => ({ ...s, color: s.color ?? colors[index % colors.length] }))
    .filter((s) => s.points.length);
  const visible = available.filter((s) => !hidden.has(s.name));
  const points = visible.flatMap((s) => s.points);
  const times = [...new Set(points.map((p) => new Date(p.date).getTime()))].sort((a, b) => a - b);
  const foundIndex = selectedTime === null ? -1 : times.indexOf(selectedTime);
  const selectedIndex = foundIndex >= 0 ? foundIndex : times.length - 1;
  const selected = times[selectedIndex];
  const selectedPoints = visible.flatMap((s) =>
    s.points
      .filter((p) => new Date(p.date).getTime() === selected)
      .map((p) => ({ ...p, series: s })),
  );
  const all = points.map((p) => p.value);
  if (limit !== undefined && showLimit) all.push(limit);
  const min = all.length ? Math.min(...all) : 0;
  const max = all.length ? Math.max(...all) : 10;
  const rawStep = Math.max(1, (max - min) / 3);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((n) => n * magnitude).find((n) => n >= rawStep)!;
  const low = Math.floor((min - step * 0.25) / step) * step;
  const high = Math.ceil((max + step * 0.25) / step) * step;
  const first = times[0],
    last = times.at(-1)!;
  const x = (time: number) => (first === last ? 315 : 58 + ((time - first) / (last - first)) * 514);
  const y = (value: number) => 228 - ((value - low) / (high - low)) * 188;
  const nearest = (clientX: number, element: SVGSVGElement) => {
    const bounds = element.getBoundingClientRect();
    const target = ((clientX - bounds.left) / bounds.width) * 600;
    return times.reduce(
      (best, time) => (Math.abs(x(time) - target) < Math.abs(x(best) - target) ? time : best),
      times[0],
    );
  };
  const hover = (event: PointerEvent<SVGSVGElement>) => {
    if (!pinned && event.pointerType === 'mouse' && times.length)
      setSelectedTime(nearest(event.clientX, event.currentTarget));
  };
  const toggle = (name: string) => {
    setHidden((previous) => {
      const next = new Set(previous);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    setSelectedTime(null);
    setPinned(false);
  };
  const selectIndex = (index: number) => {
    setSelectedTime(times[index]);
    setPinned(true);
  };
  const signature = visible
    .map((s) => `${s.name}:${s.points.map((p) => `${p.date},${p.value}`).join(';')}`)
    .join('|');
  return (
    <div className="chart interactive-chart">
      <div className="plot-meta">
        <span>{unit.toUpperCase()}</span>
        <span>
          <Crosshair size={12} /> Survole ou touche un point
        </span>
      </div>
      {points.length ? (
        <svg
          role="img"
          aria-label={title}
          aria-describedby={`${id}-help`}
          viewBox="0 0 600 280"
          onPointerMove={hover}
          onPointerLeave={() => {
            if (!pinned) setSelectedTime(null);
          }}
          onClick={(event) => {
            setSelectedTime(nearest(event.clientX, event.currentTarget));
            setPinned(true);
          }}
        >
          <title>{title}. Valeurs et navigation disponibles sous le graphique.</title>
          {Array.from(
            { length: Math.round((high - low) / step) + 1 },
            (_, i) => low + i * step,
          ).map((value) => (
            <g key={value}>
              <line x1="58" x2="572" y1={y(value)} y2={y(value)} className="chart-gridline" />
              <text x="44" y={y(value) + 7} textAnchor="end" className="chart-axis">
                {number(value)}
              </text>
            </g>
          ))}
          {limit !== undefined && showLimit && (
            <g>
              <line x1="58" x2="572" y1={y(limit)} y2={y(limit)} className="chart-limit-line" />
              <text x="572" y={y(limit) - 10} textAnchor="end" className="chart-limit-label">
                Limite {number(limit)} {unit}
              </text>
            </g>
          )}
          {visible.map((s) => (
            <g key={s.name}>
              <polyline
                key={`${s.name}:${signature}`}
                className="chart-line"
                fill="none"
                stroke={s.color}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={s.dash}
                points={s.points
                  .map((p) => `${x(new Date(p.date).getTime())},${y(p.value)}`)
                  .join(' ')}
              />
              {showPoints &&
                s.points.map((p, j) => (
                  <circle
                    key={`${p.date}:${j}`}
                    className="chart-dot"
                    cx={x(new Date(p.date).getTime())}
                    cy={y(p.value)}
                    r="4.5"
                    fill={s.color}
                    stroke="var(--panel)"
                    strokeWidth="2"
                  >
                    <title>
                      {dateLabel(new Date(p.date).getTime(), true)} · {s.name} · {number(p.value)}{' '}
                      {unit}
                    </title>
                  </circle>
                ))}
            </g>
          ))}
          <line x1={x(selected)} x2={x(selected)} y1="30" y2="228" className="chart-cursor" />
          {selectedPoints.map((p, i) => (
            <g key={`${p.series.name}:${i}`}>
              <circle
                cx={x(selected)}
                cy={y(p.value)}
                r="12"
                fill={p.series.color}
                opacity="0.13"
              />
              <circle
                cx={x(selected)}
                cy={y(p.value)}
                r="6"
                fill={p.series.color}
                stroke="var(--panel)"
                strokeWidth="2.5"
              />
            </g>
          ))}
          {[...new Set(first === last ? [first] : [first, (first + last) / 2, last])].map(
            (time, i, dates) => (
              <text
                key={time}
                x={x(time)}
                y="267"
                textAnchor={
                  dates.length === 1
                    ? 'middle'
                    : i === 0
                      ? 'start'
                      : i === dates.length - 1
                        ? 'end'
                        : 'middle'
                }
                className="chart-axis"
              >
                {dateLabel(time)}
              </text>
            ),
          )}
        </svg>
      ) : (
        <div className="empty-chart">
          <Crosshair size={25} />
          <p>
            {available.length ? 'Toutes les séries sont masquées.' : 'Aucun pic pour ces filtres.'}
          </p>
          {available.length ? (
            <button className="text-link" onClick={() => setHidden(new Set())}>
              Tout afficher
            </button>
          ) : (
            <small>Élargis la période ou valide un pic en séance.</small>
          )}
        </div>
      )}
      {points.length > 0 && (
        <div className="chart-inspector">
          <div className="inspector-head">
            <span>
              <Pin size={12} /> {pinned ? 'POINT ÉPINGLÉ' : 'POINT SÉLECTIONNÉ'}
            </span>
            {pinned && (
              <button
                onClick={() => {
                  setPinned(false);
                  setSelectedTime(null);
                }}
              >
                Libérer
              </button>
            )}
          </div>
          <div className="point-navigation">
            <button
              className="icon-button"
              aria-label="Point précédent"
              disabled={selectedIndex <= 0}
              onClick={() => selectIndex(selectedIndex - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <strong>{dateLabel(selected, true)}</strong>
            <button
              className="icon-button"
              aria-label="Point suivant"
              disabled={selectedIndex >= times.length - 1}
              onClick={() => selectIndex(selectedIndex + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
          <input
            className="chart-scrubber"
            type="range"
            aria-label={`Parcourir les points : ${title}`}
            aria-valuetext={selectedPoints
              .map(
                (p) => `${dateLabel(selected, true)}, ${p.series.name}, ${number(p.value)} ${unit}`,
              )
              .join('; ')}
            min="0"
            max={Math.max(0, times.length - 1)}
            value={selectedIndex}
            disabled={times.length < 2}
            onChange={(event) => selectIndex(Number(event.target.value))}
          />
          <div className="selected-points" aria-live={pinned ? 'polite' : 'off'}>
            {selectedPoints.map((p, i) => (
              <div
                key={`${p.series.name}:${i}`}
                className="selected-point"
                style={{ '--series-color': p.series.color } as CSSProperties}
              >
                <div>
                  <span className="series-swatch" />
                  <span>{p.series.name}</span>
                  <strong>
                    {number(p.value)} <small>{unit}</small>
                  </strong>
                </div>
                {p.label && <p>{p.label}</p>}
                {p.sessionId && onOpenSession && (
                  <button className="text-link" onClick={() => onOpenSession(p.sessionId!)}>
                    Voir la séance <ChevronRight size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {available.length > 0 && (
        <div className="interactive-legend" aria-label={`Légende : ${title}`}>
          <div className="legend-head">
            <span>
              SÉRIES{' '}
              <b>
                {visible.length}/{available.length}
              </b>
            </span>
            <button
              onClick={() => {
                setHidden(new Set());
                setSelectedTime(null);
                setPinned(false);
              }}
            >
              <RotateCcw size={12} /> Tout afficher
            </button>
          </div>
          <p id={`${id}-help`}>
            Coche une série pour l’afficher. La cible l’isole. Le curseur parcourt les dates.
          </p>
          <div className="legend-rows">
            {available.map((s) => (
              <div
                className={`legend-row ${hidden.has(s.name) ? 'is-hidden' : ''}`}
                key={s.name}
                style={{ '--series-color': s.color } as CSSProperties}
              >
                <button
                  className="legend-toggle"
                  aria-pressed={!hidden.has(s.name)}
                  aria-label={`Afficher ${s.name}`}
                  onClick={() => toggle(s.name)}
                >
                  <span className="legend-check">
                    {!hidden.has(s.name) && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="legend-name">
                    {s.name}
                    <small>
                      {s.points.length} point{s.points.length > 1 ? 's' : ''} · dernier :{' '}
                      {number(s.points.at(-1)!.value)} {unit}
                    </small>
                  </span>
                  <span
                    className="legend-line"
                    style={{ borderTopStyle: s.dash ? 'dashed' : 'solid' }}
                  />
                </button>
                <button
                  className="legend-isolate icon-button"
                  aria-label={`Isoler ${s.name}`}
                  title="Afficher uniquement cette série"
                  onClick={() => {
                    setHidden(
                      new Set(
                        available
                          .filter((other) => other.name !== s.name)
                          .map((other) => other.name),
                      ),
                    );
                    setSelectedTime(null);
                    setPinned(false);
                  }}
                >
                  <Crosshair size={16} />
                </button>
              </div>
            ))}
          </div>
          {limit !== undefined && (
            <button
              className="limit-toggle"
              aria-pressed={showLimit}
              onClick={() => setShowLimit(!showLimit)}
            >
              <Eye size={13} /> Limite de catégorie · {number(limit)} {unit}
              <span>{showLimit ? 'Visible' : 'Masquée'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
