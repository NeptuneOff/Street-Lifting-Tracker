# StreetLift Tracker

Carnet personnel de street lifting, pensé pour cocher ses séries sur téléphone. React + TypeScript + Vite, IndexedDB pour les données, PWA pour le hors connexion, Supabase pour les comptes privés et la synchronisation entre appareils. La connexion est obligatoire avant tout accès à un carnet personnel. Un espace de démonstration séparé permet de découvrir le suivi sans compte.

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

0. **Connexion** : créer son compte ou se connecter (e-mail/mot de passe ou lien par e-mail).
1. **Accueil** : choisir le jour, puis démarrer ou reprendre la séance.
2. **Entraînement** : toucher les séries réalisées. Le pic est prérempli ; cocher une série du bloc principal confirme sa réalisation. Le bouton « Valider le pic » valide ce bloc d’un geste. Ajuster charge, séries ou répétitions seulement si nécessaire. RIR et commentaire sont facultatifs.
3. **Terminer** : confirmer l’enregistrement. Une séance partielle est conservée comme telle. Les séries facultatives ne réduisent jamais le taux de réalisation. Un pic non validé est exclu des graphiques et records.
4. **Progression** : courbes par exercice, filtres de période/type/répétitions, records de singles issus du carnet, historique détaillé et poids de corps.
5. **Programme** : édition complète des jours, exercices, ordre, phases, séries, reps, charges, repos et blocs facultatifs. Duplication des séances, exercices et blocs.
6. **Paramètres** : profil, références 1RM, bibliothèque d’exercices, pesées, sauvegardes et compte Supabase.

Chaque nouveau compte reçoit une copie indépendante du programme de base, avec des références 1RM à renseigner (0 kg), 0 kg de lest et 20 kg pour les blocs de squat. Le poids du profil (75 kg) est une valeur à ajuster, pas une pesée enregistrée. **Aucune donnée personnelle ni performance d’un autre utilisateur n’est copiée.**

### Essayer le compte de démonstration

Cliquer sur **Essayer la démo** à l’accueil, ou ouvrir https://neptuneoff.github.io/Street-Lifting-Tracker/#demo. La démo fonctionne sans Supabase ni création de compte et s’ouvre directement sur la progression.

Elle contient 12 semaines de suivi entièrement fictif : quatre journées d’entraînement par semaine, charges progressives, semaines techniques légères, bilans mensuels avec singles pour les quatre mouvements, pesées régulières, RIR et commentaires. Le nombre exact suit le calendrier ; au 28 octobre 2026, le jeu représente 50 séances et 38 pesées. Les dates sont relatives au jour de première ouverture ou de réinitialisation et ne créent aucune séance future.

- Une bannière **MODE DÉMO · DONNÉES FICTIVES** reste visible sur chaque écran.
- Le programme et les séances peuvent être modifiés pour essayer les interactions. Ces changements restent dans une base locale dédiée à la démo ; aucune donnée démo n’est envoyée à Supabase.
- **Réinitialiser la démo** restaure les données fictives après confirmation, sans toucher aux carnets personnels.
- **Quitter la démo** retourne à l’accueil ou au compte déjà connecté, sans déconnecter celui-ci.
- Aucun identifiant partagé, mot de passe public ou compte réel n’est créé. Chaque navigateur dispose de sa propre copie, séparée des comptes privés.

### Programme initial : valeurs de départ

Les quatre journées reprennent la structure du cahier des charges et restent entièrement modifiables pour chaque compte. Les valeurs personnalisées de la première version (notamment le squat 40 / 60 / 80 / 60 / 50 et la traction du jeudi à +50 kg) sont conservées dans les carnets existants et leurs sauvegardes ; elles ne sont plus attribuées automatiquement aux nouveaux utilisateurs.

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

L’accès hors connexion nécessite une session utilisateur encore disponible. Si la session a expiré et ne peut pas être renouvelée sans réseau, l’écran de connexion reste fermé plutôt que d’afficher un carnet sans identité.

Le navigateur peut supprimer les données en navigation privée, après effacement des données du site ou sous pression de stockage. Un export régulier ou Supabase protège contre cette perte.

## Activer les comptes privés avec Supabase

**Sans configuration, aucun carnet personnel n’est accessible ; seule la démo fictive reste disponible.** Pour ouvrir la connexion et l’inscription à tous les visiteurs :

1. Créer un projet Supabase et activer le fournisseur **Email** avec confirmation des adresses.
2. Dans son SQL Editor, exécuter dans cet ordre [`001_training_records.sql`](supabase/migrations/001_training_records.sql) puis [`002_private_accounts.sql`](supabase/migrations/002_private_accounts.sql). Sur une installation existante ayant déjà exécuté 001, ajouter seulement 002.
3. Dans **Authentication → URL Configuration**, définir le Site URL et autoriser `https://neptuneoff.github.io/Street-Lifting-Tracker/` comme URL de redirection. Ajouter l’URL localhost si besoin pour le développement.
4. Dans GitHub → **Settings → Secrets and variables → Actions → Variables**, définir `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` avec l’URL du projet et sa clé **publique publishable** (`sb_publishable_…`) ou **anon** historique.
5. Relancer le workflow complet pour reconstruire et publier l’application avec ces variables.
6. Chaque personne crée son compte, confirme son e-mail, puis se connecte. Le prénom, les charges, les programmes, séances, pesées et références lui appartiennent. La même identité retrouve son carnet sur un deuxième appareil.

