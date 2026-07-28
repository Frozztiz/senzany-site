-- SENZANY - Pont sécurisé entre le portail et le futur agent DayZ
-- Ce script est idempotent : il peut être relancé sans supprimer les livraisons existantes.

begin;

create extension if not exists pgcrypto;

alter table public.deliveries
  add column if not exists claim_token uuid,
  add column if not exists claimed_by text,
  add column if not exists claimed_at timestamptz,
  add column if not exists processing_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists error_message text,
  add column if not exists retry_count integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists deliveries_pending_steam_idx
  on public.deliveries (steam_id, created_at)
  where status = 'pending';

create or replace function public.claim_next_delivery(
  p_steam_id text,
  p_agent_id text default 'dayz-server'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery public.deliveries%rowtype;
  v_token uuid := gen_random_uuid();
  v_result jsonb;
begin
  if p_steam_id !~ '^\d{17}$' then
    raise exception 'SteamID64 invalide';
  end if;

  -- Libère automatiquement les anciennes réclamations restées bloquées plus de 10 minutes.
  update public.deliveries
  set status = 'pending',
      claim_token = null,
      claimed_by = null,
      claimed_at = null,
      processing_at = null,
      retry_count = retry_count + 1,
      updated_at = now()
  where status in ('claimed', 'processing')
    and claimed_at < now() - interval '10 minutes';

  select * into v_delivery
  from public.deliveries
  where steam_id = p_steam_id
    and status = 'pending'
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.deliveries
  set status = 'claimed',
      claim_token = v_token,
      claimed_by = nullif(trim(p_agent_id), ''),
      claimed_at = now(),
      processing_at = now(),
      error_message = null,
      updated_at = now()
  where id = v_delivery.id;

  select jsonb_build_object(
    'id', d.id,
    'steamId', d.steam_id,
    'playerName', d.player_name,
    'title', d.title,
    'message', d.message,
    'status', d.status,
    'claimToken', d.claim_token,
    'createdAt', d.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', di.id,
        'className', di.classname,
        'name', coalesce(di.display_name, di.classname),
        'quantity', di.quantity,
        'metadata', coalesce(di.metadata, '{}'::jsonb)
      ) order by di.created_at asc)
      from public.delivery_items di
      where di.delivery_id = d.id
    ), '[]'::jsonb)
  ) into v_result
  from public.deliveries d
  where d.id = v_delivery.id;

  return v_result;
end;
$$;

create or replace function public.complete_claimed_delivery(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_success boolean,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  update public.deliveries
  set status = case when p_success then 'delivered' else 'failed' end,
      delivered_at = case when p_success then now() else delivered_at end,
      failed_at = case when not p_success then now() else failed_at end,
      error_message = case when p_success then null else nullif(trim(p_error_message), '') end,
      updated_at = now()
  where id = p_delivery_id
    and claim_token = p_claim_token
    and status in ('claimed', 'processing')
  returning jsonb_build_object(
    'id', id,
    'status', status,
    'deliveredAt', delivered_at,
    'failedAt', failed_at,
    'errorMessage', error_message
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.claim_next_delivery(text, text) from public;
revoke all on function public.complete_claimed_delivery(uuid, uuid, boolean, text) from public;
grant execute on function public.claim_next_delivery(text, text) to service_role;
grant execute on function public.complete_claimed_delivery(uuid, uuid, boolean, text) to service_role;

commit;
