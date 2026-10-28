import { useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Plus, Save, Trash2 } from 'lucide-react';
import {
  assertWorkspace,
  flush,
  getState,
  getWorkspaceKey,
  putPayload,
  removeRecord,
  useData,
} from '../lib/store';
import { uid } from '../lib/seed';
import { DAYS, PHASES, type Block, type Program as ProgramType } from '../lib/types';
import { loadLabel, resolveLoad } from '../lib/training';
import { validatePayload } from '../lib/backup';
import { Button, IconButton, Modal, Note, NumberField, PageTitle, useApp } from '../components/UI';

const defaultBlock = (): Block => ({
  id: uid(),
  phase: 'Pic',
  sets: 3,
  reps: 3,
  mode: 'fixed',
  load: 0,
  percentBasis: 'total',
  rest: 180,
  optional: false,
});
function cloneProgram(program: ProgramType): ProgramType {
  return {
    ...structuredClone(program),
    id: uid(),
    name: `${program.name} (copie)`,
    exercises: program.exercises.map((e) => ({
      ...e,
      id: uid(),
      blocks: e.blocks.map((b) => ({ ...b, id: uid() })),
    })),
  };
}
export function Program() {
  const { programs, exercises, profile, weights } = useData();
  const { toast } = useApp();
  const [draft, setDraft] = useState<ProgramType | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openedVersion, setOpenedVersion] = useState<string | null>(null);
  const [newExerciseId, setNewExerciseId] = useState(exercises[0]?.id || '');
  const edit = (program: ProgramType) => {
    setOpenedVersion(getState().records.find((r) => r.id === program.id)?.version ?? null);
    setDraft(structuredClone(program));
    setDirty(false);
  };
  const change = (patch: Partial<ProgramType>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  };
  const close = () => {
    if (!dirty || window.confirm('Fermer sans enregistrer les modifications du programme ?'))
      setDraft(null);
  };
  const updateExercise = (id: string, patch: Partial<ProgramType['exercises'][number]>) =>
    change({ exercises: draft!.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const moveExercise = (index: number, direction: number) => {
    const list = [...draft!.exercises];
    [list[index], list[index + direction]] = [list[index + direction], list[index]];
    change({ exercises: list });
  };
  return (
    <>
      <PageTitle eyebrow="TA FEUILLE DE ROUTE" title="Un programme qui évolue.">
        <Button
          className="primary"
          onClick={() =>
            edit({
              id: uid(),
              name: 'Nouvelle séance',
              weekday: 1,
              exercises: [
                {
                  id: uid(),
                  exerciseId: exercises[0].id,
                  intent: 'Force',
                  blocks: [defaultBlock()],
                },
              ],
              skills: '',
            })
          }
        >
          <Plus size={17} /> Ajouter une séance
        </Button>
      </PageTitle>
      <Note>
        Modifie librement les jours, les exercices et les charges. Une séance déjà démarrée ou
        terminée conserve sa prescription d’origine.
      </Note>
      <div className="program-grid">
        {programs.map((p) => (
          <section className="card program-choice" key={p.id}>
            <div className="section-head">
              <span className="eyebrow">{DAYS[p.weekday]}</span>
              <IconButton
                label={`Dupliquer ${p.name}`}
                onClick={() => {
                  setOpenedVersion(null);
                  setDraft(cloneProgram(p));
                  setDirty(true);
                }}
              >
                <Copy size={17} />
              </IconButton>
            </div>
            <h2>{p.name}</h2>
            <div className="program-exercises">
              {p.exercises.map((e) => {
                const definition = exercises.find((x) => x.id === e.exerciseId);
                const block = e.blocks.find((b) => b.phase === 'Pic') || e.blocks[0];
                return (
                  <div key={e.id}>
                    <span>{definition?.shortName ?? 'Exercice'}</span>
                    <strong>
                      {definition
                        ? loadLabel(
                            resolveLoad(
                              block,
                              definition,
                              profile!,
                              weights.at(-1)?.kg ?? profile!.bodyweight,
                            ),
                            definition.weighted,
                          )
                        : '—'}
                    </strong>
                  </div>
                );
              })}
            </div>
            {p.skills && <p className="small muted">{p.skills}</p>}
            <Button className="secondary wide" onClick={() => edit(p)}>
              Modifier la séance
            </Button>
          </section>
        ))}
      </div>
      <p className="footnote">
        Les séances initiales sont une base de départ. Le fichier Excel d’origine peut être converti
        via le modèle CSV disponible dans les paramètres.
      </p>
      {draft && (
        <Modal title="Éditer le programme" close={close}>
          <form
            aria-busy={saving}
            inert={saving}
            onSubmit={async (event) => {
              event.preventDefault();
              if (saving) return;
              if (!validatePayload('program', draft))
                return toast('Vérifie les valeurs et ajoute au moins un exercice avec un bloc.');
              if (
                openedVersion &&
                getState().records.find((r) => r.id === draft.id)?.version !== openedVersion &&
                !window.confirm(
                  'Ce programme a changé depuis l’ouverture de l’éditeur. Remplacer sa version actuelle par tes modifications ?',
                )
              )
                return;
              const scope = getWorkspaceKey()!;
              setSaving(true);
              try {
                putPayload('program', draft);
                await flush();
                assertWorkspace(scope);
                setDraft((current) => (current?.id === draft.id ? null : current));
                toast('Programme enregistré. Tes anciennes séances restent intactes.');
              } catch {
                if (getWorkspaceKey() === scope)
                  toast('Sauvegarde locale incomplète. Réessaie avant de fermer.');
              } finally {
                if (getWorkspaceKey() === scope) setSaving(false);
              }
            }}
          >
            <div className="form-row">
              <label className="field">
                <span>Nom de la séance</span>
                <input
                  required
                  maxLength={100}
                  value={draft.name}
                  onChange={(e) => change({ name: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Jour</span>
                <select
                  value={draft.weekday}
                  onChange={(e) => change({ weekday: Number(e.target.value) })}
                >
                  {DAYS.map((day, i) => (
                    <option key={day} value={i}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {draft.exercises.map((exercise, index) => (
              <section className="editor-exercise" key={exercise.id}>
                <div className="section-head">
                  <h3>
                    {String(index + 1).padStart(2, '0')} ·{' '}
                    {exercises.find((e) => e.id === exercise.exerciseId)?.name}
                  </h3>
                  <div className="actions">
                    <IconButton
                      label="Monter l’exercice"
                      disabled={index === 0}
                      onClick={() => moveExercise(index, -1)}
                    >
                      <ArrowUp size={16} />
                    </IconButton>
                    <IconButton
                      label="Descendre l’exercice"
                      disabled={index === draft.exercises.length - 1}
                      onClick={() => moveExercise(index, 1)}
                    >
                      <ArrowDown size={16} />
                    </IconButton>
                    <IconButton
                      label="Dupliquer l’exercice"
                      onClick={() =>
                        change({
                          exercises: [
                            ...draft.exercises,
                            {
                              ...structuredClone(exercise),
                              id: uid(),
                              blocks: exercise.blocks.map((b) => ({ ...b, id: uid() })),
                            },
                          ],
                        })
                      }
                    >
                      <Copy size={16} />
                    </IconButton>
                    <IconButton
                      label="Supprimer l’exercice du programme"
                      onClick={() =>
                        change({ exercises: draft.exercises.filter((e) => e.id !== exercise.id) })
                      }
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </div>
                <div className="form-row">
                  <label className="field">
                    <span>Exercice</span>
                    <select
                      value={exercise.exerciseId}
                      onChange={(event) =>
                        updateExercise(exercise.id, { exerciseId: event.target.value })
                      }
                    >
                      {exercises.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Type de travail</span>
                    <select
                      value={exercise.intent}
                      onChange={(event) =>
                        updateExercise(exercise.id, {
                          intent: event.target.value as typeof exercise.intent,
                        })
                      }
                    >
                      {['Force', 'Volume', 'Technique'].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {exercise.blocks.map((block, blockIndex) => {
                  const updateBlock = (patch: Partial<Block>) =>
                    updateExercise(exercise.id, {
                      blocks: exercise.blocks.map((b) =>
                        b.id === block.id ? { ...b, ...patch } : b,
                      ),
                    });
                  return (
                    <div className="editor-block" key={block.id}>
                      <div className="section-head">
                        <span className="small-label">BLOC {blockIndex + 1}</span>
                        <div className="actions">
                          <IconButton
                            label="Monter le bloc"
                            disabled={blockIndex === 0}
                            onClick={() => {
                              const list = [...exercise.blocks];
                              [list[blockIndex - 1], list[blockIndex]] = [
                                list[blockIndex],
                                list[blockIndex - 1],
                              ];
                              updateExercise(exercise.id, { blocks: list });
                            }}
                          >
                            <ArrowUp size={14} />
                          </IconButton>
                          <IconButton
                            label="Descendre le bloc"
                            disabled={blockIndex === exercise.blocks.length - 1}
                            onClick={() => {
                              const list = [...exercise.blocks];
                              [list[blockIndex + 1], list[blockIndex]] = [
                                list[blockIndex],
                                list[blockIndex + 1],
                              ];
                              updateExercise(exercise.id, { blocks: list });
                            }}
                          >
                            <ArrowDown size={14} />
                          </IconButton>
                          <IconButton
                            label="Dupliquer le bloc"
                            onClick={() =>
                              updateExercise(exercise.id, {
                                blocks: [...exercise.blocks, { ...block, id: uid() }],
                              })
                            }
                          >
                            <Copy size={14} />
                          </IconButton>
                          <IconButton
                            label="Retirer le bloc"
                            onClick={() =>
                              updateExercise(exercise.id, {
                                blocks: exercise.blocks.filter((b) => b.id !== block.id),
                              })
                            }
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </div>
                      </div>
                      <div className="editor-block-fields">
                        <label className="field">
                          <span>Phase</span>
                          <select
                            value={block.phase}
                            onChange={(e) =>
                              updateBlock({
                                phase: e.target.value as Block['phase'],
                                optional: e.target.value === 'Facultatif' || block.optional,
                              })
                            }
                          >
                            {PHASES.map((phase) => (
                              <option key={phase}>{phase}</option>
                            ))}
                          </select>
                        </label>
                        <NumberField
                          label="Séries"
                          value={block.sets}
                          min={1}
                          max={30}
                          step={1}
                          onValue={(sets) => updateBlock({ sets })}
                        />
                        <NumberField
                          label="Reps"
                          value={block.reps}
                          min={1}
                          max={100}
                          step={1}
                          onValue={(reps) => updateBlock({ reps })}
                        />
                        <label className="field">
                          <span>Charge</span>
                          <select
                            value={block.mode}
                            onChange={(e) =>
                              updateBlock({
                                mode: e.target.value as Block['mode'],
                                load: e.target.value === 'percent' ? 75 : 0,
                              })
                            }
                          >
                            <option value="fixed">Fixe · kg</option>
                            <option value="percent">% du 1RM</option>
                          </select>
                        </label>
                        <NumberField
                          label={block.mode === 'percent' ? 'Intensité (%)' : 'Charge (kg)'}
                          value={block.load}
                          min={block.mode === 'percent' ? 0 : -200}
                          max={block.mode === 'percent' ? 200 : 1000}
                          onValue={(load) => updateBlock({ load })}
                        />
                        <NumberField
                          label="Repos (sec)"
                          value={block.rest}
                          min={0}
                          max={3600}
                          step={1}
                          onValue={(rest) => updateBlock({ rest })}
                        />
                      </div>
                      <div className="block-options">
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={block.optional}
                            onChange={(e) => updateBlock({ optional: e.target.checked })}
                          />{' '}
                          Séries facultatives
                        </label>
                        {block.mode === 'percent' &&
                          exercises.find((e) => e.id === exercise.exerciseId)?.weighted && (
                            <label className="field">
                              <span>Base du pourcentage</span>
                              <select
                                value={block.percentBasis}
                                onChange={(e) =>
                                  updateBlock({
                                    percentBasis: e.target.value as Block['percentBasis'],
                                  })
                                }
                              >
                                <option value="total">Poids de corps + lest</option>
                                <option value="added">Lest seul</option>
                              </select>
                            </label>
                          )}
                      </div>
                    </div>
                  );
                })}
                <Button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    updateExercise(exercise.id, { blocks: [...exercise.blocks, defaultBlock()] })
                  }
                >
                  <Plus size={15} /> Ajouter un bloc
                </Button>
              </section>
            ))}
            <div className="add-exercise">
              <select
                aria-label="Exercice à ajouter"
                value={newExerciseId}
                onChange={(e) => setNewExerciseId(e.target.value)}
              >
                {exercises.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                className="secondary"
                onClick={() =>
                  change({
                    exercises: [
                      ...draft.exercises,
                      {
                        id: uid(),
                        exerciseId: newExerciseId,
                        intent: 'Force',
                        blocks: [defaultBlock()],
                      },
                    ],
                  })
                }
              >
                <Plus size={15} /> Ajouter l’exercice
              </Button>
            </div>
            <label className="field">
              <span>Statiques / note libre (facultatif)</span>
              <input
                value={draft.skills}
                maxLength={1000}
                onChange={(e) => change({ skills: e.target.value })}
                placeholder="Planche, Front lever… au ressenti"
              />
            </label>
            <Note>
              Un pourcentage de résistance totale peut donner un lest négatif : il représente alors
              une assistance. Les pourcentages sont arrondis avec l’incrément de tes paramètres.
            </Note>
            <div className="modal-footer">
              <Button type="submit" className="primary" disabled={saving}>
                <Save size={17} />
                {saving ? 'Enregistrement…' : 'Enregistrer le programme'}
              </Button>
              {programs.some((p) => p.id === draft.id) && (
                <Button
                  type="button"
                  className="danger"
                  onClick={() => {
                    if (window.confirm('Supprimer ce programme ? L’historique sera conservé.')) {
                      removeRecord(draft.id);
                      setDraft(null);
                      toast('Programme supprimé.');
                    }
                  }}
                >
                  <Trash2 size={16} />
                  Supprimer
                </Button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
