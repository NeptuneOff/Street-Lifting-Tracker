import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Dumbbell, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { clearWorkspace, flush, getWorkspaceKey, initialize } from '../lib/store';
import {
  authStorageKey,
  legacyAuthStorageKey,
  getCloudClient,
  getCloudConfig,
  validateConfig,
} from '../lib/sync';
import { resetCloudStatus } from '../lib/cloud-status';
import { workspaceKey, type WorkspaceIdentity } from '../lib/workspace';
import { Button } from './UI';
import { usePWARegistration } from '../lib/pwa';

interface Account {
  identity: WorkspaceIdentity;
  signOut: () => Promise<void>;
}
const AccountContext = createContext<Account | null>(null);
export function useAccount() {
  const account = useContext(AccountContext);
  if (!account) throw new Error('Connexion requise.');
  return account;
}
export function AccountGate({ children }: { children: ReactNode }) {
  usePWARegistration();
  const [identity, setIdentity] = useState<WorkspaceIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [message, setMessage] = useState('');
  const attempt = useRef(0);
  const desired = useRef<string | null>(null);
  const signingOut = useRef(false);
  const applyRef = useRef<(session: Session | null) => void>(() => {});
  useEffect(() => {
    let unsubscribe = () => {};
    let disposed = false;
    const setup = () => {
      unsubscribe();
      attempt.current++;
      desired.current = null;
      clearWorkspace();
      resetCloudStatus();
      setIdentity(null);
      setLoading(true);
      try {
        const cloud = getCloudClient();
        setConfigured(!!cloud);
        if (!cloud) {
          setLoading(false);
          return;
        }
        const apply = (session: Session | null) => {
          if (disposed || signingOut.current) return;
          const next: WorkspaceIdentity | null = session
            ? {
                project: new URL(getCloudConfig().url).origin,
                userId: session.user.id,
                name: String(
                  session.user.user_metadata?.name ||
                    session.user.email?.split('@')[0] ||
                    'Athlète',
                ).slice(0, 50),
                email: session.user.email || '',
              }
            : null;
          const key = next ? workspaceKey(next) : null;
          if (key && desired.current === key) return;
          const ticket = ++attempt.current;
          desired.current = key;
          clearWorkspace();
          resetCloudStatus();
          setIdentity(null);
          setLoading(!!next);
          if (!next) return;
          // Never await Supabase operations inside its synchronous auth callback.
          setTimeout(async () => {
            if (disposed || ticket !== attempt.current) return;
            await initialize(next);
            if (disposed || ticket !== attempt.current || desired.current !== key) return;
            setIdentity(next);
            setLoading(false);
          }, 0);
        };
        applyRef.current = apply;
        const { data } = cloud.auth.onAuthStateChange((_event, session) => apply(session));
        unsubscribe = () => data.subscription.unsubscribe();
        void cloud.auth
          .getSession()
          .then(({ data, error }) => {
            if (disposed) return;
            if (error) {
              apply(null);
              setMessage('Connexion indisponible. Réessaie lorsque le réseau est disponible.');
            } else apply(data.session);
          })
          .catch(() => {
            if (!disposed) {
              apply(null);
              setMessage('Impossible de vérifier la connexion.');
            }
          });
      } catch {
        setConfigured(false);
        setLoading(false);
        setMessage('La configuration de connexion doit être corrigée.');
      }
    };
    setup();
    window.addEventListener('streetlift-cloud-config', setup);
    return () => {
      disposed = true;
      attempt.current++;
      unsubscribe();
      clearWorkspace();
      window.removeEventListener('streetlift-cloud-config', setup);
    };
  }, []);
  const signOut = async () => {
    signingOut.current = true;
    const pending = flush();
    attempt.current++;
    desired.current = null;
    clearWorkspace();
    resetCloudStatus();
    setIdentity(null);
    setLoading(true);
    try {
      await pending;
    } catch {
      /* Unsaved changes stay in the owner's in-memory workspace. */
    }
    try {
      await getCloudClient()?.auth.signOut({ scope: 'local' });
    } finally {
      localStorage.removeItem(authStorageKey(getCloudConfig().url));
      localStorage.removeItem(legacyAuthStorageKey(getCloudConfig().url));
      location.replace(new URL(import.meta.env.BASE_URL, location.origin).href);
    }
  };
  if (loading)
    return (
      <div className="startup">
        <Dumbbell className="lime" size={36} />
        <h1>
          StreetLift<span className="lime">.</span>
        </h1>
        <p>{signingOut.current ? 'Déconnexion…' : 'Ouverture de ton espace privé…'}</p>
      </div>
    );
  if (identity && getWorkspaceKey() === workspaceKey(identity))
    return (
      <AccountContext.Provider key={workspaceKey(identity)} value={{ identity, signOut }}>
        {children}
      </AccountContext.Provider>
    );
  return (
    <SignIn
      configured={configured}
      initialMessage={message}
      onSession={(session) => applyRef.current(session)}
    />
  );
}
function SignIn({
  configured,
  initialMessage,
  onSession,
}: {
  configured: boolean;
  initialMessage: string;
  onSession: (session: Session | null) => void;
}) {
  const [creating, setCreating] = useState(false),
    [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(initialMessage);
  const [config, setConfig] = useState(getCloudConfig);
  const redirect = new URL(import.meta.env.BASE_URL, location.origin).href;
  const submit = async (magic = false) => {
    if (busy) return;
    const cloud = getCloudClient();
    if (!cloud) return;
    setBusy(true);
    setMessage('');
    try {
      if (magic) {
        const { error } = await cloud.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirect },
        });
        if (error) throw error;
        setMessage('Lien envoyé. Ouvre ton e-mail sur cet appareil pour te connecter.');
      } else if (creating) {
        const { data, error } = await cloud.auth.signUp({
          email,
          password,
          options: { data: { name: name.trim() }, emailRedirectTo: redirect },
        });
        if (error) throw error;
        if (data.session) onSession(data.session);
        else setMessage('Vérifie ta boîte e-mail pour confirmer ton compte, puis connecte-toi.');
      } else {
        const { data, error } = await cloud.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSession(data.session);
      }
    } catch {
      setMessage(
        creating
          ? 'Création impossible. Vérifie les informations ou essaie de te connecter.'
          : 'Connexion impossible. Vérifie tes identifiants et ta connexion.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="account-page">
      <div className="account-brand">
        <Dumbbell size={29} />
        <span>
          STREET<span className="lime">LIFT</span>
        </span>
      </div>
      <section className="card account-card">
        <div className="account-lock">
          <LockKeyhole size={25} />
        </div>
        <div className="eyebrow">TON ESPACE PERSONNEL</div>
        <h1>
          Ton programme.
          <br />
          <span className="lime">Rien qu’à toi.</span>
        </h1>
        <p className="muted small">
          Connecte-toi pour retrouver tes séances, tes charges et ta progression. Chaque compte
          possède son propre carnet privé.
        </p>
        {configured ? (
          <>
            <div className="segmented">
              <button
                className={!creating ? 'selected' : ''}
                onClick={() => {
                  setCreating(false);
                  setMessage('');
                }}
              >
                Connexion
              </button>
              <button
                className={creating ? 'selected' : ''}
                onClick={() => {
                  setCreating(true);
                  setMessage('');
                }}
              >
                Créer un compte
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              {creating && (
                <label className="field">
                  <span>Prénom</span>
                  <input
                    required
                    autoComplete="given-name"
                    maxLength={50}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              )}
              <label className="field">
                <span>Adresse e-mail</span>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Mot de passe</span>
                <input
                  required
                  type="password"
                  autoComplete={creating ? 'new-password' : 'current-password'}
                  minLength={creating ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <Button className="primary wide" disabled={busy}>
                {busy ? 'Connexion…' : creating ? 'Créer mon espace' : 'Se connecter'}
                <ShieldCheck size={17} />
              </Button>
            </form>
            <Button
              className="secondary wide magic-link"
              disabled={busy || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
              onClick={() => void submit(true)}
            >
              <Mail size={16} />
              Recevoir un lien par e-mail
            </Button>
          </>
        ) : (
          <>
            <div className="note">
              Les comptes privés ne sont pas encore activés. L’administrateur doit configurer le
              service de connexion.
            </div>
            <details className="account-setup">
              <summary>Configurer l’application</summary>
              <p className="small muted">
                Utilise les paramètres publics de ton projet Supabase. Pour tous les visiteurs,
                définis-les dans les variables de déploiement du dépôt.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  try {
                    validateConfig(config);
                    localStorage.setItem('streetlift-cloud', JSON.stringify(config));
                    window.dispatchEvent(new Event('streetlift-cloud-config'));
                  } catch {
                    setMessage('Utilise une URL HTTPS et une clé publique Supabase valide.');
                  }
                }}
              >
                <label className="field">
                  <span>URL du projet Supabase</span>
                  <input
                    required
                    type="url"
                    value={config.url}
                    onChange={(e) => setConfig({ ...config, url: e.target.value.trim() })}
                  />
                </label>
                <label className="field">
                  <span>Clé publique publishable ou anon</span>
                  <input
                    required
                    value={config.key}
                    onChange={(e) => setConfig({ ...config, key: e.target.value.trim() })}
                  />
                </label>
                <Button className="secondary wide">Activer la connexion</Button>
              </form>
            </details>
          </>
        )}
        {message && (
          <p className="account-message" role="status">
            {message}
          </p>
        )}
        <div className="account-privacy">
          <ShieldCheck size={15} />
          <span>Aucun carnet accessible sans connexion.</span>
        </div>
      </section>
    </div>
  );
}
