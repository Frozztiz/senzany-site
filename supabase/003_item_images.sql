-- SENZANY — Colonnes de suivi des images du catalogue
-- À exécuter une seule fois dans Supabase > SQL Editor.

alter table public.items
  add column if not exists image_url text,
  add column if not exists image_source text,
  add column if not exists image_status text,
  add column if not exists image_checked_at timestamptz,
  add column if not exists image_error text;

alter table public.items
  drop constraint if exists items_image_status_check;

alter table public.items
  add constraint items_image_status_check
  check (image_status is null or image_status in ('found', 'not_found', 'error'));

create index if not exists items_image_status_idx
  on public.items (image_status)
  where is_active = true;
