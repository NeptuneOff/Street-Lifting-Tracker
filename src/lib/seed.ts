import type { Block, DataRecord, Exercise, PlannedExercise, Profile, Program } from './types';

export const uid = () => crypto.randomUUID();
export const referenceExercises: Exercise[] = [
  {
    id: 'pullup',
    name: 'Traction lestée',
    shortName: 'Traction',
    weighted: true,
    reference: 80,
    reliability: 'Record réalisé',
  },
  {
    id: 'dip',
    name: 'Dips lestés',
    shortName: 'Dips',
    weighted: true,
    reference: 110,
    reliability: 'Record réalisé',
  },
  {
    id: 'muscleup',
    name: 'Muscle-up lesté',
    shortName: 'Muscle-up',
    weighted: true,
    reference: 20,
    reliability: 'À revalider',
  },
  {
    id: 'squat',
    name: 'Squat',
    shortName: 'Squat',
    weighted: false,
    reference: 105,
    reliability: 'Estimation',
  },
];
const block = (
  phase: Block['phase'],
  sets: number,
  reps: number,
  load: number,
  rest: number,
): Block => ({
  id: uid(),
  phase,
  sets,
  reps,
  load,
  rest,
  mode: 'fixed',
  percentBasis: 'total',
  optional: phase === 'Facultatif',
});
const exercise = (
  exerciseId: string,
  peak: number,
  intent: PlannedExercise['intent'] = 'Force',
  sets = 3,
  reps = 3,
): PlannedExercise => ({
  id: uid(),
  exerciseId,
  intent,
  blocks: [
    block('Échauffement', 1, 8, exerciseId === 'squat' ? 20 : 0, 90),
    block('Montée', 1, 3, Math.round((peak * 0.5) / 2.5) * 2.5, 180),
    block('Montée', 1, 3, Math.round((peak * 0.75) / 2.5) * 2.5, 180),
    block('Pic', sets, reps, peak, 300),
    block('Volume', 3, 8, Math.round((peak * 0.65) / 2.5) * 2.5, 240),
  ],
});
export function seedRecords(options?: { name: string; blank: boolean }): DataRecord[] {
  const profile: Profile = {
    id: 'profile',
    name: options?.name || 'Athlète',
    bodyweight: options?.blank ? 75 : 76.5,
    category: 80,
    increment: 2.5,
    autoRest: true,
    sound: true,
  };
  const tuesday = exercise('squat', 80);
  tuesday.blocks = [
    block('Montée', 1, 3, 40, 180),
    block('Montée', 1, 3, 60, 180),
    block('Pic', 3, 3, 80, 300),
    block('Volume', 3, 8, 60, 240),
    block('Facultatif', 2, 10, 50, 240),
  ];
  const programs: Program[] = [
    {
      id: 'monday',
      weekday: 1,
      name: 'Pull focus',
      exercises: [
        exercise('pullup', 65),
        exercise('dip', 75, 'Volume', 3, 5),
        exercise('muscleup', 5, 'Technique', 3, 3),
      ],
      skills: '',
    },
    {
      id: 'tuesday',
      weekday: 2,
      name: 'Squat & statiques',
      exercises: [tuesday],
      skills: 'Planche · Front lever — au ressenti',
    },
    {
      id: 'thursday',
      weekday: 4,
      name: 'Muscle-up focus',
      exercises: [
        exercise('muscleup', 10),
        exercise('pullup', 50, 'Force', 2, 3),
        exercise('squat', 65, 'Technique', 3, 5),
      ],
      skills: '',
    },
    {
      id: 'saturday',
      weekday: 6,
      name: 'Push focus',
      exercises: [exercise('dip', 90), exercise('squat', 70, 'Volume', 3, 5)],
      skills: 'Planche — au ressenti',
    },
  ];
  const definitions = referenceExercises.map((e) =>
    options?.blank ? { ...e, reference: 0, reliability: 'Estimation' as const } : { ...e },
  );
  if (options?.blank)
    for (const program of programs)
      for (const planned of program.exercises) {
        planned.blocks = planned.blocks.map((b) => ({
          ...b,
          load: planned.exerciseId === 'squat' ? 20 : 0,
        }));
      }
  return [
    { kind: 'profile' as const, payload: profile },
    ...definitions.map((payload) => ({ kind: 'exercise' as const, payload })),
    ...programs.map((payload) => ({ kind: 'program' as const, payload })),
  ].map(({ kind, payload }) => ({
    id: payload.id,
    kind,
    payload,
    version: uid(),
    baseVersion: null,
    updatedAt: new Date().toISOString(),
    deleted: false,
    dirty: true,
    seeded: true,
  }));
}
