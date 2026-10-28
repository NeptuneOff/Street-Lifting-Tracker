import { useEffect, useSyncExternalStore } from 'react';
import { flushAll, getState } from './store';
let registration: ServiceWorkerRegistration | undefined;
let state = { ready: false, update: false };
const listeners = new Set<() => void>();
const emit = (patch: Partial<typeof state>) => {
  state = { ...state, ...patch };
  listeners.forEach((f) => f());
};
export function usePWAStatus() {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => state,
  );
}
export async function applyPWAUpdate() {
  await flushAll();
  if (!registration?.waiting) return;
  sessionStorage.setItem('streetlift-updating', '1');
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
}
export function usePWARegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
    let disposed = false;
    const waiting = () => {
      emit({ update: true });
      // Refresh the signed-out shell as well: an old cached shell must not bypass login offline.
      if (!getState().ready) void applyPWAUpdate().catch(() => {});
    };
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((value) => {
        registration = value;
        if (value.waiting) waiting();
        value.addEventListener('updatefound', () => {
          const installing = value.installing;
          installing?.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) waiting();
          });
        });
        return navigator.serviceWorker.ready;
      })
      .then(() => {
        if (!disposed) emit({ ready: true });
      })
      .catch(() => {});
    const changed = () => {
      if (sessionStorage.getItem('streetlift-updating')) {
        sessionStorage.removeItem('streetlift-updating');
        location.reload();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', changed);
    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener('controllerchange', changed);
    };
  }, []);
}
