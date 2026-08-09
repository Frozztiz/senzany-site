-- SENZANY MAP - sécurité colonnes géométrie publique
-- Peut être exécuté plusieurs fois sans risque.

alter table public.map_zones_public
  add column if not exists center_x numeric,
  add column if not exists center_z numeric,
  add column if not exists radius_m integer;

grant select on public.map_zones_public to service_role;
grant update on public.map_zones_public to service_role;
