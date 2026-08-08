-- SENZANY MAP V1
create table if not exists public.map_base_requests (
  id uuid primary key default gen_random_uuid(),
  steam_id text,
  discord_id text,
  request_name text not null,
  comment text,
  x numeric not null,
  z numeric not null,
  radius numeric not null default 60,
  status text not null default 'pending' check (status in ('pending','approved','rejected','archived')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);

create table if not exists public.map_bases (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.map_base_requests(id) on delete set null,
  x numeric not null,
  z numeric not null,
  radius numeric not null default 60,
  source text not null default 'manual' check (source in ('manual','flagpole')),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  flagpole_classname text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
