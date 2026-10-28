import { useEffect, useRef, useState } from 'react';
import {
  Cloud,
  Download,
  FileUp,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { flush, getState, putPayload, removeRecord, replaceRecords, useData } from '../lib/store';
import { uid } from '../lib/seed';
import {
  backupJSON,
  downloadFile,
  historyCSV,
  parseBackup,
  parseProgramCSV,
  validatePayload,
} from '../lib/backup';
import { resolveConflict } from '../lib/sync';
import { useAccount } from '../components/AccountGate';
import { getWorkspaceKey, workspaceStorageKey, assertWorkspace } from '../lib/store';
import { runSync, useCloudStatus } from '../lib/cloud-status';
import { localDate, number } from '../lib/training';
import type { Exercise, Profile } from '../lib/types';
import { Button, IconButton, Modal, Note, NumberField, PageTitle, useApp } from '../components/UI';

function ProfileSettings() {
  const { profile } = useData();
  const { toast } = useApp();
  const [draft, setDraft] = useState<Profile>(profile!);
  const baseline = useRef(JSON.stringify(profile));
  useEffect(() => {
    if (JSON.stringify(draft) === baseline.current) {
      setDraft(profile!);
      baseline.current = JSON.stringify(profile);
    }
  }, [profile]);
  return (
    <section className="card settings-card">
      <div className="section-head">
        <h2>Le profil</h2>
        <span className="tag">STREET LIFTING</span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!validatePayload('profile', draft)) return toast('Vérifie les valeurs du profil.');
          if (
            JSON.stringify(profile) !== baseline.current &&
            !window.confirm(
              'Le profil a changé pendant ton édition. Remplacer sa version actuelle ?',
            )
          )
            return;
          baseline.current = JSON.stringify(draft);
          putPayload('profile', draft);
          toast('Profil enregistré.');
        }}
      >
        <div className="form-row">
          <label className="field">
            <span>Prénom</span>
            <input
              value={draft.name}
              maxLength={50}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <NumberField
            label="Poids de référence (kg)"
            value={draft.bodyweight}
            min={20}
            max={350}
            onValue={(bodyweight) => setDraft({ ...draft, bodyweight })}
          />
          <NumberField
            label="Limite de catégorie (kg)"
            value={draft.category}
            min={20}
            max={350}
            onValue={(category) => setDraft({ ...draft, category })}
          />
          <label className="field">
            <span>Incrément d’arrondi (kg)</span>
            <select
              value={draft.increment}
              onChange={(e) => setDraft({ ...draft, increment: Number(e.target.value) })}
            >
              {[0.25, 0.5, 1, 1.25, 2.5, 5].map((n) => (
                <option key={n} value={n}>
                  {number(n)} kg
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={draft.autoRest}
            onChange={(e) => setDraft({ ...draft, autoRest: e.target.checked })}
          />{' '}
          Démarrer le repos après chaque série cochée
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={draft.sound}
            onChange={(e) => setDraft({ ...draft, sound: e.target.checked })}
          />{' '}
          Son et vibration à la fin du repos, si disponibles
        </label>
        <Button className="secondary" type="submit">
          <Save size={16} />
          Enregistrer le profil
        </Button>
      </form>
    </section>
  );
}
function ReferenceSettings() {
  const { exercises, programs } = useData();
  const { toast } = useApp();
  const [draft, setDraft] = useState<Exercise | null>(null);
  return (
    <section className="card settings-card">
      <div className="section-head">
        <h2>Exercices & références</h2>
        <IconButton
          label="Ajouter un exercice personnalisé"
          onClick={() =>
            setDraft({
              id: uid(),
              name: 'Nouvel exercice',
              shortName: 'Exercice',
              weighted: true,
              reference: 0,
              reliability: 'Estimation',
            })
          }
        >
          <Plus size={20} />
        </IconButton>
      </div>
      <p className="muted small">
        Ces valeurs pilotent uniquement les futures charges en pourcentage. Le lest est exprimé hors
        poids de corps.
      </p>
      <div className="reference-settings">
        {exercises.map((e) => (
          <button key={e.id} onClick={() => setDraft({ ...e })}>
            <span>
              <strong>{e.name}</strong>
              <small>{e.reliability}</small>
            </span>
            <b>
              {e.weighted && e.reference > 0 ? '+' : ''}
              {number(e.reference)} kg
            </b>
            <span className="text-link">Modifier</span>
          </button>
        ))}
      </div>
      {draft && (
        <Modal title="Référence d’exercice" close={() => setDraft(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!validatePayload('exercise', draft))
                return toast('Vérifie les valeurs de l’exercice.');
              putPayload('exercise', draft);
              setDraft(null);
              toast('Référence mise à jour. Historique conservé.');
            }}
          >
            <label className="field">
              <span>Nom</span>
              <input
                value={draft.name}
                required
                maxLength={80}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Nom court</span>
              <input
                value={draft.shortName}
                required
                maxLength={40}
                onChange={(e) => setDraft({ ...draft, shortName: e.target.value })}
              />
            </label>
            <NumberField
              label="1RM de référence (kg)"
              value={draft.reference}
              min={0}
              max={1000}
              onValue={(reference) => setDraft({ ...draft, reference })}
            />
            <label className="field">
              <span>Nature de la référence</span>
              <select
                value={draft.reliability}
                onChange={(e) =>
                  setDraft({ ...draft, reliability: e.target.value as Exercise['reliability'] })
                }
              >
                {['Record réalisé', 'Estimation', 'À revalider'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.weighted}
                onChange={(e) => setDraft({ ...draft, weighted: e.target.checked })}
              />{' '}
              Charge = lest ajouté au poids de corps
            </label>
            <Note>
              Une référence « record réalisé » conserve son statut déclaré. Les records datés du
              tableau de bord sont issus de tes séances enregistrées.
            </Note>
            <div className="modal-footer">
              <Button className="primary" type="submit">
                Enregistrer la référence
              </Button>
              {exercises.some((e) => e.id === draft.id) && (
                <Button
                  className="danger"
                  type="button"
                  disabled={
                    programs.some((p) => p.exercises.some((e) => e.exerciseId === draft.id)) ||
                    exercises.length <= 1
                  }
                  onClick={() => {
                    if (
                      window.confirm(
                        'Supprimer cet exercice ? Ses anciennes performances seront conservées.',
                      )
                    ) {
                      removeRecord(draft.id);
                      setDraft(null);
                    }
                  }}
                >
                  <Trash2 size={16} />
                  Supprimer
                </Button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
function WeightSettings() {
  const { weights, profile } = useData();
  const { toast } = useApp();
  const [kg, setKg] = useState(weights.at(-1)?.kg ?? profile!.bodyweight),
    [date, setDate] = useState(localDate());
  return (
    <section className="card settings-card">
      <h2>Les pesées</h2>
      <p className="muted small">
        Ponctuelles, quand tu le souhaites. La dernière pesée sert de poids de corps aux prochaines
        séances.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const same = weights.find((w) => w.date === date);
          if (
            same &&
            !window.confirm(
              `Remplacer la pesée de ${number(same.kg)} kg du ${new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR')} ?`,
            )
          )
            return;
          const weight = { id: same?.id ?? uid(), date, kg };
          if (!validatePayload('weight', weight)) return toast('Pesée invalide.');
          putPayload('weight', weight);
          toast('Pesée enregistrée.');
        }}
      >
        <div className="form-row">
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              required
              value={date}
              max={localDate()}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <NumberField label="Poids (kg)" min={20} max={350} value={kg} onValue={setKg} />
        </div>
        <Button className="secondary" type="submit">
          <Plus size={16} />
          Enregistrer la pesée
        </Button>
      </form>
      {weights.length > 0 && (
        <details className="weight-history">
          <summary>{weights.length} pesée(s) enregistrée(s)</summary>
          {[...weights].reverse().map((w) => (
            <div className="weight-history-row" key={w.id}>
              <span>{new Date(`${w.date}T12:00:00`).toLocaleDateString('fr-FR')}</span>
              <strong>{number(w.kg)} kg</strong>
              <IconButton
                label={`Supprimer la pesée du ${w.date}`}
                onClick={() => {
                  if (window.confirm('Supprimer cette pesée ?')) removeRecord(w.id);
                }}
              >
                <Trash2 size={15} />
              </IconButton>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
function BackupSettings() {
  const { exercises } = useData();
  const { toast } = useApp();
  const jsonInput = useRef<HTMLInputElement>(null),
    csvInput = useRef<HTMLInputElement>(null);
  const importJSON = async (file: File) => {
    const scope = getWorkspaceKey()!;
    try {
      const imported = parseBackup(await file.text());
      assertWorkspace(scope);
      const current = getState().records;
      const overlaps = imported.filter((r) => current.some((c) => c.id === r.id)).length;
      if (
        !window.confirm(
          `Importer ${imported.length} éléments ? ${overlaps} éléments existants de même identifiant seront remplacés. Les autres données seront conservées. Un export de sécurité sera téléchargé avant l’import.`,
        )
      )
        return;
      downloadFile(`streetlift-avant-import-${localDate()}.json`, backupJSON(current));
      replaceRecords(
        imported.map((r) => ({
          ...r,
          baseVersion: current.find((c) => c.id === r.id)?.baseVersion ?? null,
        })),
      );
      await flush();
      assertWorkspace(scope);
      toast('Sauvegarde importée.');
      window.dispatchEvent(new Event('streetlift-imported'));
    } catch (error) {
      if (getWorkspaceKey() !== scope) return;
      toast(`Import refusé : ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  return (
    <section className="card settings-card">
      <h2>Tes données, sous ton contrôle.</h2>
      <p className="muted small">
        L’export JSON inclut le programme, les séances en cours, l’historique et les pesées. Les
        identifiants de connexion sont exclus.
      </p>
      <div className="backup-actions">
        <Button
          className="secondary"
          onClick={() =>
            downloadFile(`streetlift-${localDate()}.json`, backupJSON(getState().records))
          }
        >
          <Download size={16} />
          Exporter tout · JSON
        </Button>
        <Button
          className="secondary"
          onClick={() =>
            downloadFile(
              `streetlift-historique-${localDate()}.csv`,
              historyCSV(getState().records),
              'text/csv;charset=utf-8',
            )
          }
        >
          <Download size={16} />
          Historique · CSV
        </Button>
        <Button className="secondary" onClick={() => jsonInput.current?.click()}>
          <FileUp size={16} />
          Restaurer un JSON
        </Button>
      </div>
      <input
        ref={jsonInput}
        hidden
        type="file"
        accept=".json,application/json"
        aria-label="Fichier de sauvegarde JSON"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importJSON(f);
          e.target.value = '';
        }}
      />
      <details className="csv-import">
        <summary>Importer un programme depuis Excel</summary>
        <p className="small muted">
          Exporte ton tableau en CSV UTF-8 à séparateur point-virgule, avec les colonnes du modèle.
          Chaque import ajoute des séances, sans remplacer les existantes.
        </p>
        <div className="backup-actions">
          <Button
            className="secondary"
            onClick={() =>
              downloadFile(
                'streetlift-modele-programme.csv',
                '\uFEFFjour;seance;exercice;type;phase;series;reps;mode;charge;repos;facultatif;base\nMardi;Squat & statiques;squat;Force;Montée;1;3;fixed;40;180;non;total\nMardi;Squat & statiques;squat;Force;Pic;3;3;fixed;80;300;non;total\n',
                'text/csv;charset=utf-8',
              )
            }
          >
            <Download size={15} />
            Modèle CSV
          </Button>
          <Button className="secondary" onClick={() => csvInput.current?.click()}>
            <FileUp size={15} />
            Importer le programme
          </Button>
        </div>
        <p className="small muted">
          Identifiants d’exercices : {exercises.map((e) => `${e.shortName} = ${e.id}`).join(' · ')}
        </p>
      </details>
      <input
        ref={csvInput}
        hidden
        type="file"
        accept=".csv,text/csv"
        aria-label="Fichier programme CSV"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          const scope = getWorkspaceKey()!;
          try {
            const programs = parseProgramCSV(await f.text(), new Set(exercises.map((e) => e.id)));
            assertWorkspace(scope);
            if (!window.confirm(`Ajouter ${programs.length} séance(s) au programme ?`)) return;
            programs.forEach((p) => putPayload('program', p));
            await flush();
            assertWorkspace(scope);
            toast('Programme CSV importé.');
          } catch (error) {
            if (getWorkspaceKey() !== scope) return;
            toast(String(error));
          }
        }}
      />
    </section>
  );
}
function CloudSettings() {
  const { records } = useData();
  const { toast } = useApp();
  const status = useCloudStatus();
  const { identity, signOut } = useAccount();
  const scope = getWorkspaceKey()!;
  return (
    <section className="card settings-card">
      <div className="section-head">
        <h2>
          <Cloud size={21} /> Synchronisation
        </h2>
        <span className="tag">COMPTE PRIVÉ</span>
      </div>
      <p className="muted small">
        Ton programme, ton historique et tes pesées appartiennent uniquement à ton compte.
      </p>
      <div className="signed-in">
        <ShieldCheck size={18} />
        <span>{identity.email}</span>
        <IconButton label="Se déconnecter" onClick={() => void signOut()}>
          <LogOut size={17} />
        </IconButton>
      </div>
      <Button
        className="primary"
        disabled={status.busy || !navigator.onLine}
        onClick={() => void runSync()}
      >
        <RefreshCw size={16} className={status.busy ? 'spin' : ''} />
        {status.busy ? 'Synchronisation…' : 'Synchroniser maintenant'}
      </Button>
      <p className="small muted" role="status">
        {status.message ||
          `${records.filter((r) => r.dirty).length} élément(s) en attente de synchronisation.`}
      </p>
      {localStorage.getItem(workspaceStorageKey('last-sync')) && (
        <p className="small muted">
          Dernier échange :{' '}
          {new Date(localStorage.getItem(workspaceStorageKey('last-sync'))!).toLocaleString(
            'fr-FR',
          )}
        </p>
      )}
      {status.conflicts.length > 0 && (
        <div className="conflicts">
          <h3>{status.conflicts.length} conflit(s) à résoudre</h3>
          <p className="small muted">
            Le même élément a changé sur deux appareils. Compare les versions avant de choisir.
          </p>
          {status.conflicts.map((c) => (
            <div className="conflict" key={c.id}>
              <strong>
                {'name' in c.local.payload
                  ? c.local.payload.name
                  : 'programName' in c.local.payload
                    ? c.local.payload.programName
                    : c.local.kind}
              </strong>
              <div className="conflict-versions">
                {[
                  { title: 'Cet appareil', record: c.local.payload, deleted: c.local.deleted },
                  {
                    title: 'Version distante',
                    record: c.remote.payload,
                    deleted: c.remote.deleted,
                  },
                ].map((v) => (
                  <details key={v.title}>
                    <summary>
                      {v.title}
                      {v.deleted ? ' · supprimé' : ''}
                    </summary>
                    <pre>{JSON.stringify(v.record, null, 2)}</pre>
                  </details>
                ))}
              </div>
              <div className="backup-actions">
                <Button
                  className="secondary"
                  onClick={() => {
                    if (window.confirm('Conserver la version de cet appareil pour cet élément ?')) {
                      resolveConflict(c, 'local', scope);
                      void runSync();
                    }
                  }}
                >
                  Garder cet appareil
                </Button>
                <Button
                  className="secondary"
                  onClick={() => {
                    if (window.confirm('Remplacer cet élément par la version distante ?')) {
                      resolveConflict(c, 'remote', scope);
                      void runSync();
                    }
                  }}
                >
                  Utiliser la distante
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="footnote">
        Après déconnexion, le carnet est masqué. Un autre compte ouvre son propre espace, y compris
        sur le même navigateur.
      </p>
    </section>
  );
}
export function Settings() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const listener = () => setRevision((r) => r + 1);
    window.addEventListener('streetlift-imported', listener);
    return () => window.removeEventListener('streetlift-imported', listener);
  }, []);
  return (
    <>
      <PageTitle eyebrow="FAIS-EN TON CARNET" title="Les réglages, simplement." />
      <div className="settings-grid">
        <div>
          <ProfileSettings key={`profile-${revision}`} />
          <ReferenceSettings />
          <WeightSettings key={`weight-${revision}`} />
        </div>
        <div>
          <CloudSettings />
          <BackupSettings />
          <section className="card settings-card install-help">
            <span className="eyebrow">TON CARNET DANS LA POCHE</span>
            <h2>Installer StreetLift</h2>
            <p className="small muted">
              Android / Chrome : menu ⋮ → Installer l’application.
              <br />
              iPhone / Safari : Partager → Sur l’écran d’accueil.
              <br />
              PC / Chrome ou Edge : bouton d’installation dans la barre d’adresse.
            </p>
            <p className="small muted">
              Charge une première fois l’application en ligne. Tu pourras ensuite consulter, cocher
              et enregistrer hors connexion. Le son du repos dépend du navigateur et n’est pas
              garanti lorsque l’application est fermée.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
