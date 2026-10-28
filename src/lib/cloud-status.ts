import { useSyncExternalStore } from 'react';
import type { Conflict } from './types';
import { getCloudClient, synchronize } from './sync';
import { getWorkspaceKey, getWorkspaceIdentity } from './store';
let status = { busy: false, message: '', conflicts: [] as Conflict[] };
const listeners = new Set<() => void>();
const update = (patch: Partial<typeof status>) => {
  status = { ...status, ...patch };
  listeners.forEach((f) => f());
};
export function useCloudStatus() {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => status,
  );
}
export const resetCloudStatus = () => update({ busy: false, message: '', conflicts: [] });
export async function runSync() {
  const scope = getWorkspaceKey();
  if (!scope || getWorkspaceIdentity()?.mode === 'demo') return;
  if (status.busy || !navigator.onLine) return;
  try {
    if (!getCloudClient()) return;
    update({ busy: true, message: 'Synchronisation en cours…' });
    const result = await synchronize();
    if (getWorkspaceKey() !== scope) return;
    update({
      conflicts: result.conflicts,
      message: result.signedOut
        ? 'Connecte-toi pour synchroniser.'
        : result.conflicts.length
          ? `${result.conflicts.length} conflit(s) : choisis la version à conserver.`
          : 'Données synchronisées.',
    });
  } catch (error) {
    if (getWorkspaceKey() !== scope) return;
    update({
      message: `Synchronisation interrompue : ${error instanceof Error ? error.message : String(error)}. Tes données locales sont conservées.`,
    });
  } finally {
    if (getWorkspaceKey() === scope) update({ busy: false });
  }
}
