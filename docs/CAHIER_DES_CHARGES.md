# Cahier des charges — StreetLift Tracker

**Projet :** Application personnelle de suivi d'entraînement en street lifting
**Plateforme :** Web, mobile et PC
**Hébergement :** GitHub Pages
**Sauvegarde :** Locale + synchronisation Supabase
**Objectif :** Application fonctionnelle, installable sur téléphone et utilisable hors connexion.

---

## 1. Présentation du projet

Développer une application web dédiée à la pratique du street lifting, permettant de consulter un programme d'entraînement, suivre les séries réalisées et analyser la progression sportive.

L'application remplacera l'utilisation d'Excel pendant les séances, tout en reprenant sa logique de programmation.

**Principe fondamental : minimiser la saisie manuelle.**

L'utilisateur doit pouvoir rester concentré sur son entraînement. Quelques interactions suffisent pour valider une séance et enregistrer ses performances.

L'interface doit être conçue prioritairement pour smartphone.

## 2. Profil sportif initial

| Paramètre | Valeur |
|---|---|
| Âge | 20 ans |
| Taille | 180 cm |
| Poids | Environ 76–77 kg |
| Catégorie de compétition | -80 kg |
| Discipline principale | Street lifting |
| Fréquence d'entraînement | 4 jours/semaine |

### Records de référence

| Exercice | Référence | Fiabilité |
|---|---|---|
| Traction lestée | +80 kg | Record personnel |
| Dips lestés | +110 kg | Record personnel |
| Muscle-up lesté | +20 kg | Ancien record à revalider |
| Squat | 105 kg | 1RM de programmation estimé |

Ces valeurs doivent être modifiables à tout moment.

Les charges des exercices lestés représentent le **lest ajouté**, tandis que les charges au squat représentent la charge totale de la barre.

## 3. Organisation hebdomadaire

| Jour | Exercices | Priorité |
|---|---|---|
| Lundi | Traction, Dips, Muscle-up | Traction |
| Mardi | Squat, Planche, Front Lever | Squat |
| Mercredi | Repos | — |
| Jeudi | Muscle-up, Traction, Squat | Muscle-up |
| Vendredi | Repos | — |
| Samedi | Dips, Squat, Planche | Dips |
| Dimanche | Repos | — |

Les exercices de planche et Front Lever sont gérés séparément, au ressenti. L'application peut les mentionner dans la séance, mais **ne doit pas imposer leur suivi détaillé**.

Tous les jours et exercices doivent rester modifiables.

## 4. Consultation du programme

L'utilisateur sélectionne un jour et retrouve immédiatement sa séance.

Chaque exercice possède plusieurs blocs :

- Échauffement
- Montée en charge
- Pic de force
- Volume
- Facultatif

Chaque ligne doit afficher :

- Nom de l'exercice
- Nombre de séries
- Nombre de répétitions
- Charge prescrite
- Temps de repos
- Statut de réalisation

Une série peut être cochée directement en appuyant dessus.

### Exemple d'affichage

**SQUAT — Mardi**

| Phase | Séries × reps | Charge | Repos |
|---|---|---|---|
| Montée | 1 × 3 | 40 kg | 3 min |
| Montée | 1 × 3 | 60 kg | 3 min |
| Pic | 3 × 3 | 80 kg | 5 min |
| Volume | 3 × 8 | 60 kg | 4 min |
| Facultatif | 2 × 10 | 50 kg | 4 min |

Les séries facultatives ne doivent pas être considérées comme manquées lorsqu'elles sont ignorées.

### Fonctionnement souhaité

1. Ouvrir l'application.
2. Sélectionner ou retrouver automatiquement la séance du jour.
3. Cocher les séries terminées.
4. Consulter les charges et temps de repos.
5. Enregistrer rapidement les performances principales.

L'application doit conserver la séance en cours même si elle est fermée accidentellement.

## 5. Suivi minimal des performances

**Aucune saisie détaillée de chaque série ne doit être obligatoire.**

À la fin de chaque exercice, seuls trois éléments sont pertinents :

| Champ | Description |
|---|---|
| Pic réalisé | Charge, séries et répétitions réellement effectuées |
| RIR | Répétitions estimées en réserve |
| Commentaire | Facultatif : fatigue, douleur, technique |

Le pic réalisé doit être prérempli avec la prescription du programme. Si tout est réussi, l'utilisateur n'a rien à modifier.

Exemple :

**Traction — Jeudi**

- Prévu : +50 kg, 2 × 3
- Réalisé : +50 kg, 2 × 3
- RIR : 3
- Commentaire : vide

L'enregistrement ne doit nécessiter que quelques interactions.

La date, l'exercice, le type de séance et les autres informations du programme sont renseignés automatiquement.

### Historique

Chaque séance terminée doit produire une entrée conservant :

- Date et heure
- Exercices effectués
- Pic réalisé
- RIR
- Poids de corps, si renseigné
- Commentaires facultatifs
- Programme prévu au moment de la séance

L'historique doit rester intact lorsque le programme est modifié ultérieurement.

## 6. Tableau de bord

