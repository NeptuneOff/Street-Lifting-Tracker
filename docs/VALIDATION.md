# Validation

## Vérifications automatisées

`npm test` exécute également les règles PostgreSQL dans PGlite : programmes de même identifiant pour deux utilisateurs, refus des lectures et écritures croisées, interdiction de réaffecter une ligne, refus du rôle anonyme et d’une session sans identité. Une politique permissive ajoutée par erreur ne doit pas contourner la garde restrictive.

Les tests IndexedDB vérifient la séparation par compte et par projet, les écritures en cours lors du changement de compte, le refus d’une réponse différée et la migration de l’ancien carnet seulement vers son propriétaire déjà identifié.

Les parcours Auth utilisent un serveur simulé : écran fermé sans connexion, inscription avec confirmation e-mail, connexion A → modification → déconnexion → connexion B → retour à A. Le programme, le RIR, la séance en cours et le chronomètre ne doivent jamais apparaître dans l’autre compte. Un test retarde volontairement une réponse réseau du compte A jusqu’après la connexion de B.

`npm test` couvre les snapshots immuables (charges fixes et dynamiques), la résistance totale avec poids de corps, l’arrondi, les séries facultatives, les pics partiels/non validés, les tendances comparables, les moyennes de poids, les imports invalides, l’aller-retour des sauvegardes, la neutralisation des formules CSV, la décision de conflit, le refus des clés privées et une transaction IndexedDB.

`npm run test:e2e` couvre sur mobile et desktop :

- Jeudi : muscle-up, traction, squat.
- Cocher une série, choisir un RIR, recharger, fermer l’onglet puis reprendre.
- Modifier le programme avant et après la fin de la séance sans modifier le snapshot historique.
- Recharger hors ligne avec un service worker réellement installé et retrouver une série enregistrée sans réseau.
- Exporter puis restaurer le JSON après confirmation et retrouver une pesée.
- Naviguer sur les cinq écrans sans débordement horizontal ni exception JavaScript.

Les parcours s’exécutent sur `npm run build` + `preview`, pas sur le serveur de développement, pour tester réellement le précache PWA.

## Démonstration

Les tests de génération vérifient les dates, l’unicité des identifiants, l’aller-retour JSON, les données présentes pour les quatre graphiques et les trois bilans de singles. Les tests de stockage vérifient que la réinitialisation n’affecte pas un compte privé et qu’aucune synchronisation n’est possible depuis la démo.

Les parcours navigateur (mobile et desktop) couvrent l’entrée sans Supabase, l’historique détaillé, la modification puis la réinitialisation, le rechargement hors ligne et la sortie vers un compte connecté préservé. Le test observe les requêtes pour vérifier l’absence d’envoi au backend durant la démo.

## Recette Supabase à réaliser après configuration d’un projet

1. Exécuter les migrations 001 et 002 et confirmer RLS activé dans Supabase.
2. Compte A : se connecter et synchroniser une séance sur le premier appareil.
3. Compte A sur appareil vierge : synchroniser et retrouver la séance sans doublon. Les seeds intacts doivent céder la place aux réglages distants.
4. Enregistrer hors ligne sur le deuxième appareil, rouvrir en ligne et retrouver les données sur le premier.
5. Modifier le même programme hors ligne sur les deux appareils. Synchroniser A, puis B. Vérifier que B demande de choisir entre les deux versions et n’écrase rien automatiquement.
6. Supprimer une séance, synchroniser les deux appareils et confirmer qu’elle ne réapparaît pas.
7. Avec le compte B dans un autre profil de navigateur, vérifier qu’aucune ligne de A n’est visible. Une requête REST avec clé anon sans JWT utilisateur ne doit lire aucune donnée ni appeler la RPC.
8. Avec un JWT de B, essayer de lire ou modifier une ligne `user_id=A` : aucune ligne visible/modifiée, insertion refusée par RLS.
9. Envoyer deux fois la même version UUID par RPC : la seconde réponse est acceptée sans création d’une ligne supplémentaire.

Ces contrôles distants nécessitent les comptes et le projet de l’utilisateur. Une validation de logique locale ne doit pas être présentée comme un test de synchronisation PC/téléphone réel.
