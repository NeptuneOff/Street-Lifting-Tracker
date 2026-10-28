import type { Block, Exercise, Profile, Program, SessionExercise, TrainingSession } from './types';
import { uid } from './seed';

export const number = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n);
export const loadLabel = (load: number, weighted: boolean) =>
  `${weighted && load > 0 ? '+' : ''}${number(load)} kg`;
export const setKey = (blockId: string, index: number) => `${blockId}:${index}`;
export function resolveLoad(
  block: Block,
  exercise: Exercise,
  profile: Profile,
  bodyweight: number,
): number {
  if (block.mode === 'fixed') return block.load;
  const ratio = block.load / 100;
  const raw =
    exercise.weighted && block.percentBasis === 'total'
      ? (bodyweight + exercise.reference) * ratio - bodyweight
      : exercise.reference * ratio;
  return Math.round(raw / profile.increment) * profile.increment;
}
export function startSession(
  program: Program,
  exercises: Exercise[],
  profile: Profile,
  bodyweight: number,
): TrainingSession {
  return {
    id: uid(),
    programId: program.id,
    programName: program.name,
    weekday: program.weekday,
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: 'active',
    bodyweight,
    skills: program.skills,
    exercises: program.exercises.map((planned) => {
      const definition = exercises.find((e) => e.id === planned.exerciseId);
      if (!definition)
        throw new Error('Exercice introuvable. Corrige le programme avant de démarrer.');
      const blocks = planned.blocks.map((b) => ({
        ...b,
        resolvedLoad: resolveLoad(b, definition, profile, bodyweight),
      }));
      const peak =
        blocks.find((b) => b.phase === 'Pic') ?? blocks.find((b) => !b.optional) ?? blocks[0];
      if (!peak) throw new Error('Ajoute au moins un bloc à chaque exercice.');
      return structuredClone({
        ...planned,
        definition,
        blocks,
        checked: [],
        result: {
          load: peak.resolvedLoad,
          sets: peak.sets,
          reps: peak.reps,
          rir: null,
          comment: '',
          confirmed: false,
        },
      });
    }),
  };
}
export function primaryBlock(exercise: SessionExercise) {
  return (
    exercise.blocks.find((b) => b.phase === 'Pic') ??
    exercise.blocks.find((b) => !b.optional) ??
    exercise.blocks[0]
  );
}
export function toggleSet(
  exercise: SessionExercise,
  blockId: string,
  index: number,
): SessionExercise {
  const key = setKey(blockId, index);
  const checked = exercise.checked.includes(key)
    ? exercise.checked.filter((k) => k !== key)
    : [...exercise.checked, key];
  const peak = primaryBlock(exercise);
  const count = checked.filter((k) => k.startsWith(`${peak.id}:`)).length;
  return {
    ...exercise,
    checked,
    result:
      blockId === peak.id
        ? { ...exercise.result, sets: count || peak.sets, confirmed: count > 0 }
        : exercise.result,
  };
}
export function sessionProgress(session: TrainingSession) {
  let total = 0,
    done = 0;
  for (const exercise of session.exercises)
    for (const block of exercise.blocks) {
      if (block.optional) continue;
      total += block.sets;
      for (let i = 0; i < block.sets; i++)
        if (exercise.checked.includes(setKey(block.id, i))) done++;
    }
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}
export function comparableTrend(
  sessions: TrainingSession[],
  exerciseId: string,
): { label: string; delta: number | null } {
  const results = sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .flatMap((s) =>
      s.exercises
        .filter((e) => e.exerciseId === exerciseId && e.result.confirmed)
        .map((e) => ({ session: s, exercise: e })),
    );
  const latest = results.at(-1);
  if (!latest) return { label: 'À construire', delta: null };
  const b = latest.exercise;
  const comparable = results
    .slice(0, -1)
    .filter(
      ({ exercise: a, session }) =>
        a.intent === b.intent &&
        a.result.reps === b.result.reps &&
        a.result.sets === b.result.sets &&
        a.definition.weighted === b.definition.weighted &&
        (!b.definition.weighted ||
          Math.abs(session.bodyweight - latest.session.bodyweight) <= 1.5) &&
        (a.result.rir === null ||
          b.result.rir === null ||
          Math.abs(a.result.rir - b.result.rir) <= 1),
    );
  const previous = comparable.at(-1);
  if (!previous) return { label: 'Données insuffisantes', delta: null };
  const delta = b.result.load - previous.exercise.result.load;
  return {
    label: Math.abs(delta) < 0.5 ? 'Stable' : delta > 0 ? 'En progression' : 'En baisse',
    delta,
  };
}
export function estimated1RM(load: number, reps: number, weighted: boolean, bodyweight: number) {
  if (reps === 1) return load;
  return (load + (weighted ? bodyweight : 0)) * (1 + reps / 30) - (weighted ? bodyweight : 0);
}
export function weeklyWeights(weights: { date: string; kg: number }[]) {
  const groups = new Map<string, number[]>();
  for (const w of weights) {
    const day = new Date(`${w.date}T12:00:00`);
    day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    groups.set(key, [...(groups.get(key) || []), w.kg]);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, kg: values.reduce((a, b) => a + b, 0) / values.length }));
}
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
