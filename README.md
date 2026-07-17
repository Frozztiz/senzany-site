# Senzany Portal — V2.0 technique

## Structure

- Pages HTML à la racine : URLs Netlify inchangées.
- `assets/js/components.js` : menu et footer uniques pour tout le portail.
- `assets/css/pages/` : styles séparés par page.
- `assets/images/branding/` : logo.
- `assets/images/backgrounds/` : fonds généraux.
- `assets/images/staff/` : avatars du staff.
- `assets/images/gallery/` : captures communautaires.
- `assets/data/` : données JSON prêtes pour les futures pages dynamiques.

## Modifier le menu

Modifier uniquement le tableau `NAV` dans `assets/js/components.js`.

## Modifier le footer

Modifier uniquement la constante HTML du footer dans `assets/js/components.js`.

## Déploiement

Déposer le contenu de ce dossier à la racine du dépôt GitHub. Netlify conservera les URL actuelles.
