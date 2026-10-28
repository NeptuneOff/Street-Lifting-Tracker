import { useEffect, useSyncExternalStore } from 'react';

export type MotionPreference = 'full' | 'reduced' | 'off';
const key = 'streetlift-motion';
const eventName = 'streetlift-motion-change';
const read = (): MotionPreference => {
  try {
    const value = localStorage.getItem(key);
    return value === 'off' || value === 'reduced' ? value : 'full';
  } catch {
    return 'full';
  }
};
let current = read();
export function initializeMotion() {
  document.documentElement.dataset.motion = current;
}
function subscribe(listener: () => void) {
  const update = () => {
    initializeMotion();
    listener();
  };
  const fromStorage = () => {
    current = read();
    update();
  };
  window.addEventListener(eventName, update);
  window.addEventListener('storage', fromStorage);
  return () => {
    window.removeEventListener(eventName, update);
    window.removeEventListener('storage', fromStorage);
  };
}
export function useMotion() {
  const preference = useSyncExternalStore(subscribe, () => current);
  return [
    preference,
    (next: MotionPreference) => {
      current = next;
      try {
        localStorage.setItem(key, next);
      } catch {
        /* The control still applies to this page. */
      }
      document.documentElement.dataset.motion = next;
      window.dispatchEvent(new Event(eventName));
    },
  ] as const;
}

// Reveal only content entering the viewport; historical rows remain immediately available.
export function usePageReveals(page: string) {
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main || !('IntersectionObserver' in window)) return;
    const selector =
      '.tracking-stat, .performance-card, .weight-card, .tracking-controls, .stat-card, .session-preview, .references, .quiet-card, .program-choice, .exercise-card, .settings-card';
    const observed = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.04 },
    );
    const scan = () =>
      main.querySelectorAll(selector).forEach((element) => {
        if (observed.has(element)) return;
        observed.add(element);
        element.classList.add('motion-reveal');
        observer.observe(element);
      });
    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(main, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [page]);
}
