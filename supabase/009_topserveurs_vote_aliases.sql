-- SENZANY — Pseudos utilisés par les joueurs pour voter sur Top-Serveurs
-- Migration idempotente : elle peut être relancée sans supprimer les données existantes.

begin;

create table if not exists public.topserveurs_vote_aliases (
  id uuid primary key default gen_random_uuid(),
  steam_id text not null,
  alias text not null,
  normalized_alias text not null,
  created_at timestamptz not null default now(),
  constraint topserveurs_vote_aliases_steam_id_format
    check (steam_id ~ '^[0-9]{17}$'),
  constraint topserveurs_vote_aliases_alias_length
    check (char_length(alias) between 2 and 50),
  constraint topserveurs_vote_aliases_normalized_not_empty
    check (char_length(normalized_alias) > 0)
);

create unique index if not exists topserveurs_vote_aliases_normalized_unique
  on public.topserveurs_vote_aliases (normalized_alias);

create index if not exists topserveurs_vote_aliases_steam_id_idx
  on public.topserveurs_vote_aliases (steam_id);

alter table public.topserveurs_vote_aliases enable row level security;

commit;
