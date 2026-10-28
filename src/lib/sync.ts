import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getState, flush, replaceRecords } from './store';
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
export function getCloudClient() {
  const config = getCloudConfig();
  if (!config.url || !config.key) return null;
  validateConfig(config);
  const key = config.url + config.key;
  if (key !== clientKey) {
    client?.auth.stopAutoRefresh();
    client = createClient(config.url, config.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
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
let syncing = false;
export async function synchronize(): Promise<{
  conflicts: Conflict[];
  count: number;
  signedOut?: boolean;
}> {
  if (syncing) return { conflicts: [], count: 0 };
  const cloud = getCloudClient();
  if (!cloud) throw new Error('Configure Supabase pour synchroniser.');
  syncing = true;
  try {
    await flush();
    const {
      data: { session },
      error,
    } = await cloud.auth.getSession();
    if (error) throw error;
    if (!session) return { conflicts: [], count: 0, signedOut: true };
    const account = `${getCloudConfig().url}:${session.user.id}`;
    const previous = localStorage.getItem('streetlift-bound-account');
    if (previous && previous !== account)
      throw new Error(
        'Ce carnet est associé à un autre compte ou projet. Utilise un autre profil de navigateur pour éviter de mélanger tes données.',
      );
    localStorage.setItem('streetlift-bound-account', account);
    const remotes: RemoteRecord[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error: readError } = await cloud
        .from('training_records')
        .select('id,kind,payload,version,deleted,updated_at')
        .eq('user_id', session.user.id)
        .order('id')
        .range(offset, offset + 499);
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
        replaceRecords([fromRemote(remote)]);
      if (action === 'conflict') conflicts.push({ id: remote.id, local: local!, remote });
    }
    const conflictIds = new Set(conflicts.map((c) => c.id));
    let count = 0;
    for (const record of getState().records.filter((r) => r.dirty && !conflictIds.has(r.id))) {
      const { data, error: writeError } = await cloud.rpc('push_training_record', {
        p_id: record.id,
        p_kind: record.kind,
        p_payload: record.payload,
        p_deleted: record.deleted,
        p_base_version: record.baseVersion,
        p_version: record.version,
      });
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
      replaceRecords([
        current.version === record.version
          ? { ...current, baseVersion: record.version, dirty: false }
          : { ...current, baseVersion: record.version },
      ]);
      count++;
    }
    await flush();
    localStorage.setItem('streetlift-last-sync', new Date().toISOString());
    return { conflicts, count };
  } finally {
    syncing = false;
  }
}
export function resolveConflict(conflict: Conflict, choice: 'local' | 'remote') {
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
