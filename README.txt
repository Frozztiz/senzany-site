CORRECTIF SENZANY - CHARGEMENT CENTRE DE COMMANDEMENT

Cause corrigée : admin.js importait un fichier inexistant nommé item-catalog.js.
Le bon module est catalog.js.

Fichiers à copier en conservant l'arborescence :
- senzany-admin.html
- assets/js/admin/admin.js
- assets/js/admin/catalog.js

Après commit + push : recharge avec Ctrl + F5.
Aucun redémarrage PM2 nécessaire pour ce correctif frontend.
