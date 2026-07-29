-- SENZANY — Catalogue central des objets DayZ

begin;

create table if not exists public.items (
  id bigint generated always as identity primary key,
  classname text not null,
  display_name text,
  category text not null default 'Autre',
  mod_name text not null default 'Inconnu',
  source_file text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  image_url text,
  image_source text,
  image_status text,
  image_checked_at timestamptz,
  image_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.items
  add column if not exists display_name text,
  add column if not exists category text not null default 'Autre',
  add column if not exists mod_name text not null default 'Inconnu',
  add column if not exists source_file text,
  add column if not exists is_active boolean not null default true,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists image_url text,
  add column if not exists image_source text,
  add column if not exists image_status text,
  add column if not exists image_checked_at timestamptz,
  add column if not exists image_error text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists items_classname_unique_idx
  on public.items (classname);
create index if not exists items_classname_lower_idx
  on public.items (lower(classname));
create index if not exists items_display_name_lower_idx
  on public.items (lower(display_name));
create index if not exists items_mod_name_idx
  on public.items (mod_name);
create index if not exists items_category_idx
  on public.items (category);
create index if not exists items_image_status_idx
  on public.items (image_status)
  where is_active = true;

alter table public.items
  drop constraint if exists items_image_status_check;

alter table public.items
  add constraint items_image_status_check
  check (image_status is null or image_status in ('found', 'not_found', 'error'))
  not valid;

validate constraint items_image_status_check on public.items;

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
before update on public.items
for each row execute function public.set_updated_at();

alter table public.items enable row level security;

grant select, insert, update, delete on public.items to postgres, service_role;
grant usage, select on sequence public.items_id_seq to postgres, service_role;

commit;
