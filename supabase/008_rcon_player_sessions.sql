-- Persistance des temps de connexion RCON entre les déploiements / redémarrages PM2.
create table if not exists public.rcon_player_sessions (
  session_key text primary key,
  battleye_guid text,
  player_name text not null,
  connected_at timestamptz not null,
  last_seen_at timestamptz not null,
  disconnected_at timestamptz,
  is_online boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists rcon_player_sessions_online_last_seen_idx
  on public.rcon_player_sessions (is_online, last_seen_at desc);

alter table public.rcon_player_sessions enable row level security;

-- Aucune politique publique : cette table est exclusivement utilisée par le backend
-- avec SUPABASE_SECRET_KEY, qui contourne la RLS.
