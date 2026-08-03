-- SENZANY — Configuration centralisée des récompenses
begin;

create table if not exists public.reward_rules (
  id uuid primary key default gen_random_uuid(),
  reward_type text not null check (reward_type in ('votes','event','fidelity','battle_pass','compensation')),
  rank_min integer not null default 1 check (rank_min >= 1),
  rank_max integer not null default 1 check (rank_max >= rank_min),
  name text not null check (char_length(name) between 2 and 100),
  description text not null default '',
  roubles integer not null default 0 check (roubles >= 0),
  battle_pass_xp integer not null default 0 check (battle_pass_xp >= 0),
  items jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  priority integer not null default 100 check (priority >= 0),
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reward_rules_type_rank_idx
  on public.reward_rules (reward_type, rank_min, rank_max, priority);
create index if not exists reward_rules_active_idx
  on public.reward_rules (is_active);

alter table public.reward_rules enable row level security;
grant select, insert, update, delete on public.reward_rules to postgres, service_role;

notify pgrst, 'reload schema';
commit;
