begin;

create table if not exists public.tip4serv_battle_pass_premium_events (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  payment_id text not null,
  transaction_id text not null,
  store_id text not null,
  mode text not null check (mode in ('live', 'test')),
  product_id bigint not null check (product_id = 723),
  steam_id text not null check (steam_id ~ '^\d{17}$'),
  season_id uuid not null references public.battle_pass_seasons(id) on delete restrict,
  player_id uuid not null references public.battle_pass_players(id) on delete restrict,
  already_premium boolean not null,
  processed_at timestamptz not null default now(),
  unique (mode, store_id, payment_id, product_id),
  unique (mode, store_id, transaction_id, product_id)
);

alter table public.tip4serv_battle_pass_premium_events enable row level security;
revoke all on table public.tip4serv_battle_pass_premium_events from anon, authenticated;
grant select, insert on table public.tip4serv_battle_pass_premium_events to service_role;

create or replace function public.activate_tip4serv_battle_pass_premium(
  p_request_id text,
  p_payment_id text,
  p_transaction_id text,
  p_store_id text,
  p_mode text,
  p_steam_id text,
  p_product_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing_event public.tip4serv_battle_pass_premium_events%rowtype;
  v_season_id uuid;
  v_active_count integer;
  v_player_id uuid;
  v_already_premium boolean;
begin
  if p_product_id <> 723
     or p_steam_id is null or p_steam_id !~ '^\d{17}$'
     or p_request_id is null or p_request_id = ''
     or p_payment_id is null or p_payment_id = ''
     or p_transaction_id is null or p_transaction_id = ''
     or p_store_id is null or p_store_id = ''
     or p_mode not in ('live', 'test') then
    return jsonb_build_object('success', false, 'errorCode', 'INVALID_REQUEST');
  end if;

  -- Serializes retries and concurrent deliveries for the same Tip4Serv payment.
  perform pg_advisory_xact_lock(
    hashtextextended(p_mode || '|' || p_store_id || '|' || p_payment_id || '|' || p_product_id, 0)
  );
  perform pg_advisory_xact_lock(hashtextextended('tip4serv-player|' || p_steam_id, 0));

  select * into v_existing_event
  from public.tip4serv_battle_pass_premium_events
  where mode = p_mode
    and store_id = p_store_id
    and product_id = p_product_id
    and (payment_id = p_payment_id or transaction_id = p_transaction_id)
  limit 1;

  if found then
    if v_existing_event.payment_id <> p_payment_id
       or v_existing_event.transaction_id <> p_transaction_id
       or v_existing_event.steam_id <> p_steam_id then
      return jsonb_build_object('success', false, 'errorCode', 'PAYMENT_ID_CONFLICT');
    end if;

    return jsonb_build_object(
      'success', true,
      'alreadyProcessed', true,
      'alreadyPremium', v_existing_event.already_premium
    );
  end if;

  select count(*)
  into v_active_count
  from public.battle_pass_seasons
  where status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now());

  if v_active_count <> 1 then
    return jsonb_build_object('success', false, 'errorCode', 'NO_ACTIVE_SEASON');
  end if;

  select id into v_season_id
  from public.battle_pass_seasons
  where status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  limit 1;

  select id, is_premium
  into v_player_id, v_already_premium
  from public.battle_pass_players
  where season_id = v_season_id and steam_id = p_steam_id
  for update;

  if found then
    -- Deliberately preserve XP, level, player_name, source and metadata.
    if not v_already_premium then
      update public.battle_pass_players
      set is_premium = true,
          updated_at = now()
      where id = v_player_id;
    end if;
  else
    v_already_premium := false;
    insert into public.battle_pass_players (season_id, steam_id, is_premium, source)
    values (v_season_id, p_steam_id, true, 'tip4serv')
    returning id into v_player_id;
  end if;

  insert into public.tip4serv_battle_pass_premium_events (
    request_id, payment_id, transaction_id, store_id, mode, product_id,
    steam_id, season_id, player_id, already_premium
  ) values (
    p_request_id, p_payment_id, p_transaction_id, p_store_id, p_mode, p_product_id,
    p_steam_id, v_season_id, v_player_id, v_already_premium
  );

  return jsonb_build_object(
    'success', true,
    'alreadyProcessed', false,
    'alreadyPremium', v_already_premium
  );
end;
$$;

revoke all on function public.activate_tip4serv_battle_pass_premium(
  text, text, text, text, text, text, bigint
) from public, anon, authenticated;
grant execute on function public.activate_tip4serv_battle_pass_premium(
  text, text, text, text, text, text, bigint
) to service_role;

commit;
