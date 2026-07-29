# Migrations Supabase — Senzany

Exécute les fichiers dans l’ordre numérique depuis **Supabase > SQL Editor** :

1. `001_core.sql`
2. `002_items.sql`
3. `003_players_staff.sql`
4. `004_deliveries.sql`
5. `005_delivery_agent.sql`
6. `006_audit_logs.sql`

Ces scripts sont conçus pour être relancés sans supprimer les données existantes.

## Important

- Utilise la clé `service_role` uniquement dans le backend Node.js.
- Ne place jamais cette clé dans le JavaScript du navigateur.
- Fais une sauvegarde Supabase avant toute migration importante.
- Les anciennes migrations en double ont été remplacées par cette série ordonnée.
