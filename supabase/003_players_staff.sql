-- SENZANY — Joueurs, comptes staff, rôles et permissions

begin;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  steam_id text not null unique,
  steam_name text,
  discord_id text unique,
  discord_username text,
  discord_avatar text,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint players_steam_id_format_check check (steam_id ~ '^\d{17}$')
);

-- Table de compatibilité utilisée actuellement pour lier Steam et Discord.
-- Elle sera fusionnée progressivement avec public.players lors d'une étape dédiée.
create table if not exists public.user_links (
  id text primary key,
  steam_id text not null unique,
  discord_id text not null unique,
  discord_username text,
  discord_avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_links_steam_id_format_check check (steam_id ~ '^\d{17}$')
);

create table if not exists public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_role_permissions (
  role_id uuid not null references public.staff_roles(id) on delete cascade,
  permission_id uuid not null references public.staff_permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.staff_users (
  id uuid primary key default gen_random_uuid(),
  steam_id text not null unique,
  display_name text,
  role_id uuid references public.staff_roles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_users_steam_id_format_check check (steam_id ~ '^\d{17}$')
);

create index if not exists players_discord_id_idx on public.players (discord_id);
create index if not exists user_links_discord_id_idx on public.user_links (discord_id);
create index if not exists players_last_seen_at_idx on public.players (last_seen_at desc);
create index if not exists staff_users_role_id_idx on public.staff_users (role_id);
create index if not exists staff_users_active_idx on public.staff_users (is_active);

drop trigger if exists user_links_set_updated_at on public.user_links;
create trigger user_links_set_updated_at
before update on public.user_links
for each row execute function public.set_updated_at();

drop trigger if exists players_set_updated_at on public.players;
create trigger players_set_updated_at
before update on public.players
for each row execute function public.set_updated_at();

drop trigger if exists staff_roles_set_updated_at on public.staff_roles;
create trigger staff_roles_set_updated_at
before update on public.staff_roles
for each row execute function public.set_updated_at();

drop trigger if exists staff_users_set_updated_at on public.staff_users;
create trigger staff_users_set_updated_at
before update on public.staff_users
for each row execute function public.set_updated_at();

insert into public.staff_roles (code, name, description, is_system)
values
  ('owner', 'Owner', 'Accès total au portail Senzany.', true),
  ('administrator', 'Administrateur', 'Administration générale du portail.', true),
  ('staff', 'Staff', 'Accès opérationnel limité aux modules autorisés.', true)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description;

insert into public.staff_permissions (code, name, description)
values
  ('commandement.access', 'Accéder au commandement', 'Autorise l’accès au Centre de commandement.'),
  ('deliveries.read', 'Voir les livraisons', 'Autorise la consultation des livraisons.'),
  ('deliveries.create', 'Créer des livraisons', 'Autorise la création de livraisons.'),
  ('deliveries.update', 'Modifier les livraisons', 'Autorise la modification ou l’annulation des livraisons.'),
  ('items.read', 'Voir les objets', 'Autorise la consultation du catalogue.'),
  ('items.import', 'Importer les objets', 'Autorise l’import des classnames.'),
  ('audit.read', 'Voir les journaux', 'Autorise la consultation des journaux d’audit.')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description;

alter table public.user_links enable row level security;
alter table public.players enable row level security;
alter table public.staff_roles enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.staff_role_permissions enable row level security;
alter table public.staff_users enable row level security;

grant select, insert, update, delete on public.user_links to postgres, service_role;
grant select, insert, update, delete on public.players to postgres, service_role;
grant select, insert, update, delete on public.staff_roles to postgres, service_role;
grant select, insert, update, delete on public.staff_permissions to postgres, service_role;
grant select, insert, update, delete on public.staff_role_permissions to postgres, service_role;
grant select, insert, update, delete on public.staff_users to postgres, service_role;

commit;
