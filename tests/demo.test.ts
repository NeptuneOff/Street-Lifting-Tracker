import 'fake-indexeddb/auto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { seedDemoRecords } from '../src/lib/demo';
import { backupJSON, parseBackup } from '../src/lib/backup';
import { comparableTrend } from '../src/lib/training';
import {
  clearWorkspace,
  flush,
  getState,
  initialize,
  putPayload,
  resetDemoWorkspace,
} from '../src/lib/store';
import { synchronize } from '../src/lib/sync';
import { DEMO_IDENTITY, workspaceKey } from '../src/lib/workspace';
import type { Program, TrainingSession, Weight } from '../src/lib/types';
const NOW = new Date('2026-10-28T14:00:00Z');
const records = seedDemoRecords(NOW);
const sessions = records
  .filter((r) => r.kind === 'session')
  .map((r) => r.payload as TrainingSession);
afterAll(() => {
  clearWorkspace();
  vi.unstubAllGlobals();
});
describe('jeu de démonstration fictif', () => {
  it('fournit 12 semaines pleines et le début de semaine, sans résultat futur', () => {
    expect(sessions).toHaveLength(50);
    expect(records.filter((r) => r.kind === 'weight')).toHaveLength(38);
    expect(sessions.every((s) => s.status === 'completed' && new Date(s.endedAt!) < NOW)).toBe(
      true,
    );
    expect(new Set(records.map((r) => r.id)).size).toBe(records.length);
  });
  it('valide tous les snapshots et permet un aller-retour JSON', () => {
    expect(parseBackup(backupJSON(records)).map((r) => r.payload)).toEqual(
      records.map((r) => r.payload),
    );
    expect(sessions.every((s) => s.exercises.every((e) => e.result.confirmed))).toBe(true);
  });
  it('alimente les quatre graphiques, les records réalisés et le suivi du poids', () => {
    for (const id of ['pullup', 'dip', 'muscleup', 'squat']) {
      expect(
        sessions
          .flatMap((s) => s.exercises)
          .filter((e) => e.exerciseId === id && e.result.reps === 1),
      ).toHaveLength(3);
      expect(comparableTrend(sessions, id).label).toBe(
        ['pullup', 'muscleup'].includes(id) ? 'Stable' : 'En progression',
      );
    }
    const weights = records.filter((r) => r.kind === 'weight').map((r) => r.payload as Weight);
    expect(weights[0].kg).toBeGreaterThan(weights.at(-1)!.kg);
    expect(sessions.some((s) => s.exercises.some((e) => e.intent === 'Technique'))).toBe(true);
  });
});
describe('espace de démonstration isolé', () => {
  it('ne synchronise aucune donnée même sans configuration Supabase', async () => {
    await initialize(DEMO_IDENTITY);
    expect(await synchronize()).toEqual({ conflicts: [], count: 0 });
    expect(workspaceKey(DEMO_IDENTITY)).toMatch(/^demo:/);
  });
  it('réinitialise seulement la démo et conserve les programmes privés', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null, removeItem: () => {} });
    const owner = {
      project: 'https://demo-isolation.supabase.co',
      userId: 'real-user',
      name: 'Compte privé',
      email: 'owner@example.test',
    };
    await initialize(owner);
    const personal = structuredClone(
      getState().records.find((r) => r.kind === 'program')!.payload as Program,
    );
    personal.name = 'MON PROGRAMME PRIVE';
    putPayload('program', personal);
    await flush();
    await expect(resetDemoWorkspace()).rejects.toThrow('réservée à la démo');
    await initialize(DEMO_IDENTITY);
    const sample = structuredClone(
      getState().records.find((r) => r.kind === 'program')!.payload as Program,
    );
    sample.name = 'MODIFICATION DEMO';
    putPayload('program', sample);
    await flush();
    await resetDemoWorkspace();
    expect(
      getState().records.some((r) => 'name' in r.payload && r.payload.name === 'MODIFICATION DEMO'),
    ).toBe(false);
    expect(getState().records.filter((r) => r.kind === 'session').length).toBeGreaterThanOrEqual(
      48,
    );
    await initialize(owner);
    expect((getState().records.find((r) => r.id === personal.id)!.payload as Program).name).toBe(
      'MON PROGRAMME PRIVE',
    );
  });
});
