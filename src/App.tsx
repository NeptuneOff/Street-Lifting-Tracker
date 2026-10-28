import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  CloudOff,
  Dumbbell,
  House,
  ListChecks,
  Menu,
  Settings2,
  ShieldCheck,
  WifiOff,
  X,
} from 'lucide-react';
import { flush, initialize, putPayload, retrySave, useData } from './lib/store';
import { startSession } from './lib/training';
import { getCloudClient } from './lib/sync';
import { runSync, useCloudStatus } from './lib/cloud-status';
import { AppContext, type Page } from './components/UI';
import { initialTimer, Timer, unlockAudio } from './components/Timer';
import { Home } from './pages/Home';
const Workout = lazy(() => import('./pages/Workout').then((m) => ({ default: m.Workout })));
const Progress = lazy(() => import('./pages/Progress').then((m) => ({ default: m.Progress })));
const Program = lazy(() => import('./pages/Program').then((m) => ({ default: m.Program })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const navigation = [
  { id: 'home', label: 'Accueil', icon: House },
  { id: 'workout', label: 'Entraînement', icon: Dumbbell },
  { id: 'progress', label: 'Progression', icon: Activity },
  { id: 'program', label: 'Programme', icon: ListChecks },
  { id: 'settings', label: 'Paramètres', icon: Settings2 },
] as const;
function pageFromHash(): Page {
  const hash = location.hash.slice(1);
  return navigation.some((p) => p.id === hash)
    ? (hash as Page)
    : hash.includes('access_token')
      ? 'settings'
      : 'home';
}
let swRegistration: ServiceWorkerRegistration | undefined;
export function App() {
  const data = useData();
  const cloud = useCloudStatus();
  const [page, setPage] = useState<Page>(pageFromHash),
    [message, setMessage] = useState(''),
    [timer, setTimer] = useState(initialTimer),
    [online, setOnline] = useState(navigator.onLine),
    [offlineReady, setOfflineReady] = useState(false),
    [update, setUpdate] = useState(false),
    [secondaryTab, setSecondaryTab] = useState(false);
  useEffect(() => {
    let release: (() => void) | undefined;
    if (navigator.locks) {
      void navigator.locks.request('streetlift-writer', { ifAvailable: true }, async (lock) => {
        if (!lock) {
          setSecondaryTab(true);
          return;
        }
        await initialize();
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      });
    } else {
      void initialize();
    }
    return () => release?.();
  }, []);
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(''), 6500);
    return () => clearTimeout(id);
  }, [message]);
  useEffect(() => {
    const on = () => {
      setOnline(true);
      void runSync();
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  useEffect(() => {
    if (!data.ready) return;
    let cleanup = () => {};
    const setup = () => {
      cleanup();
      try {
        const client = getCloudClient();
        if (client) {
          const { data } = client.auth.onAuthStateChange(() => {
            setTimeout(() => void runSync(), 0);
          });
          cleanup = () => data.subscription.unsubscribe();
          void runSync();
        }
      } catch {
        /* Configuration is validated in settings. */
      }
    };
    setup();
    const interval = setInterval(() => void runSync(), 30000);
    window.addEventListener('streetlift-cloud-config', setup);
    return () => {
      cleanup();
      clearInterval(interval);
      window.removeEventListener('streetlift-cloud-config', setup);
    };
  }, [data.ready]);
  const dirtyVersions = data.records
    .filter((r) => r.dirty)
    .map((r) => r.version)
    .join();
  useEffect(() => {
    if (!data.ready || !dirtyVersions) return;
    const timeout = setTimeout(() => void runSync(), 2500);
    return () => clearTimeout(timeout);
  }, [data.ready, dirtyVersions]);
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
    let disposed = false;
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((registration) => {
        swRegistration = registration;
        if (registration.waiting) setUpdate(true);
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          installing?.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller)
              setUpdate(true);
          });
        });
        return navigator.serviceWorker.ready;
      })
      .then(() => {
        if (!disposed) setOfflineReady(true);
      })
      .catch(() => {
        /* Local tracking still works. */
      });
    const controller = () => {
      if (swRegistration?.waiting === null && sessionStorage.getItem('streetlift-updating')) {
        sessionStorage.removeItem('streetlift-updating');
        location.reload();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', controller);
    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener('controllerchange', controller);
    };
  }, []);
  const navigate = (next: Page) => {
    location.hash = next;
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const start = (programId: string) => {
    if (data.sessions.some((s) => s.status === 'active')) {
      navigate('workout');
      return;
    }
    const program = data.programs.find((p) => p.id === programId);
    if (!program) return;
    try {
      putPayload(
        'session',
        startSession(
          program,
          data.exercises,
          data.profile!,
          data.weights.at(-1)?.kg ?? data.profile!.bodyweight,
        ),
      );
      navigate('workout');
    } catch (error) {
      setMessage(String(error));
    }
  };
  if (secondaryTab)
    return (
      <div className="startup">
        <Dumbbell className="lime" size={36} />
        <h1>Un carnet, un onglet actif.</h1>
        <p>Ferme l’autre onglet StreetLift, puis recharge pour reprendre ici.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Recharger
        </button>
      </div>
    );
  if (!data.ready || !data.profile)
    return (
      <div className="startup">
        <Dumbbell className="lime" size={36} />
        <h1>
          StreetLift<span className="lime">.</span>
        </h1>
        <p>{data.error || 'On prépare ton carnet…'}</p>
        {data.error && (
          <button className="button primary" onClick={() => location.reload()}>
            Réessayer
          </button>
        )}
      </div>
    );
  return (
    <AppContext.Provider
      value={{
        navigate,
        toast: setMessage,
        start,
        rest: (seconds) => {
          unlockAudio();
          setTimer({ end: Date.now() + seconds * 1000, remaining: seconds, visible: true });
        },
      }}
    >
      <div className="app-shell">
        <aside className="sidebar">
          <a className="brand" href="#home" aria-label="StreetLift Accueil">
            <span className="brand-mark">
              <Dumbbell size={23} strokeWidth={2.5} />
            </span>
            <span>
              STREET<span className="lime">LIFT</span>
              <small>TRAINING JOURNAL</small>
            </span>
          </a>
          <span className="nav-caption">TON ESPACE</span>
          <nav aria-label="Navigation principale">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={page === item.id ? 'active' : ''}
                aria-current={page === item.id ? 'page' : undefined}
              >
                <item.icon size={19} />
                <span>{item.label}</span>
                {item.id === 'workout' && data.sessions.some((s) => s.status === 'active') && (
                  <i className="nav-dot" />
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-status">
              <ShieldCheck size={15} />
              <span>{offlineReady ? 'Disponible hors ligne' : 'Stockage sur cet appareil'}</span>
            </div>
            <button className="profile-button" onClick={() => navigate('settings')}>
              <span className="avatar">{data.profile.name.slice(0, 1).toUpperCase() || 'K'}</span>
              <span>
                <strong>{data.profile.name || 'Mon profil'}</strong>
                <small>STREET LIFTER · −{data.profile.category} KG</small>
              </span>
              <Settings2 size={16} />
            </button>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <a className="mobile-brand" href="#home">
              <Dumbbell size={21} />
              <strong>
                STREET<span className="lime">LIFT</span>
              </strong>
            </a>
            <div className="breadcrumb">
              <span>Mon espace</span>
              <span>/</span>
              <strong>{navigation.find((n) => n.id === page)?.label}</strong>
            </div>
            <div className="connection-status">
              {!online ? (
                <>
                  <WifiOff size={14} />
                  <span>Hors connexion · local actif</span>
                </>
              ) : data.saving ? (
                <>
                  <span className="pulse" />
                  <span>Sauvegarde…</span>
                </>
              ) : data.error ? (
                <>
                  <CloudOff size={14} />
                  <span>Erreur de sauvegarde</span>
                </>
              ) : (
                <>
                  <span className="status-dot" />
                  <span>{cloud.busy ? 'Synchronisation…' : 'Sauvegarde locale active'}</span>
                </>
              )}
            </div>
          </header>
          {update && (
            <div className="update-banner">
              <span>Une nouvelle version est disponible.</span>
              <button
                onClick={async () => {
                  try {
                    await flush();
                    sessionStorage.setItem('streetlift-updating', '1');
                    swRegistration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
                  } catch {
                    setMessage('Sauvegarde locale requise avant la mise à jour.');
                  }
                }}
              >
                Mettre à jour <ArrowRight size={14} />
              </button>
            </div>
          )}
          {data.error && (
            <div className="error-banner" role="alert">
              {data.error} <button onClick={retrySave}>Réessayer</button>
              <button onClick={() => navigate('settings')}>Ouvrir les exports</button>
            </div>
          )}
          {cloud.conflicts.length > 0 && page !== 'settings' && (
            <button className="conflict-banner" onClick={() => navigate('settings')}>
              {cloud.conflicts.length} conflit(s) de synchronisation à résoudre dans les paramètres.
              <ArrowRight size={16} />
            </button>
          )}
          <main key={page}>
            <Suspense fallback={<p className="muted">Chargement du carnet…</p>}>
              {page === 'home' ? (
                <Home />
              ) : page === 'workout' ? (
                <Workout />
              ) : page === 'progress' ? (
                <Progress />
              ) : page === 'program' ? (
                <Program />
              ) : (
                <Settings />
              )}
            </Suspense>
          </main>
          <footer className="app-footer">
            <span>
              STREETLIFT <i /> BUILT FOR THE WORK.
            </span>
            <span>Le prochain record se prépare aujourd’hui.</span>
          </footer>
        </div>
        <nav className="mobile-nav" aria-label="Navigation mobile">
          {navigation.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={page === item.id ? 'active' : ''}
              aria-current={page === item.id ? 'page' : undefined}
            >
              <item.icon size={21} />
              <span>
                {item.id === 'workout'
                  ? 'Séance'
                  : item.id === 'settings'
                    ? 'Réglages'
                    : item.label}
              </span>
            </button>
          ))}
        </nav>
        <Timer value={timer} setValue={setTimer} sound={data.profile.sound} />
        {message && (
          <div className="toast" role="status">
            <Check size={18} />
            <span>{message}</span>
            <button onClick={() => setMessage('')} aria-label="Fermer la notification">
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}
