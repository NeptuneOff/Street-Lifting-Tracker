# StreetLift Tracker

Carnet personnel de street lifting, pensé pour cocher ses séries sur téléphone. React + TypeScript + Vite, IndexedDB pour les données, PWA pour le hors connexion, Supabase optionnel pour la synchronisation entre appareils.

**Application : https://neptuneoff.github.io/Street-Lifting-Tracker/**

## Démarrer

Node.js 24 recommandé (minimum 22.12).

```sh
npm ci
npm run dev
```

Ouvrir l’URL affichée par Vite, avec le chemin `/Street-Lifting-Tracker/`.

```sh
npm test                  # logique métier, sauvegardes, conflits, IndexedDB
npm run build             # TypeScript + production + service worker
npx playwright install chromium
npm run test:e2e          # parcours sur Pixel 7 et Chrome desktop
npm run preview           # servir le build et tester la PWA
```

Le service worker est actif uniquement dans le build de production (`preview` ou site publié), sur HTTPS ou localhost. Le développement reste sans cache PWA.

## Utilisation

1. **Accueil** : choisir le jour, puis démarrer ou reprendre la séance.
2. **Entraînement** : toucher les séries réalisées. Le pic est prérempli ; cocher une série du bloc principal confirme sa réalisation. Le bouton « Valider le pic » valide ce bloc d’un geste. Ajuster charge, séries ou répétitions seulement si nécessaire. RIR et commentaire sont facultatifs.
3. **Terminer** : confirmer l’enregistrement. Une séance partielle est conservée comme telle. Les séries facultatives ne réduisent jamais le taux de réalisation. Un pic non validé est exclu des graphiques et records.
4. **Progression** : courbes par exercice, filtres de période/type/répétitions, records de singles issus du carnet, historique détaillé et poids de corps.
5. **Programme** : édition complète des jours, exercices, ordre, phases, séries, reps, charges, repos et blocs facultatifs. Duplication des séances, exercices et blocs.
6. **Paramètres** : profil, références 1RM, bibliothèque d’exercices, pesées, sauvegardes et compte Supabase.

Les seules données initiales sont les références et les programmes. **Aucune séance historique ou pesée fictive n’est injectée.** Le poids de profil de 76,5 kg est une référence de départ, pas une mesure datée.

### Programme initial : valeurs de départ

Les quatre journées et les références reprennent le cahier des charges. Le squat du mardi reprend exactement l’exemple 40 / 60 / 80 / 60 / 50 kg. La traction du jeudi reprend +50 kg en 2×3. Le reste est une **base illustrative à ajuster**, car le programme Excel complet n’a pas été fourni. Toutes ces valeurs sont modifiables ; ce ne sont pas des recommandations personnalisées d’intensité.

Planche et Front lever restent des notes libres sans suivi imposé.

### Garantie de conservation de l’historique

Au démarrage, chaque séance reçoit une **copie profonde** du programme : nom, jour, exercice et sa définition, type de travail, blocs, charges résolues, 1RM de référence et poids de corps retenu. Les graphiques et l’historique lisent ces snapshots et les résultats réalisés. Ils ne recalculent jamais les anciennes prescriptions à partir du programme courant.

Modifier une référence, une charge fixe, un pourcentage, un exercice ou un programme concerne uniquement les **séances démarrées ensuite**. Même une séance déjà en cours reste inchangée. Supprimer un programme ne supprime pas son historique. Un import explicitement confirmé ou la suppression explicite d’une séance peuvent modifier les données restaurées ; aucune modification rétroactive silencieuse n’est effectuée.

### Charges dynamiques et statistiques

