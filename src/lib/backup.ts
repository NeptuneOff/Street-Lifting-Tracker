import type { Block, DataRecord, Kind, Payload, PlannedExercise, Program } from './types';
import { DAYS, PHASES } from './types';
import { uid } from './seed';

const kinds: Kind[] = ['profile', 'exercise', 'program', 'session', 'weight'];
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = 1000): v is string => typeof v === 'string' && v.length <= max;
const num = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const integer = (v: unknown, min: number, max: number) => num(v, min, max) && Number.isInteger(v);
const validDate = (v: unknown) => str(v, 50) && !Number.isNaN(Date.parse(v));
const validExercise = (p: Record<string, unknown>) =>
  str(p.name, 80) &&
  !!p.name.trim() &&
  str(p.shortName, 40) &&
  typeof p.weighted === 'boolean' &&
  num(p.reference, 0, 1000) &&
  ['Record réalisé', 'Estimation', 'À revalider'].includes(String(p.reliability));
function validBlock(p: unknown, resolved = false) {
  return (
    object(p) &&
    str(p.id, 100) &&
    PHASES.includes(p.phase as Block['phase']) &&
    integer(p.sets, 1, 30) &&
    integer(p.reps, 1, 100) &&
    ['fixed', 'percent'].includes(String(p.mode)) &&
    num(p.load, p.mode === 'percent' ? 0 : -200, p.mode === 'percent' ? 200 : 1000) &&
    ['total', 'added'].includes(String(p.percentBasis)) &&
    integer(p.rest, 0, 3600) &&
    typeof p.optional === 'boolean' &&
    (!resolved || num(p.resolvedLoad, -200, 1000))
  );
}
function validPlanned(p: unknown, resolved = false) {
  if (
    !object(p) ||
    !str(p.id, 100) ||
    !str(p.exerciseId, 100) ||
    !['Force', 'Volume', 'Technique'].includes(String(p.intent)) ||
    !Array.isArray(p.blocks) ||
    p.blocks.length < 1 ||
    p.blocks.length > 30 ||
    !p.blocks.every((b) => validBlock(b, resolved))
  )
    return false;
  if (!resolved) return true;
  const r = p.result;
  return (
    object(p.definition) &&
    validExercise(p.definition) &&
    Array.isArray(p.checked) &&
    p.checked.every((k) => str(k, 150)) &&
    object(r) &&
    num(r.load, -200, 1000) &&
    integer(r.sets, 1, 30) &&
    integer(r.reps, 1, 100) &&
    (r.rir === null || num(r.rir, 0, 10)) &&
    str(r.comment, 4000) &&
    typeof r.confirmed === 'boolean'
  );
}
export function validatePayload(kind: Kind, payload: unknown): payload is Payload {
  if (!object(payload) || !str(payload.id, 100) || !payload.id) return false;
  const p = payload;
  if (kind === 'exercise') return validExercise(p);
  if (kind === 'profile')
    return (
      p.id === 'profile' &&
      str(p.name, 50) &&
      num(p.bodyweight, 20, 350) &&
      num(p.category, 20, 350) &&
      num(p.increment, 0.25, 20) &&
      typeof p.autoRest === 'boolean' &&
      typeof p.sound === 'boolean'
    );
  if (kind === 'weight')
    return (
      str(p.date, 10) &&
      /^\d{4}-\d{2}-\d{2}$/.test(p.date) &&
      validDate(p.date) &&
      num(p.kg, 20, 350)
    );
  if (kind === 'program')
    return (
      str(p.name, 100) &&
      integer(p.weekday, 0, 6) &&
      str(p.skills, 1000) &&
      Array.isArray(p.exercises) &&
      p.exercises.length > 0 &&
      p.exercises.length <= 30 &&
      p.exercises.every((e) => validPlanned(e))
    );
  return (
    str(p.programId, 100) &&
    str(p.programName, 100) &&
    integer(p.weekday, 0, 6) &&
    validDate(p.startedAt) &&
    (p.endedAt === null || validDate(p.endedAt)) &&
    ['active', 'completed'].includes(String(p.status)) &&
    (p.status !== 'completed' || p.endedAt !== null) &&
    num(p.bodyweight, 20, 350) &&
    str(p.skills, 1000) &&
    Array.isArray(p.exercises) &&
    p.exercises.length > 0 &&
    p.exercises.length <= 30 &&
    p.exercises.every((e) => validPlanned(e, true))
  );
}
export function parseBackup(text: string): DataRecord[] {
  if (text.length > 20_000_000) throw new Error('Sauvegarde trop volumineuse (20 Mo maximum).');
  const data: unknown = JSON.parse(text);
  if (
    !object(data) ||
    data.schemaVersion !== 1 ||
    !Array.isArray(data.records) ||
    data.records.length > 30000
  )
    throw new Error('Format de sauvegarde incompatible.');
  const ids = new Set<string>();
  const records = data.records.map((r: unknown) => {
    if (
      !object(r) ||
      !kinds.includes(r.kind as Kind) ||
      !validatePayload(r.kind as Kind, r.payload) ||
      r.id !== r.payload.id ||
      typeof r.deleted !== 'boolean' ||
      ids.has(String(r.id))
    )
      throw new Error('Données invalides ou identifiants dupliqués. Aucun import effectué.');
    ids.add(String(r.id));
    return {
      id: r.id as string,
      kind: r.kind as Kind,
      payload: r.payload,
      deleted: r.deleted,
      version: uid(),
      baseVersion: null,
      updatedAt: new Date().toISOString(),
      dirty: true,
    };
  });
  if (!records.some((r) => r.kind === 'profile' && !r.deleted))
    throw new Error('Profil manquant dans la sauvegarde.');
  const exercises = new Set(
    records.filter((r) => r.kind === 'exercise' && !r.deleted).map((r) => r.id),
  );
  for (const r of records.filter((r) => r.kind === 'program' && !r.deleted))
    if ((r.payload as Program).exercises.some((e) => !exercises.has(e.exerciseId)))
      throw new Error('Un programme référence un exercice absent de la sauvegarde.');
  return records;
}
export const backupJSON = (records: DataRecord[]) =>
  JSON.stringify(
    { app: 'StreetLift', schemaVersion: 1, exportedAt: new Date().toISOString(), records },
    null,
    2,
  );
