-- SENZANY — Journal d’audit central

begin;

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_steam_id text,
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_id text,
  success boolean not null default true,
  details jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_idx on public.audit_logs (actor_steam_id);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action);

alter table public.audit_logs enable row level security;

grant select, insert on public.audit_logs to postgres, service_role;
grant usage, select on sequence public.audit_logs_id_seq to postgres, service_role;

commit;