- Charge fixe : lest ajouté pour traction/dips/muscle-up ; barre totale pour squat.
- Pourcentage sur résistance totale (par défaut pour un exercice lesté) : `lest = arrondi(((poids de corps + 1RM lesté) × pourcentage) − poids de corps)`.
- Pourcentage sur lest seul : `lest = arrondi(1RM lesté × pourcentage)`.
- Squat : `charge = arrondi(1RM barre × pourcentage)`.
- L’arrondi utilise l’incrément choisi dans le profil. Un lest négatif représente une assistance.
- La dernière pesée datée sert aux nouvelles séances ; à défaut, le poids du profil est utilisé.
- Chaque série graphique conserve son type et son format séries×reps. La tendance compare les deux derniers pics du même exercice, type, nombre de séries et de reps, avec un écart de RIR ≤1 si les deux RIR sont connus, et un poids de corps à ±1,5 kg pour les exercices lestés. Sinon : données insuffisantes. Il s’agit d’un indicateur descriptif, pas d’un ajustement automatique de programmation.
- Le mode « 1RM estimé » applique Epley sur 2 à 10 répétitions, sur la résistance totale pour les exercices lestés, puis soustrait le poids du corps. Un single conserve sa charge réelle. Ces valeurs sont explicitement séparées des records réalisés.
- Les références déclarées (+80 traction, +110 dips, +20 muscle-up à revalider, 105 squat estimé) ne deviennent jamais des records datés du carnet sans séance correspondante.

## Publier sur GitHub Pages

Le workflow `.github/workflows/deploy.yml` teste, compile, exécute les parcours navigateur, puis déploie `dist` lorsque `main` change. Les pull requests exécutent les vérifications sans publication.

**Réglage initial du dépôt** : `Settings → Pages → Build and deployment → Source: GitHub Actions`.

Le workflow nécessite GitHub Actions activé et les permissions `pages: write` et `id-token: write` (déclarées uniquement sur le job de déploiement). Si l’environnement `github-pages` impose une validation, l’autoriser dans GitHub. Le chemin Vite est `/Street-Lifting-Tracker/`, injecté depuis le nom du dépôt en CI. Pour un autre hébergement, définir `VITE_BASE_PATH=/` avant de compiler. La navigation utilise un hash, sans réécriture serveur.

Documentation Vite : https://vite.dev/guide/static-deploy.html#github-pages

## Installer et utiliser hors connexion

Après un premier chargement complet en ligne, le service worker précache **tous** les écrans et icônes, y compris les modules chargés à la demande. Android/Chrome : « Installer l’application ». iPhone/Safari : Partager → Sur l’écran d’accueil. Desktop Chrome/Edge : bouton d’installation de la barre d’adresse.

IndexedDB conserve les programmes, séances en cours, résultats, pesées et modifications à synchroniser. Les écritures sont transactionnelles et sérialisées. L’interface signale la sauvegarde et toute erreur de stockage. Attendre l’état « Sauvegardé en local » avant de fermer immédiatement après une interaction. Un seul onglet est autorisé à modifier le carnet lorsque Web Locks est disponible. Sans Web Locks, éviter plusieurs onglets simultanés.

Une mise à jour PWA n’impose pas de rechargement au milieu de la séance : le bouton de mise à jour attend les écritures avant de basculer. Le chronomètre utilise une échéance absolue, conservée localement, pour rester correct après navigation ou rechargement. Le son/vibration dépend du navigateur ; **aucune alarme en arrière-plan n’est garantie lorsque l’application est fermée**.

Le navigateur peut supprimer les données en navigation privée, après effacement des données du site ou sous pression de stockage. Un export régulier ou Supabase protège contre cette perte.

## Configurer Supabase (optionnel)

L’application locale ne nécessite aucune clé et aucun compte. Pour synchroniser :

1. Créer un projet Supabase.
2. Exécuter [`supabase/migrations/001_training_records.sql`](supabase/migrations/001_training_records.sql) dans son SQL Editor.
3. Activer l’authentification Email. Dans **Authentication → URL Configuration**, définir le Site URL et ajouter l’URL de redirection : `https://neptuneoff.github.io/Street-Lifting-Tracker/` (et l’URL localhost de développement si nécessaire).
4. Dans StreetLift → Paramètres, saisir l’URL du projet et sa **clé publique publishable** (`sb_publishable_…`) ou **anon** historique.
5. Enregistrer, saisir son e-mail, puis utiliser le lien de connexion reçu **sur le même appareil/navigateur**. Le fournisseur e-mail et ses limites sont ceux de ton projet Supabase.
6. Synchroniser. Sur le second appareil, configurer le même projet et se connecter au même compte. Les valeurs de départ intactes cèdent automatiquement la place aux données distantes.

Alternative au paramétrage dans l’interface : copier `.env.example` en `.env.local` pour le développement. Pour GitHub Actions, créer les **variables publiques** de dépôt `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`. Les variables Vite sont intégrées au JavaScript public : **ne jamais y mettre une clé secret ou service_role**. L’interface refuse ces clés privées. Les jetons d’authentification restent dans le navigateur et sont exclus des exports.

