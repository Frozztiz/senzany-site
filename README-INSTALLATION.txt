SENZANY — Correctif catalogue + recherche d'objets dans les livraisons v4.1.1

1. Copiez tout le contenu de ce dossier à la racine du projet.
2. Acceptez le remplacement des fichiers existants.
3. Dans GitHub Desktop, vérifiez les changements puis faites Commit et Push.
4. Sur le VPS : git pull, puis pm2 restart all (ou le nom précis du processus backend).
5. Rechargez la page avec Ctrl+F5.

TEST :
- Ouvrir Gestion des livraisons.
- Dans "Objets de la livraison", taper au moins 2 caractères, par exemple M4.
- Choisir un résultat dans la liste.
- Le classname est rempli et le mod/catégorie s'affichent sous le champ.
- La quantité reste modifiable et plusieurs objets peuvent être ajoutés.