Créer un dashboard permettant de visualiser rapidement la progression.

### 6.1. Graphiques de performances

Un graphique pour chacun des quatre exercices :

- Muscle-up lesté
- Traction lestée
- Dips lestés
- Squat

Afficher l'évolution des charges et éventuellement du 1RM estimé.

Les comparaisons doivent tenir compte des répétitions et du type de séance.

**Important :** ne pas interpréter une séance technique légère comme une régression par rapport à une séance de force.

Prévoir des filtres temporels : 1 mois, 3 mois, 6 mois, totalité.

### 6.2. Records personnels

Afficher les meilleurs records enregistrés, leur date et leur évolution.

Distinguer les records réellement réalisés des estimations calculées.

### 6.3. Poids et catégorie

Permettre d'enregistrer ponctuellement le poids de corps.

Afficher :

- Courbe de poids
- Moyenne hebdomadaire
- Limite de catégorie à 80 kg
- Marge restante avant la limite

L'enregistrement quotidien du poids n'est pas obligatoire.

### 6.4. Indicateur de progression

Pour chaque exercice, déterminer si les performances sont globalement :

- En progression
- Stables
- En baisse

Le calcul doit s'appuyer sur des performances comparables et non sur les seules charges maximales d'entraînement.

## 7. Gestion des programmes

Une interface d'édition doit permettre de modifier :

- Les jours d'entraînement
- Les exercices
- Leur ordre
- Les phases de travail
- Les séries et répétitions
- Les charges
- Les temps de repos
- Le caractère facultatif d'un bloc

Prévoir la duplication d'une séance ou d'un exercice pour éviter de ressaisir des séries similaires.

### Charges dynamiques

Prévoir un système optionnel de programmation en pourcentage du 1RM.

L'utilisateur doit pouvoir choisir entre :

- Une charge fixe, par exemple 80 kg
- Une charge calculée, par exemple 75 % du 1RM

Les charges calculées doivent être arrondies selon un incrément configurable, par exemple 1,25 kg, 2,5 kg ou 5 kg.

Pour les tractions, dips et muscle-ups, les pourcentages de résistance doivent intégrer le poids de corps lorsqu'ils sont utilisés pour représenter l'intensité totale.

Une modification du 1RM doit pouvoir actualiser les prescriptions dynamiques, sans modifier les historiques.

### Suggestions de progression

L'application peut suggérer une augmentation de charge lorsque :

- Toutes les répétitions sont réussies.
- Le RIR est suffisant.
- La progression reste cohérente.

Toute suggestion doit être validée manuellement. L'application ne doit jamais modifier silencieusement le programme.

## 8. Chronomètre et temps de repos

Intégrer un chronomètre de repos accessible pendant la séance.

Fonctionnalités :

- Démarrage manuel ou automatique après validation d'une série
- Durée préremplie depuis le programme
- Modification rapide de la durée
- Notification sonore ou vibration si le navigateur le permet

Le chronomètre ne doit pas bloquer la navigation.

Cette fonctionnalité est souhaitable, mais secondaire par rapport au suivi des performances.

## 9. Interface utilisateur

### Priorité mobile

L'application doit être agréable à utiliser sur un écran de smartphone.

Contraintes :

- Gros boutons facilement cliquables
- Navigation rapide
- Très peu de texte à saisir
- Interface claire et lisible
- Mode sombre
- Accès immédiat à la séance en cours
- Aucun défilement horizontal nécessaire sur mobile

### Navigation proposée

**Accueil** : séance du jour, accès au programme et aperçu des performances.

**Entraînement** : consultation, validation et sauvegarde de la séance.

**Progression** : graphiques, records et statistiques.

**Programme** : édition des séances et des exercices.

**Paramètres** : records de référence, poids, catégorie, sauvegardes et compte.

Le design doit être moderne, sobre et sportif, sans éléments décoratifs excessifs.

## 10. Architecture technique

### Frontend

Technologies recommandées :

- React
- TypeScript
- Vite
- CSS responsive, éventuellement Tailwind
- Bibliothèque de graphiques adaptée
- PWA avec service worker

Une autre architecture est acceptable si elle répond aux mêmes exigences.

### Hébergement

Utiliser **GitHub Pages**, avec publication automatique depuis un dépôt GitHub grâce à GitHub Actions.

Le projet doit fonctionner sans serveur applicatif dédié.

Configurer correctement les chemins d'accès aux ressources pour un déploiement GitHub Pages.

### Stockage local

Utiliser IndexedDB ou une solution équivalente pour stocker :

- Programmes
- Séances en cours
- Historique
- Records
- Paramètres

Les données doivent rester disponibles après un rechargement de page.

### Synchronisation Supabase

Ajouter Supabase pour permettre :

- La sauvegarde centralisée
- L'authentification
- La synchronisation PC/téléphone
- La restauration des données

Configurer des règles de sécurité RLS afin que chaque utilisateur ne puisse accéder qu'à ses propres données.

Aucune clé privée ou clé `service_role` ne doit être exposée dans le frontend.

Prévoir une gestion des conflits et éviter les doublons lors de la synchronisation.