const csvCell = (v: unknown) => {
  let text = String(v ?? '');
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
export function historyCSV(records: DataRecord[]) {
  const rows: unknown[][] = [
    [
      'Date',
      'Séance',
      'Exercice',
      'Type',
      'Charge kg',
      'Séries',
      'Répétitions',
      'RIR',
      'Poids kg',
      'Commentaire',
    ],
  ];
  for (const record of records)
    if (record.kind === 'session' && !record.deleted) {
      const session = record.payload as import('./types').TrainingSession;
      if (session.status !== 'completed') continue;
      for (const e of session.exercises.filter((e) => e.result.confirmed))
        rows.push([
          session.startedAt,
          session.programName,
          e.definition.name,
          e.intent,
          e.result.load,
          e.result.sets,
          e.result.reps,
          e.result.rir,
          session.bodyweight,
          e.result.comment,
        ]);
    }
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
}
export function downloadFile(name: string, content: string, type = 'application/json') {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
// Simple Excel bridge: export a UTF-8, semicolon-delimited CSV with these exact columns.
export function parseProgramCSV(text: string, exerciseIds: Set<string>): Program[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/);
  if (
    lines.shift()?.trim() !==
    'jour;seance;exercice;type;phase;series;reps;mode;charge;repos;facultatif;base'
  )
    throw new Error('Colonnes CSV incorrectes. Utilise le modèle fourni.');
  const programs = new Map<string, Program>();
  for (const [i, line] of lines.entries()) {
    const [day, name, exerciseId, intent, phase, sets, reps, mode, load, rest, optional, basis] =
      line.split(';').map((s) => s.trim());
    const weekday = DAYS.findIndex((d) => d.toLowerCase() === day?.toLowerCase());
    if (weekday < 0 || !exerciseIds.has(exerciseId))
      throw new Error(`Ligne ${i + 2} : jour ou identifiant d'exercice inconnu.`);
    const key = `${day}:${name}`;
    let program = programs.get(key);
    if (!program) {
      program = { id: uid(), name, weekday, exercises: [], skills: '' };
      programs.set(key, program);
    }
    let planned = program.exercises.find((e) => e.exerciseId === exerciseId && e.intent === intent);
    if (!planned) {
      planned = { id: uid(), exerciseId, intent: intent as PlannedExercise['intent'], blocks: [] };
      program.exercises.push(planned);
    }
    planned.blocks.push({
      id: uid(),
      phase: phase as Block['phase'],
      sets: Number(sets),
      reps: Number(reps),
      mode: mode as Block['mode'],
      load: Number(load?.replace(',', '.')),
      rest: Number(rest),
      optional: optional === 'oui',
      percentBasis: basis as Block['percentBasis'],
    });
  }
  const result = [...programs.values()];
  if (!result.length || result.some((p) => !validatePayload('program', p)))
    throw new Error('Valeurs CSV invalides. Aucun programme importé.');
  return result;
}
