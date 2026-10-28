import { useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Eye,
  ListFilter,
  RotateCcw,
  Search,
  Scale,
  SlidersHorizontal,
  Trophy,
  Trash2,
} from 'lucide-react';
import { removeRecord, useData } from '../lib/store';
import {
  comparableTrend,
  estimated1RM,
  loadLabel,
  number,
  sessionProgress,
  weeklyWeights,
} from '../lib/training';
import { DAYS, type TrainingSession } from '../lib/types';
import { Button, Empty, Modal, Note, PageTitle, useApp } from '../components/UI';
import { Chart, type ChartSeries } from '../components/Chart';

export function Progress() {
  const { sessions, exercises, weights, profile } = useData();
  const { toast, navigate } = useApp();
  const [months, setMonths] = useState(3);
  const [intent, setIntent] = useState('Toutes');
  const [reps, setReps] = useState('Toutes');
  const [metric, setMetric] = useState('load');
  const [movement, setMovement] = useState('all');
  const [showPoints, setShowPoints] = useState(true);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<TrainingSession | null>(null);
  const completed = sessions.filter((s) => s.status === 'completed');
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const filtered = completed
    .filter((s) => months === 0 || new Date(s.startedAt) >= cutoff)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const matches = filtered.flatMap((s) =>
    s.exercises
      .filter(
        (e) =>
          e.result.confirmed &&
          (intent === 'Toutes' || e.intent === intent) &&
          (reps === 'Toutes' || e.result.reps === Number(reps)) &&
          (metric !== 'e1rm' || e.result.reps <= 10),
      )
      .map((e) => ({ s, e })),
  );
  const scopedMatches = matches.filter(({ e }) => movement === 'all' || e.exerciseId === movement);
  const lastWeight = weights.at(-1)?.kg ?? profile!.bodyweight;
  const weekly = weeklyWeights(weights);
  const filteredWeights = weights.filter(
    (w) => months === 0 || new Date(`${w.date}T12:00:00`) >= cutoff,
  );
  const history = filtered
    .filter((s) =>
      s.exercises.some(
        (e) =>
          (movement === 'all' || e.exerciseId === movement) &&
          (intent === 'Toutes' || e.intent === intent) &&
          (reps === 'Toutes' || (e.result.confirmed && e.result.reps === Number(reps))),
      ),
    )
    .filter((s) =>
      `${s.programName} ${s.exercises.map((e) => `${e.definition.name} ${e.result.comment}`).join(' ')}`
        .toLocaleLowerCase('fr')
        .includes(search.toLocaleLowerCase('fr')),
    );
  const openSession = (id: string) => setDetail(completed.find((s) => s.id === id) ?? null);
  const jump = (id: string) =>
    document.getElementById(id)?.scrollIntoView({
      behavior:
        document.documentElement.dataset.motion === 'full' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'smooth'
          : 'instant',
      block: 'start',
    });
  const resetFilters = () => {
    setMonths(3);
    setIntent('Toutes');
    setReps('Toutes');
    setMetric('load');
    setMovement('all');
    setShowPoints(true);
    setSearch('');
  };
  return (
    <>
      <PageTitle eyebrow="LE TRAVAIL LAISSE UNE TRACE" title="Ta progression, en clair.">
        <span className="tag">
          <Activity size={13} /> {completed.length} SÉANCE{completed.length !== 1 ? 'S' : ''} AU
          COMPTEUR
        </span>
      </PageTitle>
      <p className="progress-intro">
        Choisis ta période, compare tes formats et explore chaque performance.
      </p>
      <div className="tracking-overview">
        <div className="card tracking-stat">
          <span className="tracking-stat-icon">
            <CalendarDays size={18} />
          </span>
          <div>
            <span>Séances sur la période</span>
            <strong key={months}>
              {filtered.length}
              <small>{months ? ` / ${months} mois` : ' au total'}</small>
            </strong>
          </div>
        </div>
        <div className="card tracking-stat">
          <span className="tracking-stat-icon blue">
            <Activity size={18} />
          </span>
          <div>
            <span>Pics avec les filtres actuels</span>
            <strong key={`${months}:${intent}:${reps}:${movement}:${metric}`}>
              {scopedMatches.length}
              <small> validés</small>
            </strong>
          </div>
        </div>
        <div className="card tracking-stat">
          <span className="tracking-stat-icon peach">
            <Scale size={18} />
          </span>
          <div>
            <span>{weights.length ? 'Dernière pesée' : 'Poids de référence'}</span>
            <strong>
              {number(lastWeight)}
              <small> kg</small>
            </strong>
          </div>
        </div>
      </div>
      <div className="tracking-jumps" aria-label="Sections du suivi">
        <button onClick={() => jump('performance-section')}>
          <Activity size={14} /> Performances
        </button>
        <button onClick={() => jump('weight-section')}>
          <Scale size={14} /> Poids de corps
        </button>
        <button onClick={() => jump('history-section')}>
          <CalendarDays size={14} /> Historique <ArrowDown size={12} />
        </button>
      </div>
      <section
        className="card tracking-controls"
        aria-label="Contrôles du suivi"
        id="performance-section"
      >
        <div className="tracking-controls-head">
          <span>
            <SlidersHorizontal size={15} /> TON SUIVI, TA LECTURE
          </span>
          <button className="text-link" onClick={resetFilters}>
            <RotateCcw size={13} /> Réinitialiser
          </button>
        </div>
        <div className="progress-filters">
          <div className="control-group">
            <span className="control-label">PÉRIODE</span>
            <div className="segmented" role="group" aria-label="Période">
              {[1, 3, 6, 0].map((m) => (
                <button
                  key={m}
                  className={months === m ? 'selected' : ''}
                  aria-pressed={months === m}
                  onClick={() => setMonths(m)}
                >
                  {m === 0 ? 'Tout' : `${m} mois`}
                </button>
              ))}
            </div>
          </div>
          <label className="control-group">
            <span className="control-label">MESURE</span>
            <select
              aria-label="Mesure du graphique"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
            >
              <option value="load">Charge réalisée · kg</option>
              <option value="e1rm">1RM estimé · kg</option>
            </select>
          </label>
          <label className="control-group">
            <span className="control-label">TYPE DE TRAVAIL</span>
            <select
              aria-label="Type de séance"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
            >
              <option value="Toutes">Tous les types</option>
              <option>Force</option>
              <option>Volume</option>
              <option>Technique</option>
            </select>
          </label>
          <label className="control-group">
            <span className="control-label">RÉPÉTITIONS</span>
            <select
              aria-label="Répétitions comparées"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
            >
              <option value="Toutes">Toutes les reps</option>
              {[
                ...new Set(
                  completed.flatMap((s) =>
                    s.exercises.filter((e) => e.result.confirmed).map((e) => e.result.reps),
                  ),
                ),
              ]
                .sort((a, b) => a - b)
                .map((n) => (
                  <option value={n} key={n}>
                    {n} rep{n > 1 ? 's' : ''}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="movement-controls">
          <div className="movement-tabs" role="group" aria-label="Exercice affiché">
            <button
              className={movement === 'all' ? 'selected' : ''}
              aria-pressed={movement === 'all'}
              onClick={() => setMovement('all')}
            >
              Vue d’ensemble
            </button>
            {exercises.map((e) => (
              <button
                key={e.id}
                className={movement === e.id ? 'selected' : ''}
                aria-pressed={movement === e.id}
                onClick={() => setMovement(e.id)}
              >
                {e.shortName}
              </button>
            ))}
          </div>
          <button
            className={`points-toggle ${showPoints ? 'selected' : ''}`}
            aria-pressed={showPoints}
            onClick={() => setShowPoints(!showPoints)}
          >
            <Eye size={14} /> Points
          </button>
        </div>
      </section>
      <div className="tracking-section-title">
        <div>
          <span className="eyebrow">01 / PERFORMANCES</span>
          <h2>
            {movement === 'all'
              ? 'Chaque mouvement, sa trajectoire.'
              : exercises.find((e) => e.id === movement)?.name}
          </h2>
        </div>
        <span className="tracking-hint">
          <SlidersHorizontal size={13} /> Légendes interactives
        </span>
      </div>
      <div className={`charts-grid ${movement !== 'all' ? 'is-focused' : ''}`}>
        {exercises
          .filter((e) => movement === 'all' || e.id === movement)
          .map((exercise) => {
            const points = matches.filter(({ e }) => e.exerciseId === exercise.id);
            const groups = new Map<string, ChartSeries>();
            for (const { s, e } of points) {
              const name = `${e.intent} · ${e.result.sets} × ${e.result.reps} · ${e.definition.weighted ? 'lest' : 'barre'}`;
              const group = groups.get(name) ?? {
                name,
                points: [],
                color:
                  e.intent === 'Force' ? '#c2f36b' : e.intent === 'Volume' ? '#79c6ff' : '#f7b579',
                dash: ['', '10 6', '3 6'][(e.result.sets + e.result.reps) % 3],
              };
              group.points.push({
                date: s.startedAt,
                value:
                  metric === 'e1rm'
                    ? estimated1RM(
                        e.result.load,
                        e.result.reps,
                        e.definition.weighted,
                        s.bodyweight,
                      )
                    : e.result.load,
                label: `RIR ${e.result.rir ?? 'non renseigné'} · PDC ${number(s.bodyweight)} kg${e.result.comment ? ` · ${e.result.comment}` : ''}`,
                sessionId: s.id,
              });
              groups.set(name, group);
            }
            const trend = comparableTrend(
              filtered.map((s) => ({
                ...s,
                exercises: s.exercises.filter(
                  (e) =>
                    (intent === 'Toutes' || e.intent === intent) &&
                    (reps === 'Toutes' || e.result.reps === Number(reps)) &&
                    (metric !== 'e1rm' || e.result.reps <= 10),
                ),
              })),
              exercise.id,
            );
            const last = points.at(-1);
            const values = [...groups.values()].flatMap((g) => g.points.map((p) => p.value));
            const singles = completed
              .flatMap((s) =>
                s.exercises
                  .filter(
                    (e) =>
                      e.exerciseId === exercise.id &&
                      e.result.confirmed &&
                      e.result.reps === 1 &&
                      e.definition.weighted === exercise.weighted,
                  )
                  .map((e) => ({ s, e })),
              )
              .sort((a, b) => b.e.result.load - a.e.result.load);
            const best = singles[0];
            const previousBest =
              best &&
              singles.filter(
                ({ s, e }) => s.startedAt < best.s.startedAt && e.result.load < best.e.result.load,
              )[0];
            return (
              <section className="card performance-card" key={exercise.id}>
                <div className="section-head">
                  <div>
                    <span className="eyebrow">
                      {exercise.weighted
                        ? 'LEST AJOUTÉ · HORS POIDS DE CORPS'
                        : 'CHARGE TOTALE DE LA BARRE'}
                    </span>
                    <h2>{exercise.shortName}</h2>
                  </div>
                  <span
                    className={`trend ${trend.delta !== null && trend.delta > 0 ? 'positive' : ''}`}
                    title="Tendance des deux derniers pics comparables, calculée sur les charges réalisées"
                  >
                    {trend.delta !== null && trend.delta > 0 && <ArrowUpRight size={14} />}{' '}
                    {trend.label}
                  </span>
                </div>
                <div className="performance-numbers">
                  <div>
                    <span>Dernier pic{metric === 'e1rm' ? ' · estimé' : ''}</span>
                    <div className="chart-current" key={`${months}:${intent}:${reps}:${metric}`}>
                      {last
                        ? number(
                            metric === 'e1rm'
                              ? estimated1RM(
                                  last.e.result.load,
                                  last.e.result.reps,
                                  last.e.definition.weighted,
                                  last.s.bodyweight,
                                )
                              : last.e.result.load,
                          )
                        : '—'}
                      <small> kg</small>
                    </div>
                    <p>
                      {last
                        ? `${last.e.intent} · ${last.e.result.sets} × ${last.e.result.reps} · ${new Date(last.s.startedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
                        : 'Aucun pic sur cette période'}
                    </p>
                  </div>
                  <div className="performance-maximum">
                    <span>Max. sur la période</span>
                    <strong>
                      {values.length ? number(Math.max(...values)) : '—'}
                      <small> kg{metric === 'e1rm' ? ' estimés' : ''}</small>
                    </strong>
                    <span>
                      {points.length} pic{points.length > 1 ? 's' : ''} · tous formats filtrés
                    </span>
                  </div>
                </div>
                <Chart
                  key={`${months}:${intent}:${reps}:${metric}`}
                  series={[...groups.values()].sort((a, b) => a.name.localeCompare(b.name))}
                  title={`Évolution ${exercise.name}`}
                  showPoints={showPoints}
                  onOpenSession={openSession}
                />
                <div className="chart-record">
                  <Trophy size={16} />
                  {best ? (
                    <span>
                      Record réalisé · single{' '}
                      <strong>{loadLabel(best.e.result.load, best.e.definition.weighted)}</strong> ·{' '}
                      {new Date(best.s.startedAt).toLocaleDateString('fr-FR')}
                      {previousBest
                        ? ` · +${number(best.e.result.load - previousBest.e.result.load)} kg vs précédent record`
                        : ''}
                      <small>Toutes périodes · indépendant des filtres</small>
                    </span>
                  ) : (
                    <span>
                      Référence déclarée :{' '}
                      <strong>{loadLabel(exercise.reference, exercise.weighted)}</strong> ·{' '}
                      {exercise.reliability.toLowerCase()}
                      <small>Aucun single réalisé dans le carnet.</small>
                    </span>
                  )}
                </div>
              </section>
            );
          })}
      </div>
      <details className="tracking-explainer card">
        <summary>
          <CircleHelp size={16} /> Comment lire les courbes et les tendances ?{' '}
          <ChevronRight size={16} />
        </summary>
        <Note>
          {metric === 'e1rm'
            ? 'Estimation d’Epley (1 à 10 reps), calculée sur la résistance totale pour les exercices lestés, puis exprimée en lest équivalent. Elle ne constitue pas un record réalisé. La tendance reste calculée sur les charges réellement réalisées.'
            : 'Chaque courbe sépare le type de travail et le format séries × reps. La tendance compare les deux derniers pics comparables : même format et type, RIR proche si renseigné, poids de corps à ±1,5 kg pour les exercices lestés. Le maximum affiché rassemble les formats filtrés et ne remplace pas cette comparaison.'}
        </Note>
        <p>
          Vert : force · Bleu : volume · Orange : technique. Chaque format conserve sa ligne. Les
          dates, charges, RIR et commentaires viennent des séances enregistrées.
        </p>
      </details>
      <section className="card weight-card" id="weight-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">02 / POIDS & CATÉGORIE</span>
            <h2>Garder le cap.</h2>
          </div>
          <Button className="secondary" onClick={() => navigate('settings')}>
            Ajouter une pesée
          </Button>
        </div>
        <p className="tracking-description">
          Les pesées montrent les variations du jour. La moyenne hebdomadaire aide à suivre la
          direction.
        </p>
        <div className="weight-stats">
          <div>
            <span>Dernier poids{weights.length ? '' : ' de référence'}</span>
            <strong>
              {number(lastWeight)}
              <small> kg</small>
            </strong>
          </div>
          <div>
            <span>Marge / limite {number(profile!.category)} kg</span>
            <strong className={lastWeight > profile!.category ? 'orange' : 'lime'}>
              {number(profile!.category - lastWeight)}
              <small> kg</small>
            </strong>
          </div>
          <div>
            <span>Moyenne dernière semaine renseignée</span>
            <strong>
              {weekly.length ? number(weekly.at(-1)!.kg) : '—'}
              <small> kg</small>
            </strong>
            {weekly.length > 0 && (
              <small className="muted">
                Semaine du {new Date(`${weekly.at(-1)!.date}T12:00:00`).toLocaleDateString('fr-FR')}
              </small>
            )}
          </div>
        </div>
        {weights.length ? (
          <Chart
            key={months}
            title="Évolution du poids de corps"
            showPoints={showPoints}
            series={[
              {
                name: 'Pesées',
                color: '#79c6ff',
                dash: '5 5',
                points: filteredWeights.map((w) => ({ date: `${w.date}T12:00:00`, value: w.kg })),
              },
              {
                name: 'Moyennes hebdomadaires',
                color: '#c2f36b',
                points: weekly
                  .filter((w) => months === 0 || new Date(`${w.date}T12:00:00`) >= cutoff)
                  .map((w) => ({ date: `${w.date}T12:00:00`, value: w.kg })),
              },
            ]}
            limit={profile!.category}
          />
        ) : (
          <p className="muted small">
            Aucune pesée enregistrée. Le poids du profil sert uniquement de référence.
          </p>
        )}
      </section>
      <section id="history-section" className="tracking-history">
        <div className="tracking-section-title">
          <div>
            <span className="eyebrow">03 / LE CARNET</span>
            <h2>L’historique</h2>
          </div>
          <span className="small muted">
            {history.length} séance{history.length !== 1 ? 's' : ''} sur la période
          </span>
        </div>
        <label className="history-search">
          <Search size={17} />
          <input
            type="search"
            aria-label="Rechercher dans l’historique"
            placeholder="Rechercher une séance, un exercice, un ressenti…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {intent !== 'Toutes' || reps !== 'Toutes' || movement !== 'all' ? (
          <p className="history-filter-note">
            <ListFilter size={13} /> L’historique suit les filtres d’exercice, de type et de
            répétitions.
          </p>
        ) : null}
        {history.length ? (
          <div className="history-list">
            {[...history].reverse().map((s) => (
              <button className="history-row card" key={s.id} onClick={() => setDetail(s)}>
                <div className="history-date">
                  <strong>{new Date(s.startedAt).getDate()}</strong>
                  <span>
                    {new Date(s.startedAt).toLocaleDateString('fr-FR', { month: 'short' })}
                  </span>
                  <small>{new Date(s.startedAt).getFullYear()}</small>
                </div>
                <div className="history-main">
                  <strong>{s.programName}</strong>
                  <span>
                    {DAYS[s.weekday]} · {s.exercises.filter((e) => e.result.confirmed).length}{' '}
                    pic(s) validé(s) · {sessionProgress(s).percent}% des séries obligatoires
                  </span>
                  <div className="history-performance-tags">
                    {s.exercises
                      .filter((e) => e.result.confirmed)
                      .map((e) => (
                        <span key={e.id}>
                          {e.definition.shortName}{' '}
                          <b>{loadLabel(e.result.load, e.definition.weighted)}</b>
                          <small>
                            {e.result.sets}×{e.result.reps}
                          </small>
                        </span>
                      ))}
                  </div>
                </div>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        ) : (
          <Empty
            title={
              completed.length
                ? 'Aucune séance pour cette sélection.'
                : 'Ton histoire reste à écrire.'
            }
          >
            {completed.length
              ? 'Ajuste les filtres ou ta recherche pour retrouver tes séances.'
              : 'Ta première séance terminée apparaîtra ici, avec son programme et ses performances.'}
          </Empty>
        )}
      </section>
      {detail && (
        <Modal title={detail.programName} close={() => setDetail(null)}>
          <p className="muted">
            {new Date(detail.startedAt).toLocaleString('fr-FR')} · PDC {number(detail.bodyweight)}{' '}
            kg
          </p>
          {detail.exercises.map((e) => (
            <section className="history-exercise" key={e.id}>
              <h3>
                {e.definition.name}
                <span className="tag">{e.intent}</span>
              </h3>
              <p>
                {e.result.confirmed ? (
                  <>
                    <strong className="lime">
                      {loadLabel(e.result.load, e.definition.weighted)} · {e.result.sets}×
                      {e.result.reps}
                    </strong>{' '}
                    · RIR {e.result.rir ?? 'non renseigné'}
                  </>
                ) : (
                  'Pic non validé — exclu des statistiques'
                )}
              </p>
              {e.result.comment && <p className="history-comment">{e.result.comment}</p>}
              <details>
                <summary>Prescription conservée à la date de séance</summary>
                <div className="snapshot-blocks">
                  {e.blocks.map((b) => (
                    <div key={b.id}>
                      <span>
                        {b.phase}
                        {b.optional ? ' (facultatif)' : ''}
                      </span>
                      <strong>
                        {b.sets}×{b.reps} · {loadLabel(b.resolvedLoad, e.definition.weighted)}
                      </strong>
                      <small>
                        {e.checked.filter((k) => k.startsWith(b.id + ':')).length}/{b.sets} cochées
                        · {b.rest}s
                      </small>
                    </div>
                  ))}
                </div>
              </details>
            </section>
          ))}
          {detail.skills && <Note>{detail.skills}</Note>}
          <Button
            className="danger"
            onClick={() => {
              if (
                window.confirm(
                  'Supprimer définitivement cette séance du carnet et de la synchronisation ?',
                )
              ) {
                removeRecord(detail.id);
                setDetail(null);
                toast('Séance supprimée.');
              }
            }}
          >
            <Trash2 size={16} />
            Supprimer cette séance
          </Button>
        </Modal>
      )}
    </>
  );
}
