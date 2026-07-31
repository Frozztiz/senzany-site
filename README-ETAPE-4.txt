SENZANY — JOUEURS RCON — ÉTAPE 4

AJOUTS
- fiche joueur complétée avec statut Steam et Discord ;
- recherche dans la table Supabase user_links ;
- correspondance automatique avec le pseudo Steam exact du joueur DayZ ;
- affichage du SteamID64 et du nom Discord lorsqu'une correspondance unique existe ;
- bouton Kick avec motif obligatoire ;
- ban temporaire : 1 h, 6 h, 1 j, 3 j, 7 j ou 30 j ;
- ban définitif ;
- confirmation obligatoire avant chaque action ;
- commandes exécutées uniquement dans le backend protégé par commandAuth.

FICHIERS À REMPLACER
- senzany-admin.html
- assets/js/admin/players.js
- assets/css/pages/admin-deliveries.css
- backend/routes/commandement.js
- backend/services/rconService.js

IMPORTANT
La liaison portail repose actuellement sur une correspondance exacte entre le pseudo DayZ affiché par RCON et le pseudo public Steam enregistré. Si le joueur utilise un autre pseudo dans DayZ, la fiche indiquera « Non identifié » même si son compte Steam/Discord est bien lié.

DÉPLOIEMENT
1. Copier les fichiers dans le projet local en conservant les dossiers.
2. GitHub Desktop : Commit to main puis Push origin.
3. Après le déploiement, redémarrer le backend si GitHub Actions ne le fait pas :
   cd /var/www/senzany/backend
   pm2 restart senzany-api --update-env
