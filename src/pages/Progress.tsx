import { useState } from 'react';
import { ArrowUpRight, ChevronRight, Trophy, Trash2 } from 'lucide-react';
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
  const [months, setMonths] = useState(3),
    [intent, setIntent] = useState('Toutes'),
    [reps, setReps] = useState('Toutes'),
    [metric, setMetric] = useState('load');
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
          (reps === 'Toutes' || e.result.reps === Number(reps)),
      )
      .map((e) => ({ s, e })),
  );
  const lastWeight = weights.at(-1)?.kg ?? profile!.bodyweight;
  const weekly = weeklyWeights(weights);
  const filteredWeights = weights.filter(
    (w) => months === 0 || new Date(`${w.date}T12:00:00`) >= cutoff,
  );
  return (
    <>
      <PageTitle eyebrow="LE TRAVAIL LAISSE UNE TRACE" title="Ta progression, en clair.">
        <span className="tag">
          {completed.length} SÉANCE{completed.length !== 1 ? 'S' : ''} AU COMPTEUR
        </span>
      </PageTitle>
      <div className="progress-filters">
        <div className="segmented" aria-label="Période">
          {[1, 3, 6, 0].map((m) => (
            <button key={m} className={months === m ? 'selected' : ''} onClick={() => setMonths(m)}>
              {m === 0 ? 'Tout' : `${m} mois`}
            </button>
          ))}
        </div>
        <div className="filter-selects">
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
          <select
            aria-label="Mesure du graphique"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            <option value="load">Charges réalisées</option>
            <option value="e1rm">1RM estimé</option>
          </select>
        </div>
      </div>
      <div className="charts-grid">
        {exercises.map((exercise) => {
          const points = matches.filter(
            ({ e }) => e.exerciseId === exercise.id && (metric !== 'e1rm' || e.result.reps <= 10),
          );
          const groups = new Map<string, ChartSeries>();
          for (const { s, e } of points) {
            const name = `${e.intent} · ${e.result.sets}×${e.result.reps} · ${e.definition.weighted ? 'lest' : 'barre'}`;
            const group = groups.get(name) ?? { name, points: [] };
            group.points.push({
              date: s.startedAt,
              value:
                metric === 'e1rm'
                  ? estimated1RM(e.result.load, e.result.reps, e.definition.weighted, s.bodyweight)
                  : e.result.load,
              label: `RIR ${e.result.rir ?? 'non renseigné'} · PDC ${number(s.bodyweight)} kg`,
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
                    {exercise.weighted ? 'LEST AJOUTÉ' : 'CHARGE BARRE'}
                  </span>
                  <h2>{exercise.shortName}</h2>
                </div>
                <span
                  className={`trend ${trend.delta !== null && trend.delta > 0 ? 'positive' : ''}`}
                >
                  {trend.delta !== null && trend.delta > 0 && <ArrowUpRight size={14} />}{' '}
                  {trend.label}
                </span>
              </div>
              <div className="chart-current">
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
                <small> kg{metric === 'e1rm' ? ' estimés' : ''}</small>
              </div>
              <Chart series={[...groups.values()]} title={`Évolution ${exercise.name}`} />
              <div className="chart-record">
                <Trophy size={15} />
                {best ? (
                  <span>
                    Meilleur single du carnet :{' '}
                    <strong>{loadLabel(best.e.result.load, best.e.definition.weighted)}</strong> ·{' '}
                    {new Date(best.s.startedAt).toLocaleDateString('fr-FR')}
                    {previousBest
                      ? ` · +${number(best.e.result.load - previousBest.e.result.load)} kg vs précédent record du carnet`
                      : ''}
                  </span>
                ) : (
                  <span>
                    Référence : <strong>{loadLabel(exercise.reference, exercise.weighted)}</strong>{' '}
                    · {exercise.reliability.toLowerCase()} · date non renseignée
                  </span>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <Note>
        {metric === 'e1rm'
          ? 'Estimation d’Epley (1 à 10 reps), calculée sur la résistance totale pour les exercices lestés, puis exprimée en lest équivalent. Elle ne constitue pas un record réalisé.'
          : 'Chaque courbe sépare le type de travail et le format séries × reps. La tendance compare les deux derniers pics comparables : même format et type, RIR proche si renseigné, poids de corps à ±1,5 kg pour les exercices lestés.'}
      </Note>
      <section className="card weight-card">
        <div className="section-head">
          <div>
            <span className="eyebrow">POIDS & CATÉGORIE</span>
            <h2>Garder le cap.</h2>
          </div>
          <Button className="secondary" onClick={() => navigate('settings')}>
            Ajouter une pesée
          </Button>
        </div>
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
            title="Évolution du poids de corps"
            series={[
              {
                name: 'Pesées',
                points: filteredWeights.map((w) => ({ date: `${w.date}T12:00:00`, value: w.kg })),
              },
              {
                name: 'Moyennes hebdomadaires',
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
      <div className="section-head bottom-heading">
        <h2>L’historique</h2>
        <span className="small muted">
          {filtered.length} séance{filtered.length !== 1 ? 's' : ''} sur la période
        </span>
      </div>
      {filtered.length ? (
        <div className="history-list">
          {[...filtered].reverse().map((s) => (
            <button className="history-row card" key={s.id} onClick={() => setDetail(s)}>
              <div className="history-date">
                <strong>{new Date(s.startedAt).getDate()}</strong>
                <span>{new Date(s.startedAt).toLocaleDateString('fr-FR', { month: 'short' })}</span>
              </div>
              <div className="history-main">
                <strong>{s.programName}</strong>
                <span>
                  {DAYS[s.weekday]} · {s.exercises.filter((e) => e.result.confirmed).length} pic(s)
                  validé(s) · {sessionProgress(s).percent}% des séries obligatoires
                </span>
              </div>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      ) : (
        <Empty title="Ton histoire reste à écrire.">
          Ta première séance terminée apparaîtra ici, avec son programme et ses performances.
        </Empty>
      )}
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
