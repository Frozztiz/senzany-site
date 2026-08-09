-- 026_map_requests.sql
-- Demandes d'implantation envoyées par les joueurs.

begin;

create table if not exists public.map_requests (
  id uuid primary key default gen_random_uuid(),
  requester_steam_id text not null,
  request_name text not null check (char_length(request_name) between 1 and 80),
  comment text null check (comment is null or char_length(comment) <= 500),
  center_x numeric(10,2) not null check (center_x >= 0 and center_x <= 15360),
  center_z numeric(10,2) not null check (center_z >= 0 and center_z <= 15360),
  radius_m integer not null default 60 check (radius_m = 60),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.map_requests enable row level security;

-- Aucune lecture/écriture directe depuis le navigateur.
revoke all on table public.map_requests from anon, authenticated;
grant select, insert, update, delete on table public.map_requests to service_role;

drop trigger if exists trg_map_requests_updated_at on public.map_requests;
create trigger trg_map_requests_updated_at
before update on public.map_requests
for each row
execute function private.set_updated_at();

commit;