**L'application doit rester utilisable localement si Supabase est temporairement inaccessible ou non configuré.**

## 11. Fonctionnement hors connexion

Le site doit être installable comme une application (PWA) depuis les navigateurs compatibles.

Après un premier chargement, l'utilisateur doit pouvoir :

- Ouvrir son programme
- Consulter les exercices
- Cocher ses séries
- Enregistrer ses performances
- Accéder à son historique local

Toutes les modifications réalisées hors connexion doivent être conservées et synchronisées lorsqu'une connexion revient.

La fermeture ou le rafraîchissement de l'application ne doit pas entraîner de perte des données déjà enregistrées.

## 12. Importation et exportation

L'application doit permettre :

- L'export intégral des données en JSON
- L'import d'une sauvegarde JSON
- L'export de l'historique en CSV
- La restauration des données après changement d'appareil

Prévoir également une importation initiale du programme Excel existant, ou un format simple permettant de le convertir.

Aucune donnée ne doit être écrasée lors d'un import sans confirmation explicite.

## 13. Structure des données

Prévoir au minimum les entités suivantes :

**Profil utilisateur**
- Identifiant
- Poids de référence
- Catégorie
- Préférences

**Exercice**
- Identifiant
- Nom
- Type de charge
- 1RM de référence

**Programme**
- Jour
- Ordre des exercices
- Blocs de travail
- Séries, répétitions, charges et repos

**Séance**
- Identifiant unique
- Date
- Programme utilisé
- État : en cours / terminée

**Performance**
- Identifiant de séance
- Exercice
- Séries et répétitions réalisées au pic
- Charge
- RIR
- Commentaire facultatif

**Poids de corps**
- Date
- Valeur en kg

Les données doivent être historisées afin de permettre des graphiques fiables.

## 14. Fonctionnalités prioritaires

### P0 — Indispensables

- Application mobile responsive
- Programme des quatre journées
- Édition des exercices et charges
- Validation rapide des séries
- Sauvegarde automatique de séance
- Historique minimal des performances
- Graphiques de progression
- Records personnels
- Persistance locale
- Déploiement sur GitHub Pages

### P1 — Fortement souhaitées

- Synchronisation Supabase
- Authentification
- Fonctionnement PWA hors ligne
- Chronomètre de repos
- Calcul des charges selon le 1RM
- Suivi du poids et de la catégorie
- Import/export des données

### P2 — Améliorations futures

- Suggestions automatiques de progression
- Estimations de 1RM
- Comparaison de cycles d'entraînement
- Statistiques de volume
- Bibliothèque d'exercices personnalisés
- Personnalisation du thème

## 15. Critères de validation

L'application sera considérée comme fonctionnelle si :

1. Je peux ouvrir le programme sur PC et smartphone.
2. Je peux sélectionner le jeudi et voir mes muscle-ups, tractions et squats.
3. Je peux cocher mes séries sans avoir à saisir chaque répétition.
4. Je peux fermer puis rouvrir l'application sans perdre ma séance.
5. Je peux enregistrer mon pic et mon RIR en quelques interactions.
6. Je peux retrouver mes performances des semaines précédentes.
7. Les graphiques se mettent à jour après l'enregistrement d'une séance.
8. Je peux modifier mon 1RM et mes programmes.
9. Je peux utiliser mon programme hors connexion après installation et chargement initial.
10. Je peux exporter et restaurer mes données.
11. Si Supabase est configuré, je peux retrouver mes données sur un deuxième appareil.
12. Le site est correctement publié et accessible depuis GitHub Pages.

Les fonctionnalités doivent être réellement opérationnelles, pas seulement représentées par des maquettes.

## 16. Livrables attendus

L'agent de développement devra fournir :

- Un dépôt GitHub contenant tout le code source.
- Une application fonctionnelle, adaptée au mobile.
- Un système de déploiement GitHub Pages.
- Une configuration PWA.
- Les migrations ou scripts SQL nécessaires pour Supabase.
- Une documentation d'installation et de configuration.
- Un jeu de données initial reprenant le programme sportif.
- Les tests nécessaires pour valider les fonctionnalités critiques.

Le dépôt devra contenir un README expliquant comment développer, tester, configurer et publier l'application.

---

## 17. Directives finales pour l'agent

**Priorité absolue : l'expérience pendant l'entraînement.**

Je ne veux pas d'une application compliquée nécessitant de renseigner des dizaines de valeurs à chaque séance.

Je veux pouvoir consulter mon programme, cocher mes séries et enregistrer rapidement mes principales performances.

Le tableau de bord doit ensuite exploiter automatiquement cet historique.

Privilégier :

1. La simplicité d'utilisation.
2. La fiabilité et la conservation des données.
3. La compatibilité mobile.
4. La qualité et la lisibilité des statistiques.
5. La facilité de modification des programmes.

**Ne pas se limiter à une démonstration visuelle. L'objectif est une application réellement utilisable au quotidien**, avec un code maintenable, des données persistantes et un déploiement fonctionnel.

L'agent peut prendre les décisions techniques secondaires nécessaires, à condition de respecter ces objectifs et de documenter ses choix.
