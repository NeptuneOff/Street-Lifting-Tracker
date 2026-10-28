import { useState } from 'react';
import { ArrowRight, Check, ChevronDown, ChevronUp, Clock3, Flag, Plus, Minus } from 'lucide-react';
import {
  flush,
  putPayload,
  removeRecord,
  useData,
  getWorkspaceKey,
  assertWorkspace,
} from '../lib/store';
import { DAYS, type SessionExercise, type TrainingSession } from '../lib/types';
import {
  loadLabel,
  number,
  primaryBlock,
  sessionProgress,
  setKey,
  toggleSet,
} from '../lib/training';
import { Button, Empty, IconButton, Note, NumberField, PageTitle, useApp } from '../components/UI';

function ExerciseCard({
  exercise: e,
  index,
  update,
}: {
  exercise: SessionExercise;
  index: number;
  update: (e: SessionExercise) => void;
}) {
  const [open, setOpen] = useState(index === 0);
  const { profile } = useData();
  const { rest } = useApp();
  const peak = primaryBlock(e);
  const done = e.checked.length;
  const total = e.blocks.reduce((sum, b) => sum + b.sets, 0);
  const changeResult = (patch: Partial<SessionExercise['result']>) =>
    update({ ...e, result: { ...e.result, ...patch } });
  return (
    <section className={`exercise-card card ${open ? 'open' : ''}`}>
      <button className="exercise-card-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="exercise-number">{String(index + 1).padStart(2, '0')}</span>
        <span>
          <strong>{e.definition.name}</strong>
          <small>
            {e.intent} · {done}/{total} séries cochées
          </small>
        </span>
        <span className="tag">
          {e.result.confirmed ? (
            <>
              <Check size={13} /> PIC VALIDÉ
            </>
          ) : (
            loadLabel(peak.resolvedLoad, e.definition.weighted)
          )}
        </span>
        {open ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
      </button>
      {open && (
        <div className="exercise-body">
          <div className="block-labels">
            <span>PHASE / RÉPÉTITIONS</span>
            <span>CHARGE · REPOS</span>
          </div>
          {e.blocks.map((block) => (
            <div
              className={`work-block ${block.phase === 'Pic' ? 'peak-block' : ''} ${block.optional ? 'optional-block' : ''}`}
              key={block.id}
            >
              <div className="block-prescription">
                <div>
                  <span className={`phase-label ${block.phase === 'Pic' ? 'lime' : ''}`}>
                    {block.phase}
                    {block.optional && block.phase !== 'Facultatif' ? ' · facultatif' : ''}
                  </span>
                  <strong>
                    {block.sets} <span>×</span> {block.reps}
                    <small> reps</small>
                  </strong>
                </div>
                <div className="block-load">
                  <strong>{loadLabel(block.resolvedLoad, e.definition.weighted)}</strong>
                  <button
                    onClick={() => rest(block.rest)}
                    aria-label={`Repos ${block.rest} secondes`}
                  >
                    <Clock3 size={13} />
                    {number(block.rest / 60)} min
                  </button>
                </div>
              </div>
              <div className="set-buttons">
                {Array.from({ length: block.sets }, (_, i) => {
                  const checked = e.checked.includes(setKey(block.id, i));
                  return (
                    <button
                      type="button"
                      key={i}
                      className={`set-button ${checked ? 'checked' : ''}`}
                      aria-label={`${e.definition.shortName} ${block.phase} série ${i + 1}`}
                      aria-pressed={checked}
                      onClick={() => {
                        update(toggleSet(e, block.id, i));
                        if (!checked && profile?.autoRest && block.rest > 0) rest(block.rest);
                      }}
                    >
                      {checked ? <Check size={18} strokeWidth={3} /> : i + 1}
                      <span>{checked ? 'Fait' : `${block.reps} reps`}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="result-panel">
            <div className="section-head">
              <div>
                <span className="eyebrow">TON PIC RÉALISÉ</span>
                <p>Prérempli. Ajuste seulement si nécessaire.</p>
              </div>
              {e.result.confirmed && <Check size={20} className="lime" />}
            </div>
            <div className="result-fields">
              <NumberField
                label={e.definition.weighted ? 'Lest ajouté (kg)' : 'Charge barre (kg)'}
                value={e.result.load}
                min={-200}
                max={1000}
                onValue={(load) => changeResult({ load })}
              />
              <NumberField
                label="Séries"
                value={e.result.sets}
                min={1}
                max={30}
                step={1}
                onValue={(sets) => changeResult({ sets })}
              />
              <NumberField
                label="Répétitions"
                value={e.result.reps}
                min={1}
                max={100}
                step={1}
                onValue={(reps) => changeResult({ reps })}
              />
            </div>
            <div className="rir-row">
              <span className="small-label">
                RIR <small>· répétitions en réserve</small>
              </span>
              <div className="rir-buttons">
                {[0, 1, 2, 3, 4, 5].map((rir) => (
                  <button
                    className={e.result.rir === rir ? 'selected' : ''}
                    key={rir}
                    aria-label={`RIR ${rir}`}
                    aria-pressed={e.result.rir === rir}
                    onClick={() => changeResult({ rir: e.result.rir === rir ? null : rir })}
                  >
                    {rir === 5 ? '5+' : rir}
                  </button>
                ))}
              </div>
            </div>
            <details className="comment">
              <summary>
                <Plus size={14} /> Ajouter un commentaire{e.result.comment ? ' · renseigné' : ''}
              </summary>
              <textarea
                aria-label={`Commentaire ${e.definition.name}`}
                maxLength={4000}
                placeholder="Fatigue, technique, ressenti…"
                value={e.result.comment}
                onChange={(event) => changeResult({ comment: event.target.value })}
              />
            </details>
            {!e.result.confirmed && (
              <Button
                className="secondary wide"
                onClick={() =>
                  update({
                    ...e,
                    checked: [
                      ...new Set([
                        ...e.checked,
                        ...Array.from({ length: peak.sets }, (_, i) => setKey(peak.id, i)),
                      ]),
                    ],
                    result: { ...e.result, confirmed: true },
                  })
                }
              >
                <Check size={17} /> Valider le pic
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
export function Workout() {
  const { sessions, programs, saving, error } = useData();
  const { start, navigate, toast } = useApp();
  const activeSessions = sessions.filter((s) => s.status === 'active');
  const [chosenId, setChosenId] = useState('');
  const active = activeSessions.find((s) => s.id === chosenId) ?? activeSessions[0];
  const [finishing, setFinishing] = useState(false);
  const update = (session: TrainingSession) => putPayload('session', session);
  if (!active)
    return (
      <>
        <PageTitle eyebrow="LE TERRAIN" title="À toi de jouer." />
        <Note>
          Choisis ta séance. Les charges sont figées au démarrage et les séries sont sauvegardées à
          chaque geste.
        </Note>
        <div className="program-grid">
          {programs.map((p) => (
            <section className="card program-choice" key={p.id}>
              <span className="eyebrow">{DAYS[p.weekday]}</span>
              <h2>{p.name}</h2>
              <p>{p.exercises.length} exercices</p>
              <Button className="primary wide" onClick={() => start(p.id)}>
                Démarrer
                <ArrowRight size={18} />
              </Button>
            </section>
          ))}
        </div>
        {!programs.length && (
          <Empty title="Ajoute ta première séance">
            <button className="text-link" onClick={() => navigate('program')}>
              Créer mon programme
            </button>
          </Empty>
        )}
      </>
    );
  const progress = sessionProgress(active);
  const finish = async () => {
    if (finishing) return;
    const invalid = active.exercises.some(
      (e) =>
        e.result.load < -200 ||
        e.result.load > 1000 ||
        !Number.isInteger(e.result.sets) ||
        e.result.sets < 1 ||
        e.result.sets > 30 ||
        !Number.isInteger(e.result.reps) ||
        e.result.reps < 1 ||
        e.result.reps > 100,
    );
    if (invalid)
      return toast('Vérifie les charges, les séries (1–30) et les répétitions (1–100) du pic.');
    if (
      !window.confirm(
        progress.done < progress.total
          ? `Terminer avec ${progress.done}/${progress.total} séries obligatoires cochées ? Seuls les pics validés seront utilisés dans les statistiques.`
          : 'Enregistrer cette séance dans ton historique ?',
      )
    )
      return;
    setFinishing(true);
    const scope = getWorkspaceKey()!;
    try {
      await flush();
      assertWorkspace(scope);
      update({ ...active, status: 'completed', endedAt: new Date().toISOString() });
      await flush();
      assertWorkspace(scope);
      toast('Séance enregistrée. Le travail est fait.');
      navigate('progress');
    } catch {
      if (getWorkspaceKey() !== scope) return;
      toast('Enregistrement impossible. Exporte les données depuis les paramètres.');
    } finally {
      setFinishing(false);
    }
  };
  return (
    <>
      <PageTitle eyebrow={`${DAYS[active.weekday]} · EN COURS`} title={active.programName}>
        <span className="tag">
          <span className="pulse" />
          {saving ? 'SAUVEGARDE…' : error ? 'ERREUR DE SAUVEGARDE' : 'SAUVEGARDÉ EN LOCAL'}
        </span>
      </PageTitle>
      {activeSessions.length > 1 && (
        <label className="field">
          Plusieurs séances en cours
          <select value={active.id} onChange={(e) => setChosenId(e.target.value)}>
            {activeSessions.map((s) => (
              <option value={s.id} key={s.id}>
                {s.programName} · {new Date(s.startedAt).toLocaleDateString('fr-FR')}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="workout-progress card">
        <div>
          <span className="small-label">SÉRIES OBLIGATOIRES</span>
          <strong>
            {progress.done}
            <small> / {progress.total}</small>
          </strong>
        </div>
        <div className="progress-track">
          <i style={{ width: `${progress.percent}%` }} />
        </div>
        <span>{progress.percent}%</span>
      </div>
      <div className="workout-list">
        {active.exercises.map((exercise, index) => (
          <ExerciseCard
            key={`${active.id}:${exercise.id}`}
            exercise={exercise}
            index={index}
            update={(e) =>
              update({
                ...active,
                exercises: active.exercises.map((old) => (old.id === e.id ? e : old)),
              })
            }
          />
        ))}
      </div>
      {active.skills && <Note>{active.skills}. Aucun suivi imposé.</Note>}
      <div className="finish-session">
        <Button className="primary" disabled={finishing || !!error} onClick={() => void finish()}>
          <Flag size={18} />
          {finishing ? 'Enregistrement…' : 'Terminer la séance'}
        </Button>
        <button
          className="text-link muted"
          onClick={() => {
            if (window.confirm('Abandonner cette séance et ses séries cochées ?')) {
              removeRecord(active.id);
              toast('Séance abandonnée.');
            }
          }}
        >
          <Minus size={14} /> Abandonner
        </button>
      </div>
      <p className="footnote">
        Tu peux fermer l’application une fois la sauvegarde terminée. Le programme en cours
        conservera ses charges même après une modification des références.
      </p>
    </>
  );
}
