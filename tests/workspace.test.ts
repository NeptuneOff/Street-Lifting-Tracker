import 'fake-indexeddb/auto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  clearWorkspace,
  flush,
  getState,
  getWorkspaceKey,
  initialize,
  putPayload,
  readRecords,
  replaceRecords,
  workspaceStorageKey,
} from '../src/lib/store';
import { workspaceKey } from '../src/lib/workspace';
import { seedRecords } from '../src/lib/seed';
import type { Program } from '../src/lib/types';
const A = {
  project: 'https://private.supabase.co',
  userId: 'account-a',
  name: 'Alice',
  email: 'alice@example.test',
};
const B = { ...A, userId: 'account-b', name: 'Bob', email: 'bob@example.test' };
afterAll(clearWorkspace);
describe('carnets locaux par identité', () => {
  it('démarre un compte avec ses références vierges et son propre profil', async () => {
    await initialize(A);
    expect(getState().records.find((r) => r.kind === 'profile')?.payload).toMatchObject({
      name: 'Alice',
      bodyweight: 75,
    });
    expect(
      getState()
        .records.filter((r) => r.kind === 'exercise')
        .every((r) => 'reference' in r.payload && r.payload.reference === 0),
    ).toBe(true);
  });
  it('isole programmes et écritures en cours sur le même navigateur', async () => {
    await initialize(A);
    const program = structuredClone(
      getState().records.find((r) => r.id === 'monday')!.payload as Program,
    );
    program.name = 'Secret Alice';
    putPayload('program', program);
    const writes = flush();
    clearWorkspace();
    expect(getState().records).toEqual([]);
    await initialize(B);
    await writes;
    expect(
      getState().records.some((r) => 'name' in r.payload && r.payload.name === 'Secret Alice'),
    ).toBe(false);
    expect(
      (await readRecords()).some((r) => 'name' in r.payload && r.payload.name === 'Secret Alice'),
    ).toBe(false);
    await initialize(A);
    expect((getState().records.find((r) => r.id === 'monday')!.payload as Program).name).toBe(
      'Secret Alice',
    );
  });
  it('refuse la réponse différée d’un autre compte', async () => {
    await initialize(A);
    const key = getWorkspaceKey()!;
    const foreign = getState().records.find((r) => r.id === 'monday')!;
    await initialize(B);
    expect(() => replaceRecords([foreign], key)).toThrow('compte actif a changé');
    expect(
      getState().records.some((r) => 'name' in r.payload && r.payload.name === 'Secret Alice'),
    ).toBe(false);
  });
  it('sépare aussi les projets, le chronomètre et la date de synchronisation', async () => {
    await initialize(A);
    const key = workspaceStorageKey('timer');
    await initialize(B);
    expect(workspaceStorageKey('timer')).not.toBe(key);
    expect(workspaceKey(A)).not.toBe(workspaceKey({ ...A, project: 'https://other.supabase.co' }));
  });
  it('ne permet ni lecture ni écriture après déconnexion', () => {
    clearWorkspace();
    expect(getState().records).toEqual([]);
    expect(() => readRecords()).toThrow('Connexion requise');
    expect(() => replaceRecords([])).toThrow('Connexion requise');
  });
});

describe('migration prudente du carnet historique', () => {
  it('ne récupère pas un carnet ancien sans propriétaire connu', async () => {
    const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('streetlift-v1', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('records', { keyPath: 'id' });
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve) => {
      const tx = legacy.transaction('records', 'readwrite');
      seedRecords({ name: 'Ancien propriétaire', blank: false }).forEach((r) =>
        tx.objectStore('records').put(r),
      );
      tx.oncomplete = () => resolve();
    });
    legacy.close();
    await initialize({ ...A, userId: 'new-without-binding', name: 'Nouveau' });
    expect(getState().records.find((r) => r.kind === 'profile')?.payload).toMatchObject({
      name: 'Nouveau',
    });
  });
  it('réattribue l’ancien carnet seulement au compte déjà lié', async () => {
    const owner = { ...A, userId: 'legacy-owner', name: 'Propriétaire' };
    vi.stubGlobal('localStorage', {
      getItem: (key: string) =>
        key === 'streetlift-bound-account' ? `${owner.project}:${owner.userId}` : null,
    });
    try {
      await initialize(owner);
      expect(getState().records.find((r) => r.kind === 'profile')?.payload).toMatchObject({
        name: 'Ancien propriétaire',
      });
      await initialize({ ...B, userId: 'legacy-other', name: 'Autre' });
      expect(getState().records.find((r) => r.kind === 'profile')?.payload).toMatchObject({
        name: 'Autre',
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
