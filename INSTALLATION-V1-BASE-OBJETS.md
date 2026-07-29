# SENZANY — Base des objets V1.0

Cette version ajoute une rubrique **Base des objets** au Centre de Commandement.
Les fichiers XML ne sont jamais utilisés par le navigateur : le ZIP est envoyé au backend, analysé, puis tous les objets sont enregistrés dans la table `public.items` de Supabase.

## 1. Supabase

Dans **Supabase > SQL Editor**, ouvre un nouvel onglet puis exécute :

`supabase/002_items.sql`

Garde ton SQL Livraisons actuel. Ce nouveau SQL ajoute seulement la table `items`.

## 2. GitHub Desktop

Copie les fichiers du ZIP dans ton dépôt en conservant exactement les dossiers, puis fais :

- Commit
- Push origin

## 3. Ubuntu

Aucune nouvelle dépendance npm n'est nécessaire.

Après réception du push sur le serveur :

```bash
cd /chemin/de/ton/projet/backend
pm2 restart senzany-api --update-env
pm2 logs senzany-api --lines 50
```

## 4. Premier import

Ouvre **Commandement > Base des objets** :

1. sélectionne `gebsfish-types(1).zip` ;
2. clique sur **Importer dans la base** ;
3. attends le message de confirmation.

Le ZIP fourni contient 73 fichiers XML. Le parseur détecte environ 9 074 classnames uniques et fusionne les occurrences en double.

## Sécurité

- accès protégé par la même authentification Steam que le Commandement ;
- ZIP limité à 20 Mo ;
- contenu décompressé limité à 80 Mo ;
- maximum 500 fichiers ;
- seules les entrées ressemblant à `types*.xml` sont analysées ;
- insertion Supabase par lots avec `UPSERT` sur le classname.
