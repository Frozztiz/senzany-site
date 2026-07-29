# Senzany — Consolidation BDD V1

## Modifications réalisées

- Remplacement des anciennes migrations SQL en double par une série ordonnée.
- Ajout des tables centrales : joueurs, staff, rôles, permissions, livraisons et audit.
- Conservation de la compatibilité avec les colonnes déjà utilisées par le backend.
- Ajout d’un journal d’audit pour les actions de livraison.
- Remplacement de la suppression définitive d’une livraison par une annulation.
- Renforcement des fichiers `.gitignore` pour empêcher l’envoi du `.env` et de `node_modules`.

## Ordre d’exécution dans Supabase

1. `supabase/001_core.sql`
2. `supabase/002_items.sql`
3. `supabase/003_players_staff.sql`
4. `supabase/004_deliveries.sql`
5. `supabase/005_delivery_agent.sql`
6. `supabase/006_audit_logs.sql`

## Important

Fais une sauvegarde de la base Supabase avant d’exécuter les migrations.
Les scripts sont idempotents et ne contiennent aucun `drop table`.
