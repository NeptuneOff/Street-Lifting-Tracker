import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { seedRecords } from '../src/lib/seed';
import {
  estimated1RM,
  resolveLoad,
  sessionProgress,
  startSession,
  toggleSet,
  comparableTrend,
  weeklyWeights,
} from '../src/lib/training';
import { backupJSON, parseBackup, parseProgramCSV, historyCSV } from '../src/lib/backup';
import { reconcile, validateConfig } from '../src/lib/sync';
import {
  initialize,
  getState,
  putPayload,
  replaceRecords,
  flush,
  readRecords,
} from '../src/lib/store';
import type {
  Block,
  DataRecord,
  Exercise,
  Profile,
  Program,
  RemoteRecord,
  TrainingSession,
} from '../src/lib/types';
const seed = seedRecords();
const profile = seed.find((r) => r.kind === 'profile')!.payload as Profile;
const definitions = seed.filter((r) => r.kind === 'exercise').map((r) => r.payload as Exercise);
const tuesday = seed.find((r) => r.id === 'tuesday')!.payload as Program;
const thursday = seed.find((r) => r.id === 'thursday')!.payload as Program;
function session() {
  return startSession(tuesday, definitions, profile, 76.5);
}
function completed(
  load: number,
  intent: 'Force' | 'Technique' = 'Force',
  reps = 3,
  date = '2026-10-20T12:00:00.000Z',
): TrainingSession {
  const s = session();
  s.status = 'completed';
  s.endedAt = date;
  s.startedAt = date;
  s.exercises[0].intent = intent;
  s.exercises[0].result = { load, reps, sets: 3, rir: 2, comment: '', confirmed: true };
  return s;
}