Le fournisseur e-mail et ses limites sont ceux du projet Supabase. Le formulaire propose également une connexion par lien e-mail. Aucun mot de passe utilisateur n’est sauvegardé par le code de l’application.

Pour développer, copier `.env.example` vers `.env.local`. Le volet « Configurer l’application » de l’écran de connexion peut configurer un projet sur un navigateur particulier ; les variables GitHub ci-dessus restent nécessaires pour fournir la configuration par défaut à tous les visiteurs. Une clé secret ou service_role ne doit jamais entrer dans le frontend. L’interface refuse ces clés privées.

### Isolation locale, déconnexion et migration

- Aucun écran personnel ni export n’est accessible avant connexion, y compris via un lien direct `#program` ou `#progress`.
- Chaque couple **projet Supabase + identifiant utilisateur** dispose d’une base IndexedDB distincte. Le chronomètre, la dernière synchronisation et les communications entre onglets sont également séparés.
- La déconnexion masque immédiatement les données en mémoire, remet les statuts de synchronisation à zéro et vide la session locale. Un autre compte ouvre un autre carnet. Revenir au premier compte restaure ses données, sans réaffectation.
- Les requêtes de synchronisation utilisent le JWT capturé au démarrage de l’opération. Une réponse en retard, un import de fichier ou une fin de séance suspendue ne peuvent pas écrire dans un compte devenu actif entre-temps.
- L’ancien stockage `streetlift-v1` n’est pas supprimé. Il est migré uniquement si l’ancienne association compte/projet correspond exactement au compte connecté. Un ancien carnet **sans propriétaire connu est conservé à part**, sans être attribué à la prochaine personne qui se connecte ; une sauvegarde JSON appartenant à son utilisateur peut être restaurée explicitement dans son compte.
- Les caches locaux sont stockés sur l’appareil, sans chiffrement propre à l’application. La protection contre un accès au système de fichiers ou aux outils développeur d’un navigateur partagé relève du profil de navigateur et du compte système ; utiliser des profils séparés pour ce niveau de confidentialité. La séparation des données distantes est imposée côté PostgreSQL, pas par un filtre d’affichage.

### Sécurité et résolution de conflits

- RLS activée et forcée sur chaque ligne, indexée par `(user_id, id)`, avec lecture/écriture réservées à `auth.uid()`. Une politique restrictive garde cette isolation même si une politique permissive trop large est ajoutée par erreur.
- RPC `SECURITY INVOKER`, sans élévation de privilèges et inaccessible au rôle `anon`.
- Comparaison optimiste de version UUID et verrou transactionnel côté PostgreSQL. Une modification concurrente ne peut pas écraser silencieusement une autre version.
- Les suppressions sont des tombstones synchronisés, afin d’éviter la réapparition d’une séance supprimée.
- Répéter un envoi de même version est idempotent. Les lectures distantes sont paginées.
- Les conflits sont affichés dans les paramètres, avec les deux contenus et une confirmation avant choix.
- Synchronisation après modification (délai court), au retour réseau, après authentification, toutes les 30 s tant que l’application reste ouverte, ou manuellement. Les changements hors ligne restent dans IndexedDB jusqu’à la prochaine ouverture connectée.
- Un même navigateur peut utiliser plusieurs comptes successivement : chaque espace est indépendant, sans réutilisation des données du précédent.

Documentation : https://supabase.com/docs/guides/database/postgres/row-level-security et https://supabase.com/docs/reference/javascript/auth-signinwithotp

Les politiques RLS et la RPC sont testées automatiquement dans un moteur PostgreSQL embarqué (PGlite), avec deux rôles utilisateurs et le rôle anonyme. Les parcours navigateur testent le changement de compte avec un service Auth simulé. La réception réelle des e-mails et la synchronisation PC/téléphone doivent être vérifiées sur le projet une fois configuré ; aucun projet Supabase ni identifiant utilisateur réel n’est fourni. Voir [`docs/VALIDATION.md`](docs/VALIDATION.md).

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
src/components/AccountGate.tsx  Connexion, inscription et déconnexion
src/lib/workspace.ts    Identité et périmètre de chaque carnet
src/lib/store.ts        IndexedDB séparée par compte, transactions et état React
src/lib/backup.ts       Validation, import/export JSON et CSV
src/lib/sync.ts         Supabase, versions et conflits
src/pages/              Accueil, séance, progression, programme, paramètres
scripts/build-sw.mjs    Précache versionné généré depuis le build complet
supabase/migrations/    Table, RLS et RPC
 tests/                 Logique et parcours navigateur
```

Les suggestions automatiques de charge, comparaisons de cycles et thèmes personnalisés restent des évolutions futures. Aucun algorithme ne modifie la programmation sans action de l’utilisateur.
