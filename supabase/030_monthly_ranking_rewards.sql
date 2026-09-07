-- SENZANY — Distribution séparée des récompenses de classement mensuel
-- Cette table NE remplace PAS monthly_vote_rankings : elle journalise uniquement
-- les livraisons des packs reward_type = 'votes_ranking'.

begin;

create extension if not exists pgcrypto;

create table if not exists public.monthly_ranking_reward_deliveries (
  id uuid primary key default gen_random_uuid(),
  period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  ranking_run_id uuid,
  ranking_row_id uuid,
  position integer not null check (position between 1 and 10),
  steam_id text not null,
  player_name text,
  reward_rule_id uuid,
  reward_name text,
  reward_snapshot jsonb,
  delivery_id uuid,
  status text not null default 'processing'
    check (status in ('processing','delivery_created','failed','blocked')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period, position),
  unique (period, steam_id)
);

create index if not exists monthly_ranking_reward_period_idx
  on public.monthly_ranking_reward_deliveries(period, position);

create index if not exists monthly_ranking_reward_steam_idx
  on public.monthly_ranking_reward_deliveries(steam_id, created_at desc);

alter table public.monthly_ranking_reward_deliveries enable row level security;
revoke all on table public.monthly_ranking_reward_deliveries from anon, authenticated;
grant select, insert, update, delete on table public.monthly_ranking_reward_deliveries to service_role;

commit;
