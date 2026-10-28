import { useSyncExternalStore } from 'react';
import { seedRecords, uid } from './seed';
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

let dbPromise: Promise<IDBDatabase> | undefined;
let state: State = { records: [], ready: false, saving: false, error: '' };
const listeners = new Set<() => void>();
let writes = Promise.resolve();
let pending = 0;
const unsaved = new Map<string, DataRecord>();
const emit = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((f) => f());
};
export function openDatabase() {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('streetlift-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error('Ferme les autres onglets pour mettre à jour le stockage.'));
  });
  return dbPromise;
}
export async function writeRecords(records: DataRecord[]) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('records', 'readwrite');
    records.forEach((record) => transaction.objectStore('records').put(record));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Sauvegarde interrompue.'));
  });
}
export async function readRecords() {
  const db = await openDatabase();
  return new Promise<DataRecord[]>((resolve, reject) => {
    const request = db.transaction('records').objectStore('records').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function initialize() {
  try {
    let records = await readRecords();
    if (!records.length) {
      records = seedRecords();
      await writeRecords(records);
    }
    emit({ records, ready: true, error: '' });
    if (typeof BroadcastChannel !== 'undefined') {
      channel ??= new BroadcastChannel('streetlift-data');
      channel.onmessage = async () => {
        try {
          await writes;
          emit({ records: await readRecords() });
        } catch {
          /* Keep unsaved in-memory data available for export/retry. */
        }
      };
    }
  } catch (error) {
    dbPromise = undefined;
    emit({ error: `Stockage indisponible : ${String(error)}` });
  }
}
let channel: BroadcastChannel | undefined;
function persist(records: DataRecord[]) {
  records.forEach((record) => unsaved.set(record.id, record));
  pending++;
  emit({ saving: true });
  writes = writes
    .catch(() => {})
    .then(async () => {
      const batch = [...unsaved.values()];
      if (!batch.length) return;
      await writeRecords(batch);
      batch.forEach((record) => {
        if (unsaved.get(record.id) === record) unsaved.delete(record.id);
      });
    })
    .then(() => {
      channel?.postMessage('changed');
      if (!unsaved.size) emit({ error: '' });
    })
    .catch((error) => {
      emit({
        error: `Échec de sauvegarde locale. Exporte tes données avant de fermer. ${String(error)}`,
      });
      throw error;
    })
    .finally(() => {
      pending--;
      emit({ saving: pending > 0 });
    });
  // Consumers can await flush() for critical transitions; suppress unhandled rejections here.
  void writes.catch(() => {});
}
export const flush = () => writes;
export const retrySave = () => persist(state.records);
export const getState = () => state;
export function replaceRecords(changed: DataRecord[]) {
  const map = new Map(state.records.map((record) => [record.id, record]));
  changed.forEach((record) => map.set(record.id, record));
  emit({ records: [...map.values()] });
  persist(changed);
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
