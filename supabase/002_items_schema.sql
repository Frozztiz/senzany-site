-- SENZANY — Catalogue des objets DayZ
begin;

create table if not exists public.items (
  id bigint generated always as identity primary key,
  classname text not null unique,
  display_name text,
  category text not null default 'Autre',
  mod_name text not null default 'Inconnu',
  source_file text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists items_classname_lower_idx on public.items (lower(classname));
create index if not exists items_display_name_lower_idx on public.items (lower(display_name));
create index if not exists items_mod_name_idx on public.items (mod_name);
create index if not exists items_category_idx on public.items (category);

create or replace function public.set_items_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
before update on public.items
for each row execute function public.set_items_updated_at();

alter table public.items enable row level security;

grant select, insert, update, delete on public.items to postgres, service_role;
grant usage, select on sequence public.items_id_seq to postgres, service_role;

commit;
