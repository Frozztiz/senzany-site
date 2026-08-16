-- 027_battle_pass.sql
-- SENZANY — Battle Pass V1 : saisons, paliers, progression joueurs et historique.

begin;
create extension if not exists pgcrypto;

create table if not exists public.battle_pass_seasons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 1 and 20),
  name text not null check (char_length(name) between 2 and 100),
  description text not null default '',
  status text not null default 'draft' check (status in ('draft','active','ended')),
  starts_at timestamptz,
  ends_at timestamptz,
  max_level integer not null default 50 check (max_level between 1 and 200),
  xp_per_level integer not null default 1000 check (xp_per_level between 1 and 10000000),
  premium_enabled boolean not null default true,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create unique index if not exists battle_pass_one_active_season_idx
  on public.battle_pass_seasons ((status)) where status = 'active';

create table if not exists public.battle_pass_levels (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.battle_pass_seasons(id) on delete cascade,
  level integer not null check (level between 1 and 200),
  xp_required integer not null default 0 check (xp_required >= 0),
  free_rewards jsonb not null default '{"items":[],"roubles":0,"bitcoin":0}'::jsonb,
  premium_rewards jsonb not null default '{"items":[],"roubles":0,"bitcoin":0}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, level)
);

create table if not exists public.battle_pass_players (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.battle_pass_seasons(id) on delete cascade,
  steam_id text not null check (steam_id ~ '^\d{17}$'),
  player_name text,
  xp bigint not null default 0 check (xp >= 0),
  level integer not null default 1 check (level between 1 and 200),
  is_premium boolean not null default false,
  source text not null default 'portal',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, steam_id)
);

create table if not exists public.battle_pass_history (
  id bigint generated always as identity primary key,
  season_id uuid not null references public.battle_pass_seasons(id) on delete cascade,
  player_id uuid references public.battle_pass_players(id) on delete set null,
  steam_id text,
  action text not null,
  actor_steam_id text,
  old_xp bigint,
  new_xp bigint,
  old_level integer,
  new_level integer,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists battle_pass_levels_season_idx on public.battle_pass_levels(season_id, level);
create index if not exists battle_pass_players_season_level_idx on public.battle_pass_players(season_id, level desc, xp desc);
create index if not exists battle_pass_players_steam_idx on public.battle_pass_players(steam_id);
create index if not exists battle_pass_history_player_idx on public.battle_pass_history(player_id, created_at desc);

alter table public.battle_pass_seasons enable row level security;
alter table public.battle_pass_levels enable row level security;
alter table public.battle_pass_players enable row level security;
alter table public.battle_pass_history enable row level security;

grant select, insert, update, delete on public.battle_pass_seasons to postgres, service_role;
grant select, insert, update, delete on public.battle_pass_levels to postgres, service_role;
grant select, insert, update, delete on public.battle_pass_players to postgres, service_role;
grant select, insert, update, delete on public.battle_pass_history to postgres, service_role;
grant usage, select on all sequences in schema public to service_role;

insert into public.battle_pass_seasons (code, name, description, status, max_level, xp_per_level, premium_enabled)
values ('S01', 'Saison 01', 'Première saison du Battle Pass Senzany.', 'draft', 50, 1000, true)
on conflict (code) do nothing;

insert into public.battle_pass_levels (season_id, level, xp_required)
select s.id, gs.level, (gs.level - 1) * s.xp_per_level
from public.battle_pass_seasons s
cross join lateral generate_series(1, s.max_level) as gs(level)
where s.code = 'S01'
on conflict (season_id, level) do nothing;

notify pgrst, 'reload schema';
commit;
