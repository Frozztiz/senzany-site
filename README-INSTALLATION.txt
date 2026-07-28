SENZANY — Correctif catalogue + recherche dans les livraisons v4.1.0

INSTALLATION AVEC GITHUB DESKTOP
1. Ouvrir le dossier de ce ZIP.
2. Copier tout son contenu dans le dossier racine du projet senzany-site.
3. Accepter le remplacement des fichiers existants.
4. Vérifier les changements dans GitHub Desktop.
5. Commit puis Push origin.
6. Sur le VPS : git pull puis redémarrer le backend avec PM2 si nécessaire.

MODIFICATIONS
- Le classname est désormais affiché correctement dans la Base des objets.
- Compatibilité avec les réponses camelCase du backend (cause réelle du texte « Inconnu »).
- Le mod est déduit du fichier source lorsqu'il manque en base.
- Le catalogue est placé en premier ; l'import XML est déplacé dans une section Maintenance repliée.
- Le champ objet des livraisons recherche directement dans Supabase après 2 caractères.
- Liste déroulante, navigation clavier, sélection automatique du classname.
- Catégorie et nom du mod affichés sous chaque suggestion.
- Aucun système d'images ajouté : priorité maintenue sur le flux livraisons/RCON.
