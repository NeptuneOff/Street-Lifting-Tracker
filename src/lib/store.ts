import { useSyncExternalStore } from 'react';
import { seedRecords, uid } from './seed';
import { workspaceKey, WorkspaceChangedError, type WorkspaceIdentity } from './workspace';
import type {
  DataRecord,
  Exercise,
  Kind,
  Payload,
  Profile,
  Program,
  State,
  TrainingSession,
  Weight,
} from './types';

interface Workspace {
  key: string;
  identity: WorkspaceIdentity;
  db?: Promise<IDBDatabase>;
  writes: Promise<void>;
  pending: number;
  unsaved: Map<string, DataRecord>;
  channel?: BroadcastChannel;
}
let active: Workspace | null = null;
const workspaces = new Map<string, Workspace>();
let state: State = { records: [], ready: false, saving: false, error: '' };
const listeners = new Set<() => void>();
const emit = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((f) => f());
};
function current() {
  if (!active) throw new Error('Connexion requise pour accéder au carnet.');
  return active;
}
export const getWorkspaceKey = () => active?.key ?? null;
export const getWorkspaceIdentity = () => active?.identity ?? null;
export const workspaceStorageKey = (suffix: string) => `streetlift:${current().key}:${suffix}`;
export function assertWorkspace(key: string) {
  if (active?.key !== key) throw new WorkspaceChangedError();
}
function openFor(workspace: Workspace) {
  workspace.db ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(`streetlift-v2:${workspace.key}`, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error('Ferme les autres onglets pour mettre à jour le stockage.'));
  });
  return workspace.db;
}
export const openDatabase = () => openFor(current());
async function writeFor(workspace: Workspace, records: DataRecord[]) {
  const db = await openFor(workspace);
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('records', 'readwrite');
    records.forEach((record) => transaction.objectStore('records').put(record));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Sauvegarde interrompue.'));
  });
}
export const writeRecords = (records: DataRecord[]) => writeFor(current(), records);
async function readFor(workspace: Workspace) {
  const db = await openFor(workspace);
  return new Promise<DataRecord[]>((resolve, reject) => {
    const request = db.transaction('records').objectStore('records').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export const readRecords = () => readFor(current());
async function ownedLegacy(identity: WorkspaceIdentity): Promise<DataRecord[] | null> {
  // Never assign an unowned pre-account notebook to the next person signing in.
  const binding = globalThis.localStorage?.getItem('streetlift-bound-account');
  const project = new URL(identity.project).origin;
  if (binding !== `${project}:${identity.userId}` && binding !== `${project}/:${identity.userId}`)
    return null;
  return new Promise((resolve) => {
    const request = indexedDB.open('streetlift-v1');
    request.onupgradeneeded = () => request.transaction?.abort();
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('records')) {
        db.close();
        resolve(null);
        return;
      }
      const records = db.transaction('records').objectStore('records').getAll();
      records.onsuccess = () => {
        db.close();
        resolve(records.result);
      };
      records.onerror = () => {
        db.close();
        resolve(null);
      };
    };
  });
}
export function clearWorkspace() {
  active?.channel?.close();
  if (active) active.channel = undefined;
  active = null;
  emit({ records: [], ready: false, saving: false, error: '' });
}
export async function initialize(identity: WorkspaceIdentity) {
  clearWorkspace();
  const key = workspaceKey(identity);
  const workspace: Workspace = workspaces.get(key) ?? {
    key,
    identity,
    writes: Promise.resolve(),
    pending: 0,
    unsaved: new Map(),
  };
  workspaces.set(key, workspace);
  active = workspace;
  try {
    await workspace.writes.catch(() => {});
    if (workspace.unsaved.size) {
      await writeFor(workspace, [...workspace.unsaved.values()]);
      workspace.unsaved.clear();
    }
    let records = await readFor(workspace);
    if (!records.length) {
      records = (await ownedLegacy(identity)) ?? seedRecords({ name: identity.name, blank: true });
      await writeFor(workspace, records);
    }
    if (active !== workspace) return;
    emit({ records, ready: true, error: '' });
    if (typeof BroadcastChannel !== 'undefined') {
      workspace.channel = new BroadcastChannel(`streetlift-data:${key}`);
      workspace.channel.onmessage = async () => {
        try {
          await workspace.writes;
          const records = await readFor(workspace);
          if (active === workspace) emit({ records });
        } catch {
          /* Keep unsaved data for its owner. */
        }
      };
    }
  } catch (error) {
    workspace.db = undefined;
    if (active === workspace) emit({ error: `Stockage indisponible : ${String(error)}` });
  }
}
function persist(workspace: Workspace, records: DataRecord[]) {
  records.forEach((record) => workspace.unsaved.set(record.id, record));
  workspace.pending++;
  if (active === workspace) emit({ saving: true });
  workspace.writes = workspace.writes
    .catch(() => {})
    .then(async () => {
      const batch = [...workspace.unsaved.values()];
      if (!batch.length) return;
      await writeFor(workspace, batch);
      batch.forEach((record) => {
        if (workspace.unsaved.get(record.id) === record) workspace.unsaved.delete(record.id);
      });
      workspace.channel?.postMessage('changed');
      if (active === workspace && !workspace.unsaved.size) emit({ error: '' });
    })
    .catch((error) => {
      if (active === workspace)
        emit({
          error: `Échec de sauvegarde locale. Exporte tes données avant de fermer. ${String(error)}`,
        });
      throw error;
    })
    .finally(() => {
      workspace.pending--;
      if (active === workspace) emit({ saving: workspace.pending > 0 });
    });
  void workspace.writes.catch(() => {});
}
export const flush = () => active?.writes ?? Promise.resolve();
export const flushAll = () =>
  Promise.all([...workspaces.values()].map((workspace) => workspace.writes));
export const retrySave = () => persist(current(), state.records);
export const getState = () => state;
export function replaceRecords(changed: DataRecord[], expectedWorkspace?: string) {
  if (expectedWorkspace) assertWorkspace(expectedWorkspace);
  const workspace = current();
  const map = new Map(state.records.map((record) => [record.id, record]));
  changed.forEach((record) => map.set(record.id, record));
  emit({ records: [...map.values()] });
  persist(workspace, changed);
}
export function putPayload(kind: Kind, payload: Payload) {
  const existing = state.records.find((record) => record.id === payload.id);
  replaceRecords([
    {
      id: payload.id,
      kind,
      payload: structuredClone(payload),
      version: uid(),
      baseVersion: existing?.baseVersion ?? null,
      updatedAt: new Date().toISOString(),
      deleted: false,
      dirty: true,
    },
  ]);
}
export function removeRecord(id: string) {
  const record = state.records.find((r) => r.id === id);
  if (record)
    replaceRecords([
      {
        ...record,
        deleted: true,
        seeded: false,
        dirty: true,
        version: uid(),
        updatedAt: new Date().toISOString(),
      },
    ]);
}
export function useData() {
  const s = useSyncExternalStore((callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }, getState);
  const records = s.records.filter((r) => !r.deleted);
  return {
    ...s,
    profile: records.find((r) => r.kind === 'profile')?.payload as Profile | undefined,
    exercises: records.filter((r) => r.kind === 'exercise').map((r) => r.payload as Exercise),
    programs: records
      .filter((r) => r.kind === 'program')
      .map((r) => r.payload as Program)
      .sort((a, b) => (a.weekday || 7) - (b.weekday || 7)),
    sessions: records
      .filter((r) => r.kind === 'session')
      .map((r) => r.payload as TrainingSession)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    weights: records
      .filter((r) => r.kind === 'weight')
      .map((r) => r.payload as Weight)
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
