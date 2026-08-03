-- SENZANY — Sécurité des pseudos de vote
-- Un même pseudo normalisé ne peut appartenir qu'à un seul compte Senzany.
-- Ce script peut être relancé sans danger.

begin;

-- Vérification avant création de la contrainte : s'il existe déjà des doublons,
-- le script s'arrête afin de ne supprimer aucune donnée automatiquement.
do $$
begin
  if exists (
    select normalized_alias
    from public.topserveurs_vote_aliases
    group by normalized_alias
    having count(*) > 1
  ) then
    raise exception 'Des pseudos normalisés en double existent déjà dans topserveurs_vote_aliases. Corrige-les avant de créer l’index unique.';
  end if;
end $$;

create unique index if not exists topserveurs_vote_aliases_normalized_unique
  on public.topserveurs_vote_aliases (normalized_alias);

grant select, insert, update, delete
  on table public.topserveurs_vote_aliases
  to service_role;

commit;

notify pgrst, 'reload schema';