### Sécurité et résolution de conflits

- RLS sur chaque ligne, indexée par `(user_id, id)`, avec lecture/écriture réservées à `auth.uid()`.
- RPC `SECURITY INVOKER`, sans élévation de privilèges et inaccessible au rôle `anon`.
- Comparaison optimiste de version UUID et verrou transactionnel côté PostgreSQL. Une modification concurrente ne peut pas écraser silencieusement une autre version.
- Les suppressions sont des tombstones synchronisés, afin d’éviter la réapparition d’une séance supprimée.
- Répéter un envoi de même version est idempotent. Les lectures distantes sont paginées.
- Les conflits sont affichés dans les paramètres, avec les deux contenus et une confirmation avant choix.
- Synchronisation après modification (délai court), au retour réseau, après authentification, toutes les 30 s tant que l’application reste ouverte, ou manuellement. Les changements hors ligne restent dans IndexedDB jusqu’à la prochaine ouverture connectée.
- Un carnet local est lié au premier couple compte/projet utilisé. Changer de compte n’envoie pas automatiquement les données au nouveau compte ; utiliser un autre profil de navigateur pour un autre compte.

Documentation : https://supabase.com/docs/guides/database/postgres/row-level-security et https://supabase.com/docs/reference/javascript/auth-signinwithotp

La connexion PC/téléphone et les politiques RLS doivent être vérifiées sur ton projet une fois configuré ; aucun projet Supabase réel ni identifiant n’est fourni avec ce dépôt. Voir [`docs/VALIDATION.md`](docs/VALIDATION.md).

## Sauvegarder et importer

- JSON : export complet versionné, incluant snapshots et suppressions ; import validé avant toute écriture.
- Restauration : **confirmation explicite** avant remplacement d’identifiants existants. Téléchargement d’un export de sécurité préalable. Les identifiants absents du fichier restent conservés. Un même fichier réimporté ne duplique pas ses séances.
- CSV historique : séparateur `;`, UTF-8 avec BOM, champs cités et protection contre les formules de tableur.
- Excel : exporter un tableau simple en CSV UTF-8 `;` suivant le modèle téléchargeable dans les paramètres. Ce format ne gère pas de séparateur ou de saut de ligne à l’intérieur d’une cellule. Les lignes invalides entraînent le rejet complet. L’import de programme ajoute des séances avec de nouveaux identifiants, après confirmation ; ne pas importer plusieurs fois le même CSV sans supprimer les copies.

Colonnes du programme CSV :

```csv
jour;seance;exercice;type;phase;series;reps;mode;charge;repos;facultatif;base
Mardi;Squat & statiques;squat;Force;Montée;1;3;fixed;40;180;non;total
Mardi;Squat & statiques;squat;Force;Pic;3;3;fixed;80;300;non;total
```

`exercice` : identifiant affiché dans les paramètres (`pullup`, `dip`, `muscleup`, `squat`, ou identifiant personnalisé). `type` : Force/Volume/Technique. `phase` : Échauffement/Montée/Pic/Volume/Facultatif. `mode` : fixed/percent. `charge` : kg ou pourcentage selon le mode. `repos` : secondes. `facultatif` : oui/non. `base` : total/added. Pour un exercice, le **premier bloc Pic** alimente le résultat principal ; à défaut, le premier bloc obligatoire, puis le premier bloc. Les autres blocs restent consultables et cochables.

## Organisation du code

```text
src/lib/types.ts        Entités, prescriptions et snapshots
src/lib/seed.ts         Programme initial modifiable
src/lib/training.ts     Calculs, validation de séries et tendances
src/lib/store.ts        IndexedDB, transactions et état React
src/lib/backup.ts       Validation, import/export JSON et CSV
src/lib/sync.ts         Supabase, versions et conflits
src/pages/              Accueil, séance, progression, programme, paramètres
scripts/build-sw.mjs    Précache versionné généré depuis le build complet
supabase/migrations/    Table, RLS et RPC
 tests/                 Logique et parcours navigateur
```

Les suggestions automatiques de charge, comparaisons de cycles et thèmes personnalisés restent des évolutions futures. Aucun algorithme ne modifie la programmation sans action de l’utilisateur.
