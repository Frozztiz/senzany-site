-- SENZANY — Socle commun de la base de données
-- Migration idempotente : elle peut être relancée sans supprimer les données existantes.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

commit;
