-- SENZANY — Catalogue V2
-- Ajoute les champs métier utilisés par les livraisons, la boutique,
-- le Battle Pass et les récompenses sans supprimer les données existantes.

begin;

alter table public.items
  add column if not exists subcategory text,
  add column if not exists source_path text,
  add column if not exists delivery_enabled boolean not null default true,
  add column if not exists shop_enabled boolean not null default false,
  add column if not exists battle_pass_enabled boolean not null default false,
  add column if not exists reward_enabled boolean not null default true,
  add column if not exists first_seen_at timestamptz not null default now(),
  add column if not exists last_seen_at timestamptz,
  add column if not exists import_count integer not null default 1;

update public.items
set
  first_seen_at = coalesce(first_seen_at, created_at, now()),
  last_seen_at = coalesce(last_seen_at, updated_at, created_at, now()),
  import_count = greatest(coalesce(import_count, 1), 1)
where
  first_seen_at is null
  or last_seen_at is null
  or import_count is null
  or import_count < 1;

alter table public.items
  drop constraint if exists items_import_count_check;

alter table public.items
  add constraint items_import_count_check
  check (import_count >= 1)
  not valid;

validate constraint items_import_count_check on public.items;

create index if not exists items_subcategory_idx
  on public.items (subcategory);

create index if not exists items_source_path_idx
  on public.items (source_path);

create index if not exists items_delivery_enabled_idx
  on public.items (delivery_enabled)
  where is_active = true;

create index if not exists items_shop_enabled_idx
  on public.items (shop_enabled)
  where is_active = true;

create index if not exists items_battle_pass_enabled_idx
  on public.items (battle_pass_enabled)
  where is_active = true;

create index if not exists items_reward_enabled_idx
  on public.items (reward_enabled)
  where is_active = true;

create index if not exists items_last_seen_at_idx
  on public.items (last_seen_at desc);

commit;
