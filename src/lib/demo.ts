import { seedRecords, uid } from './seed';
import { localDate, primaryBlock, setKey, startSession } from './training';
import type { DataRecord, Exercise, Profile, Program, TrainingSession, Weight } from './types';

const round = (value: number) => Math.round(value / 2.5) * 2.5;
const bodyweight = (week: number, day: number) =>
  Math.round((78.7 - week * 0.18 + Math.sin(week * 2 + day) * 0.14) * 10) / 10;
const topLoads: Record<string, Record<string, [number, number]>> = {
  monday: { pullup: [50, 65], dip: [55, 75], muscleup: [0, 5] },
  tuesday: { squat: [65, 87.5] },
  thursday: { muscleup: [5, 12.5], pullup: [35, 52.5], squat: [50, 65] },
  saturday: { dip: [75, 95], squat: [55, 75] },
};
function weeklyProgram(base: Program, week: number): Program {
  const program = structuredClone(base);
  const deload = week === 4 || week === 8;
  for (const e of program.exercises) {
    const original = e.blocks.find((b) => b.phase === 'Pic') ?? e.blocks[0];
    const [from, to] = topLoads[base.id][e.exerciseId];
    let load = round(from + ((to - from) * Math.min(week, 12)) / 12);
    if (deload) {
      load = round(load * 0.65);
      e.intent = 'Technique';
    }
    const ratio = original.load > 0 ? load / original.load : 1;
    e.blocks = e.blocks.map((b) => ({
      ...b,
      load:
        b.phase === 'Pic'
          ? load
          : Math.max(e.exerciseId === 'squat' ? 20 : 0, round(b.load * ratio)),
      mode: 'fixed',
    }));
  }
  return program;
}
const DEMO_COMMENTS = [
  'Bonne vitesse sur le pic, technique propre.',
  'Un peu de fatigue, volume maintenu sans forcer.',
  'Sensation solide. Même charge, meilleur contrôle.',
  'Concentration sur l’amplitude et les pauses.',
];
function finish(session: TrainingSession, date: Date, week: number, benchmark: boolean) {
  session.id = `demo-session-${localDate(date)}-${session.programId}`;
  session.startedAt = date.toISOString();
  session.endedAt = new Date(date.getTime() + (benchmark ? 100 : 75) * 60000).toISOString();
  session.status = 'completed';
  session.exercises.forEach((e, index) => {
    const peak = primaryBlock(e);
    e.checked = e.blocks.flatMap((b) =>
      b.optional ? [] : Array.from({ length: b.sets }, (_, i) => setKey(b.id, i)),
    );
    e.result = {
      load: peak.resolvedLoad,
      sets: peak.sets,
      reps: peak.reps,
      rir: benchmark ? 1 : week === 4 || week === 8 ? 5 : 2 + (index % 2),
      comment:
        index === 0
          ? benchmark
            ? 'Bilan du cycle : single propre, sans échec.'
            : DEMO_COMMENTS[week % DEMO_COMMENTS.length]
          : '',
      confirmed: true,
    };
    if (week === 9 && index === 1 && !benchmark) {
      const volume = e.blocks.find((b) => b.phase === 'Volume');
      if (volume) e.checked = e.checked.filter((key) => key !== setKey(volume.id, volume.sets - 1));
      e.result.comment = 'Dernière série de volume écourtée : fatigue.';
    }
  });
}
/** Entirely fictional, relative-date history. Never used to initialize a private account. */
export function seedDemoRecords(now = new Date()): DataRecord[] {
  const records = seedRecords({ name: 'Alex', blank: false });
  const profile = records.find((r) => r.kind === 'profile')!.payload as Profile;
  profile.bodyweight = 76.5;
  const exercises = records.filter((r) => r.kind === 'exercise').map((r) => r.payload as Exercise);
  const templates = records.filter((r) => r.kind === 'program').map((r) => r.payload as Program);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - 12 * 7);
  const add = (kind: DataRecord['kind'], payload: DataRecord['payload']) =>
    records.push({
      id: payload.id,
      kind,
      payload,
      version: uid(),
      baseVersion: null,
      updatedAt: now.toISOString(),
      deleted: false,
      dirty: false,
      seeded: true,
    });
  for (let week = 0; week <= 12; week++) {
    for (const day of [0, 2, 5]) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + week * 7 + day);
      if (date > today) continue;
      const weight: Weight = {
        id: `demo-weight-${localDate(date)}`,
        date: localDate(date),
        kg: bodyweight(week, day),
      };
      add('weight', weight);
    }
    for (const template of templates) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + week * 7 + ((template.weekday + 6) % 7));
      date.setHours(18, 0, 0, 0);
      if (date >= today) continue; // Completed sessions stop yesterday; never invent a future result.
      let program = weeklyProgram(template, week);
      const benchmark = template.id === 'saturday' && [3, 7, 11].includes(week);
      if (benchmark) {
        const cycle = [3, 7, 11].indexOf(week);
        const loads: Record<string, number[]> = {
          pullup: [70, 75, 80],
          dip: [100, 105, 110],
          muscleup: [15, 17.5, 20],
          squat: [105, 110, 115],
        };
        program = {
          id: `demo-benchmark-${week}`,
          name: `Bilan mensuel · S${week + 1}`,
          weekday: 6,
          skills: '',
          exercises: exercises.map((definition) => {
            const source = templates
              .flatMap((p) => p.exercises)
              .find((e) => e.exerciseId === definition.id)!;
            const e = structuredClone(source);
            e.id = uid();
            e.intent = 'Force';
            e.blocks = e.blocks
              .filter((b) => ['Échauffement', 'Montée', 'Pic'].includes(b.phase))
              .map((b) => ({
                ...b,
                id: uid(),
                sets: 1,
                reps: b.phase === 'Pic' ? 1 : 3,
                load:
                  b.phase === 'Pic'
                    ? loads[definition.id][cycle]
                    : round(loads[definition.id][cycle] * 0.5),
              }));
            return e;
          }),
        };
      }
      const session = startSession(
        program,
        exercises,
        profile,
        bodyweight(week, (template.weekday + 6) % 7),
      );
      finish(session, date, week, benchmark);
      add('session', session);
    }
  }
  // The editable program is the current prescription; historical snapshots stay untouched.
  records
    .filter((r) => r.kind === 'program')
    .forEach((r) => {
      r.payload = weeklyProgram(r.payload as Program, 12);
    });
  records.forEach((r) => {
    r.dirty = false;
  });
  return records;
}
