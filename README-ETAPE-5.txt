SENZANY — JOUEURS ÉTAPE 5

Corrections :
- Les boutons Kick, Ban temporaire et Ban définitif sont reliés à la route backend RCON protégée.
- Le motif est obligatoire et une confirmation est demandée avant l'action.
- Le temps de connexion évolue désormais en direct dans la liste et dans la fiche joueur.
- Le suivi utilise le GUID BattlEye et tolère une omission RCON temporaire de deux minutes.
- Le compteur repart à zéro uniquement après une vraie déconnexion prolongée ou un redémarrage du backend.

Installation :
1. Copier les fichiers du ZIP dans le dépôt local en conservant les dossiers.
2. Commit et Push avec GitHub Desktop.
3. Après déploiement, redémarrer le backend si nécessaire :
   cd /var/www/senzany/backend
   pm2 restart senzany-api --update-env
