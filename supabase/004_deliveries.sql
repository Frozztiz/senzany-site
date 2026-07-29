-- SENZANY — Livraisons et contenu des livraisons
-- Cette migration complète une éventuelle table existante sans supprimer les données.

begin;

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players(id) on delete set null,
  steam_id text not null,
  player_name text,
  title text not null,
  message text,
  status text not null default 'pending',
  created_by text,
  created_by_name text,
  created_by_staff_id uuid references public.staff_users(id) on delete set null,
  claim_token uuid,
  claimed_by text,
  claimed_at timestamptz,
  processing_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  error_message text,
  retry_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deliveries
  add column if not exists player_id uuid references public.players(id) on delete set null,
  add column if not exists steam_id text,
  add column if not exists player_name text,
  add column if not exists title text,
  add column if not exists message text,
  add column if not exists status text not null default 'pending',
  add column if not exists created_by text,
  add column if not exists created_by_name text,
  add column if not exists created_by_staff_id uuid references public.staff_users(id) on delete set null,
  add column if not exists claim_token uuid,
  add column if not exists claimed_by text,
  add column if not exists claimed_at timestamptz,
  add column if not exists processing_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists error_message text,
  add column if not exists retry_count integer not null default 0,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  item_id bigint references public.items(id) on delete set null,
  classname text not null,
  display_name text,
  quantity integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint delivery_items_quantity_check check (quantity between 1 and 1000)
);

alter table public.delivery_items
  add column if not exists item_id bigint references public.items(id) on delete set null,
  add column if not exists classname text,
  add column if not exists display_name text,
  add column if not exists quantity integer not null default 1,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

alter table public.deliveries
  drop constraint if exists deliveries_status_check;

alter table public.deliveries
  add constraint deliveries_status_check
  check (status in ('pending', 'claimed', 'processing', 'delivered', 'failed', 'cancelled'))
  not valid;

validate constraint deliveries_status_check on public.deliveries;

create index if not exists deliveries_steam_id_idx on public.deliveries (steam_id);
create index if not exists deliveries_status_idx on public.deliveries (status);
create index if not exists deliveries_created_at_idx on public.deliveries (created_at desc);
create index if not exists deliveries_pending_steam_idx
  on public.deliveries (steam_id, created_at)
  where status = 'pending';
create index if not exists delivery_items_delivery_id_idx on public.delivery_items (delivery_id);
create index if not exists delivery_items_classname_idx on public.delivery_items (classname);

drop trigger if exists deliveries_set_updated_at on public.deliveries;
create trigger deliveries_set_updated_at
before update on public.deliveries
for each row execute function public.set_updated_at();

alter table public.deliveries enable row level security;
alter table public.delivery_items enable row level security;

grant select, insert, update, delete on public.deliveries to postgres, service_role;
grant select, insert, update, delete on public.delivery_items to postgres, service_role;

commit;
