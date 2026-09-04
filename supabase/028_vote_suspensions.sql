BEGIN;

-- =========================================================
-- Senzany - Suspensions temporaires des votes / récompenses
-- =========================================================

CREATE TABLE IF NOT EXISTS public.vote_suspensions (
  steam_id text PRIMARY KEY,
  player_name text NOT NULL,
  reason text,
  block_votes boolean NOT NULL DEFAULT true,
  block_rewards boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vote_suspensions_active_idx
ON public.vote_suspensions(ends_at)
WHERE block_votes = true OR block_rewards = true;

-- La table contient des informations de modération : aucun accès direct client.
ALTER TABLE public.vote_suspensions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.vote_suspensions FROM anon, authenticated;
GRANT ALL ON TABLE public.vote_suspensions TO service_role;

-- -------------------------------------------------------------------------
-- Crédit des votes : pendant une suspension de vote, on avance quand même
-- credited_votes jusqu'au total observé. Les votes effectués pendant le ban
-- sont donc consommés sans argent et ne pourront pas être crédités après.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credit_vote_wallet_alias(
  p_ownership_id uuid,
  p_period text,
  p_current_votes integer,
  p_amount_per_vote integer DEFAULT 1000
)
RETURNS TABLE(delta_votes integer, credited_amount bigint, wallet_balance bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner public.vote_alias_ownerships%ROWTYPE;
  v_state public.vote_wallet_alias_periods%ROWTYPE;
  v_baseline integer;
  v_eligible integer;
  v_delta integer;
  v_amount bigint;
  v_balance bigint;
  v_votes_suspended boolean := false;
BEGIN
  SELECT * INTO v_owner
  FROM public.vote_alias_ownerships
  WHERE id = p_ownership_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  IF v_owner.ended_at IS NOT NULL THEN
    RETURN QUERY SELECT 0, 0::bigint,
      COALESCE((SELECT balance FROM public.vote_wallets WHERE steam_id = v_owner.steam_id), 0);
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.vote_suspensions s
    WHERE s.steam_id = v_owner.steam_id
      AND s.block_votes = true
      AND s.starts_at <= now()
      AND s.ends_at > now()
  ) INTO v_votes_suspended;

  SELECT * INTO v_state
  FROM public.vote_wallet_alias_periods
  WHERE ownership_id = p_ownership_id AND period = p_period
  FOR UPDATE;

  IF NOT FOUND THEN
    v_baseline := CASE WHEN v_owner.baseline_period = p_period THEN v_owner.baseline_votes ELSE 0 END;
    INSERT INTO public.vote_wallet_alias_periods(
      ownership_id, period, baseline_votes, credited_votes, last_seen_votes
    )
    VALUES (
      p_ownership_id, p_period, v_baseline, 0, GREATEST(p_current_votes, 0)
    )
    RETURNING * INTO v_state;
  END IF;

  v_eligible := GREATEST(GREATEST(p_current_votes, 0) - v_state.baseline_votes, 0);

  -- IMPORTANT : même suspendu, on mémorise le total observé comme déjà traité.
  -- Cela empêche tout crédit rétroactif à la fin de la suspension.
  IF v_votes_suspended THEN
    UPDATE public.vote_wallet_alias_periods
    SET credited_votes = GREATEST(credited_votes, v_eligible),
        last_seen_votes = GREATEST(p_current_votes, 0),
        updated_at = now()
    WHERE ownership_id = p_ownership_id AND period = p_period;

    SELECT COALESCE(balance, 0) INTO v_balance
    FROM public.vote_wallets
    WHERE steam_id = v_owner.steam_id;

    RETURN QUERY SELECT 0, 0::bigint, COALESCE(v_balance, 0);
    RETURN;
  END IF;

  v_delta := GREATEST(v_eligible - v_state.credited_votes, 0);
  v_amount := v_delta::bigint * GREATEST(p_amount_per_vote, 0)::bigint;

  UPDATE public.vote_wallet_alias_periods
  SET credited_votes = GREATEST(credited_votes, v_eligible),
      last_seen_votes = GREATEST(p_current_votes, 0),
      updated_at = now()
  WHERE ownership_id = p_ownership_id AND period = p_period;

  INSERT INTO public.vote_wallets(steam_id, balance, lifetime_earned)
  VALUES (v_owner.steam_id, v_amount, v_amount)
  ON CONFLICT (steam_id) DO UPDATE SET
    balance = public.vote_wallets.balance + EXCLUDED.balance,
    lifetime_earned = public.vote_wallets.lifetime_earned + EXCLUDED.lifetime_earned,
    updated_at = now()
  RETURNING balance INTO v_balance;

  IF v_delta > 0 THEN
    INSERT INTO public.vote_wallet_ledger(
      steam_id, kind, amount, period, ownership_id, votes, idempotency_key, metadata
    )
    VALUES (
      v_owner.steam_id,
      'vote_credit',
      v_amount,
      p_period,
      p_ownership_id,
      v_delta,
      p_ownership_id::text || ':' || p_period || ':' || v_eligible::text,
      jsonb_build_object('alias', v_owner.alias, 'current_votes', p_current_votes)
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN QUERY SELECT v_delta, v_amount, COALESCE(v_balance, 0);
END;
$$;

-- -------------------------------------------------------------------------
-- Double verrouillage du claim directement en base. Même si une route API
-- oubliait le contrôle Node, une récompense ne peut pas être réservée.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_vote_wallet_claim(p_steam_id text, p_amount bigint)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance bigint;
  v_claim uuid;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.vote_suspensions s
    WHERE s.steam_id = p_steam_id
      AND s.block_rewards = true
      AND s.starts_at <= now()
      AND s.ends_at > now()
  ) THEN
    RAISE EXCEPTION 'VOTE_REWARDS_SUSPENDED';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montant invalide';
  END IF;

  SELECT balance INTO v_balance
  FROM public.vote_wallets
  WHERE steam_id = p_steam_id
  FOR UPDATE;

  IF COALESCE(v_balance, 0) < p_amount THEN
    RAISE EXCEPTION 'Solde insuffisant';
  END IF;

  UPDATE public.vote_wallets
  SET balance = balance - p_amount,
      lifetime_claimed = lifetime_claimed + p_amount,
      updated_at = now()
  WHERE steam_id = p_steam_id;

  INSERT INTO public.vote_wallet_claims(steam_id, amount, status)
  VALUES (p_steam_id, p_amount, 'reserved')
  RETURNING id INTO v_claim;

  INSERT INTO public.vote_wallet_ledger(steam_id, kind, amount, claim_id, metadata)
  VALUES (p_steam_id, 'claim', -p_amount, v_claim, jsonb_build_object('status', 'reserved'));

  RETURN v_claim;
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_vote_wallet_alias(uuid,text,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_vote_wallet_claim(text,bigint) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
