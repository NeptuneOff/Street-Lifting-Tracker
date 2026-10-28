import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  getState,
  flush,
  replaceRecords,
  getWorkspaceKey,
  getWorkspaceIdentity,
  assertWorkspace,
  workspaceStorageKey,
} from './store';
import { validatePayload } from './backup';
import { uid } from './seed';
import type { Conflict, DataRecord, RemoteRecord } from './types';

export interface CloudConfig {
  url: string;
  key: string;
}
let client: SupabaseClient | null = null;
let clientKey = '';
export function getCloudConfig(): CloudConfig {
  try {
    return (
      JSON.parse(localStorage.getItem('streetlift-cloud') || 'null') ?? {
        url: import.meta.env.VITE_SUPABASE_URL || '',
        key: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      }
    );
  } catch {
    return { url: '', key: '' };
  }
}
export function validateConfig(config: CloudConfig) {
  const url = new URL(config.url);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('Utilise l’URL HTTPS racine de ton projet Supabase.');
  if (!config.key.startsWith('sb_publishable_')) {
    try {
      const claims = JSON.parse(
        atob(config.key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
      );
      if (claims.role !== 'anon') throw new Error();
    } catch {
      throw new Error(
        'Utilise uniquement une clé publique publishable ou anon. Les clés privées sont refusées.',
      );
    }
  }
}
export const authStorageKey = (url: string) =>
  `streetlift-auth:${encodeURIComponent(new URL(url).origin)}`;
export const legacyAuthStorageKey = (url: string) =>
  `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
export function getCloudClient() {
  const config = getCloudConfig();
  if (!config.url || !config.key) return null;
  validateConfig(config);
  const key = config.url + config.key;
  if (key !== clientKey) {
    client?.auth.stopAutoRefresh();
    const storageKey = authStorageKey(config.url);
    const legacyKey = legacyAuthStorageKey(config.url);
    const legacy = localStorage.getItem(legacyKey);
    if (!localStorage.getItem(storageKey) && legacy) localStorage.setItem(storageKey, legacy);
    if (legacy) localStorage.removeItem(legacyKey);
    client = createClient(config.url, config.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15000) }),
      },
    });
    clientKey = key;
  }
  return client;
}
export function fromRemote(remote: RemoteRecord): DataRecord {
  if (!validatePayload(remote.kind, remote.payload) || remote.id !== remote.payload.id)
    throw new Error('Données distantes incompatibles. Import annulé.');
  return {
    id: remote.id,
    kind: remote.kind,
    payload: remote.payload,
    version: remote.version,
    baseVersion: remote.version,
    updatedAt: remote.updated_at,
    deleted: remote.deleted,
    dirty: false,
  };
}
export function reconcile(
  local: DataRecord | undefined,
  remote: RemoteRecord,
): 'remote' | 'upload' | 'conflict' | 'ack' {
  if (!local || !local.dirty) return 'remote';
  // Unedited starter data on a second device must yield to the user's cloud data.
  if (local.seeded && local.baseVersion === null) return 'remote';
  if (local.version === remote.version) return 'ack';
  if (local.baseVersion === remote.version) return 'upload';
  return 'conflict';
}
const syncing = new Set<string>();
export async function synchronize(): Promise<{
  conflicts: Conflict[];
  count: number;
  signedOut?: boolean;
}> {
  const scope = getWorkspaceKey();
  if (getWorkspaceIdentity()?.mode === 'demo') return { conflicts: [], count: 0 };
  if (!scope || !getState().ready) return { conflicts: [], count: 0, signedOut: true };
  if (syncing.has(scope)) return { conflicts: [], count: 0 };
  const cloud = getCloudClient();
  if (!cloud) throw new Error('Configure Supabase pour synchroniser.');
  syncing.add(scope);
  try {
    await flush();
    assertWorkspace(scope);
    const {
      data: { session },
      error,
    } = await cloud.auth.getSession();
    if (error) throw error;
    if (!session) return { conflicts: [], count: 0, signedOut: true };
    assertWorkspace(scope);
    const identity = getWorkspaceIdentity();
    if (
      identity?.userId !== session.user.id ||
      new URL(getCloudConfig().url).origin !== identity.project
    )
      throw new Error('Le compte connecté ne correspond pas au carnet actif.');
    // Pin the JWT for the entire operation: switching accounts cannot send A's data as B.
    const config = getCloudConfig();
    const scopedCloud = createClient(config.url, config.key, {
      accessToken: async () => session.access_token,
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15000) }),
      },
    });
    const remotes: RemoteRecord[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error: readError } = await scopedCloud
        .from('training_records')
        .select('id,kind,payload,version,deleted,updated_at')
        .eq('user_id', session.user.id)
        .order('id')
        .range(offset, offset + 499);
      assertWorkspace(scope);
      if (readError) throw readError;
      remotes.push(...(data as RemoteRecord[]));
      if (data.length < 500) break;
    }
    // Validate every remote row before applying any row.
    remotes.forEach(fromRemote);
    const conflicts: Conflict[] = [];
    for (const remote of remotes) {
      const local = getState().records.find((r) => r.id === remote.id);
      const action = reconcile(local, remote);
      if (
        (action === 'remote' || action === 'ack') &&
        (!local || local.version !== remote.version || local.dirty)
      )
        replaceRecords([fromRemote(remote)], scope);
      if (action === 'conflict') conflicts.push({ id: remote.id, local: local!, remote });
    }
    const conflictIds = new Set(conflicts.map((c) => c.id));
    let count = 0;
    for (const record of getState().records.filter((r) => r.dirty && !conflictIds.has(r.id))) {
      const { data, error: writeError } = await scopedCloud.rpc('push_training_record', {
        p_id: record.id,
        p_kind: record.kind,
        p_payload: record.payload,
        p_deleted: record.deleted,
        p_base_version: record.baseVersion,
        p_version: record.version,
      });
      assertWorkspace(scope);
      if (writeError) throw writeError;
      const response = data as { accepted: boolean; record: RemoteRecord };
      if (!response.accepted) {
        conflicts.push({
          id: record.id,
          local: getState().records.find((r) => r.id === record.id)!,
          remote: response.record,
        });
        continue;
      }
      const current = getState().records.find((r) => r.id === record.id)!;
      replaceRecords(
        [
          current.version === record.version
            ? { ...current, baseVersion: record.version, dirty: false }
            : { ...current, baseVersion: record.version },
        ],
        scope,
      );
      count++;
    }
    await flush();
    assertWorkspace(scope);
    localStorage.setItem(workspaceStorageKey('last-sync'), new Date().toISOString());
    return { conflicts, count };
  } finally {
    syncing.delete(scope);
  }
}
export function resolveConflict(conflict: Conflict, choice: 'local' | 'remote', scope: string) {
  assertWorkspace(scope);
  const current = getState().records.find((r) => r.id === conflict.id) ?? conflict.local;
  replaceRecords([
    choice === 'remote'
      ? fromRemote(conflict.remote)
      : {
          ...current,
          baseVersion: conflict.remote.version,
          version: uid(),
          dirty: true,
          updatedAt: new Date().toISOString(),
        },
  ]);
}
