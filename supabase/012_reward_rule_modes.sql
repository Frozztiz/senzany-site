-- SENZANY — Packs de classement et paliers de votes
begin;

alter table public.reward_rules
  add column if not exists threshold_value integer;

-- Les anciennes règles "votes" deviennent des règles de classement mensuel.
update public.reward_rules
set reward_type = 'votes_ranking'
where reward_type = 'votes';

alter table public.reward_rules
  drop constraint if exists reward_rules_reward_type_check;

alter table public.reward_rules
  add constraint reward_rules_reward_type_check
  check (reward_type in (
    'votes_ranking',
    'votes_threshold',
    'event',
    'fidelity',
    'battle_pass',
    'compensation'
  ));

alter table public.reward_rules
  drop constraint if exists reward_rules_threshold_value_check;

alter table public.reward_rules
  add constraint reward_rules_threshold_value_check
  check (
    (reward_type = 'votes_threshold' and threshold_value is not null and threshold_value >= 1)
    or
    (reward_type <> 'votes_threshold' and threshold_value is null)
  );

create index if not exists reward_rules_threshold_idx
  on public.reward_rules (reward_type, threshold_value)
  where reward_type = 'votes_threshold';

grant select, insert, update, delete
on public.reward_rules
to postgres, service_role;

notify pgrst, 'reload schema';
commit;