describe('prescription et historique immuable', () => {
  it('reprend le jeudi muscle-up / traction / squat et le squat du cahier des charges', () => {
    expect(thursday.exercises.map((e) => e.exerciseId)).toEqual(['muscleup', 'pullup', 'squat']);
    expect(tuesday.exercises[0].blocks.map((b) => b.load)).toEqual([40, 60, 80, 60, 50]);
  });
  it('conserve charge, nom, référence, reps et poids de corps après changement du programme', () => {
    const program = structuredClone(tuesday),
      refs = structuredClone(definitions);
    const snapshot = startSession(program, refs, profile, 76.5);
    program.exercises[0].blocks[2].load = 999;
    program.name = 'Nouveau';
    refs[3].reference = 200;
    refs[3].name = 'Autre';
    expect(snapshot.exercises[0].blocks[2].resolvedLoad).toBe(80);
    expect(snapshot.exercises[0].definition.reference).toBe(105);
    expect(snapshot.programName).toBe('Squat & statiques');
    expect(snapshot.bodyweight).toBe(76.5);
  });
  it('fige une charge dynamique au démarrage sans la recalculer après un changement du 1RM', () => {
    const p = structuredClone(tuesday);
    p.exercises[0].blocks[2] = { ...p.exercises[0].blocks[2], mode: 'percent', load: 75 };
    const s = startSession(p, definitions, profile, 76.5);
    const original = s.exercises[0].blocks[2].resolvedLoad;
    const changed = definitions.map((e) => ({ ...e, reference: 200 }));
    const next = startSession(p, changed, profile, 76.5);
    expect(original).toBe(80);
    expect(next.exercises[0].blocks[2].resolvedLoad).toBe(150);
    expect(s.exercises[0].blocks[2].resolvedLoad).toBe(80);
  });
  it('intègre le poids de corps dans les pourcentages de résistance totale', () => {
    const block = {
      ...tuesday.exercises[0].blocks[0],
      mode: 'percent',
      load: 75,
      percentBasis: 'total',
    } as Block;
    expect(resolveLoad(block, definitions[0], { ...profile, increment: 1.25 }, 80)).toBe(40);
    expect(resolveLoad({ ...block, percentBasis: 'added' }, definitions[0], profile, 80)).toBe(60);
    expect(resolveLoad({ ...block, load: 30 }, definitions[0], profile, 80)).toBe(-32.5);
  });
  it('exclut les facultatives du dénominateur et ne compte pas un pic non validé', () => {
    const s = session();
    const p = sessionProgress(s);
    expect(p.total).toBe(8);
    expect(s.exercises[0].result.confirmed).toBe(false);
    let ex = s.exercises[0];
    ex = toggleSet(ex, ex.blocks[2].id, 0);
    expect(ex.result.confirmed).toBe(true);
    expect(ex.result.sets).toBe(1);
    ex = toggleSet(ex, ex.blocks[2].id, 0);
    expect(ex.result.confirmed).toBe(false);
    expect(ex.result.sets).toBe(3);
    s.exercises[0] = ex;
    for (const b of ex.blocks.filter((b) => !b.optional))
      for (let i = 0; i < b.sets; i++) s.exercises[0] = toggleSet(s.exercises[0], b.id, i);
    expect(sessionProgress(s)).toEqual({ total: 8, done: 8, percent: 100 });
  });
});
describe('statistiques comparables', () => {
  it('ne qualifie pas une séance technique légère de régression', () =>
    expect(
      comparableTrend(
        [completed(80), completed(40, 'Technique', 3, '2026-10-27T12:00:00Z')],
        'squat',
      ).delta,
    ).toBeNull());
  it('sépare les répétitions et les séries', () => {
    expect(
      comparableTrend([completed(80), completed(60, 'Force', 8, '2026-10-27T12:00:00Z')], 'squat')
        .delta,
    ).toBeNull();
    const b = completed(85, 'Force', 3, '2026-10-27T12:00:00Z');
    b.exercises[0].result.sets = 2;
    expect(comparableTrend([completed(80), b], 'squat').delta).toBeNull();
  });
  it('détecte une progression sur des pics comparables', () =>
    expect(
      comparableTrend(
        [completed(80), completed(82.5, 'Force', 3, '2026-10-27T12:00:00Z')],
        'squat',
      ),
    ).toEqual({ label: 'En progression', delta: 2.5 }));
  it('évite de comparer des pics avec des RIR très différents', () => {
    const b = completed(85, 'Force', 3, '2026-10-27T12:00:00Z');
    b.exercises[0].result.rir = 5;
    expect(comparableTrend([completed(80), b], 'squat').delta).toBeNull();
  });
  it('calcule l’estimation sur la résistance totale', () =>
    expect(estimated1RM(40, 3, true, 80)).toBeCloseTo(52));
  it('calcule les moyennes hebdomadaires par semaine commençant le lundi', () =>
    expect(
      weeklyWeights([
        { date: '2026-10-26', kg: 76 },
        { date: '2026-10-28', kg: 78 },
        { date: '2026-11-02', kg: 77 },
      ]),
    ).toEqual([
      { date: '2026-10-26', kg: 77 },
      { date: '2026-11-02', kg: 77 },
    ]));
});
describe('sauvegardes et import', () => {
  it('restitue les snapshots à l’identique dans un aller-retour JSON', () => {
    const record = {
      ...seed[0],
      id: 'session-test',
      kind: 'session',
      payload: { ...completed(80), id: 'session-test' },
    } as DataRecord;
    const restored = parseBackup(backupJSON([...seed, record]));
    expect(restored.find((r) => r.id === 'session-test')!.payload).toEqual(record.payload);
    expect(restored.every((r) => r.dirty && r.baseVersion === null)).toBe(true);
  });
  it('refuse entièrement un import invalide, dupliqué ou avec références absentes', () => {
    const invalid = structuredClone(seed);
    (invalid[0].payload as Profile).bodyweight = -1;
    expect(() => parseBackup(backupJSON(invalid))).toThrow();
    expect(() => parseBackup(backupJSON([...seed, seed[0]]))).toThrow();
    expect(() => parseBackup(backupJSON(seed.filter((r) => r.id !== 'squat')))).toThrow();
  });
  it('neutralise les formules CSV et ignore les pics non validés', () => {
    const s = completed(80);
    s.exercises[0].result.comment = '=HYPERLINK("x")';
    const r = { ...seed[0], kind: 'session', payload: s } as DataRecord;
    expect(historyCSV([r])).toContain("'=HYPERLINK");
    s.exercises[0].result.confirmed = false;
    expect(historyCSV([r]).split('\r\n')).toHaveLength(1);
  });
  it('importe le format Excel simple et refuse les exercices inconnus', () => {
    const text =
      'jour;seance;exercice;type;phase;series;reps;mode;charge;repos;facultatif;base\nJeudi;Force;squat;Force;Pic;3;3;fixed;80;300;non;total';
    expect(parseProgramCSV(text, new Set(['squat']))[0].weekday).toBe(4);
    expect(() => parseProgramCSV(text, new Set())).toThrow();
  });
});
describe('synchronisation sans écrasement silencieux', () => {
  const local = { ...seed[0], version: 'local-v2', baseVersion: 'v1', dirty: true };
  const remote = {
    id: local.id,
    kind: local.kind,
    payload: local.payload,
    version: 'remote-v2',
    deleted: false,
    updated_at: new Date().toISOString(),
  } as RemoteRecord;
  it('détecte les modifications concurrentes', () =>
    expect(reconcile(local, remote)).toBe('conflict'));
  it('réconcilie les envois répétés sans doublon', () =>
    expect(reconcile(local, { ...remote, version: 'local-v2' })).toBe('ack'));
  it('envoie une modification lorsque la base distante est inchangée', () =>
    expect(reconcile(local, { ...remote, version: 'v1' })).toBe('upload'));
  it('récupère les données distantes sur un appareil sans modification locale', () =>
    expect(reconcile({ ...local, dirty: false }, remote)).toBe('remote'));
  it('remplace les valeurs initiales intactes d’un deuxième appareil par le carnet distant', () =>
    expect(reconcile({ ...local, seeded: true, baseVersion: null }, remote)).toBe('remote'));
  it('refuse les clés privées et les URL non HTTPS', () => {
    expect(() =>
      validateConfig({ url: 'https://example.supabase.co', key: 'sb_secret_private' }),
    ).toThrow();
    expect(() =>
      validateConfig({ url: 'http://example.supabase.co', key: 'sb_publishable_test' }),
    ).toThrow();
    expect(() =>
      validateConfig({ url: 'https://example.supabase.co', key: 'sb_publishable_test' }),
    ).not.toThrow();
  });
});
describe('persistance IndexedDB réelle', () => {
  it('conserve un accusé de synchronisation écrit pendant une transaction locale', async () => {
    await initialize({
      project: 'https://unit.supabase.co',
      userId: 'owner',
      name: 'Karl',
      email: 'karl@example.test',
    });
    const record = { ...getState().records[0], version: 'same-version', dirty: true };
    replaceRecords([record]);
    await Promise.resolve();
    replaceRecords([{ ...record, dirty: false, baseVersion: 'same-version' }]);
    await flush();
    expect((await readRecords()).find((r) => r.id === record.id)?.dirty).toBe(false);
  });
  it('sauvegarde une série et son résultat dans une transaction durable', async () => {
    await initialize({
      project: 'https://unit.supabase.co',
      userId: 'owner',
      name: 'Karl',
      email: 'karl@example.test',
    });
    const s = session();
    s.exercises[0] = toggleSet(s.exercises[0], s.exercises[0].blocks[2].id, 0);
    putPayload('session', s);
    await flush();
    const records = await readRecords();
    expect(
      (records.find((r) => r.id === s.id)!.payload as TrainingSession).exercises[0].result.sets,
    ).toBe(1);
    expect(getState().saving).toBe(false);
  });
});
