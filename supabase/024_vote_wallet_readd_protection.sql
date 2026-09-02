BEGIN;

-- Protection critique : un pseudo supprimé puis réajouté ne doit jamais
-- recréditer des votes déjà payés durant la même période.
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
  v_current_baseline integer;
  v_canonical_baseline integer;
  v_already_credited integer;
  v_eligible integer;
  v_delta integer;
  v_amount bigint;
  v_balance bigint;
  v_lock_key bigint;
BEGIN
  SELECT * INTO v_owner
  FROM public.vote_alias_ownerships
  WHERE id = p_ownership_id
  FOR UPDATE;

  IF NOT FOUND OR v_owner.ended_at IS NOT NULL THEN
    RETURN QUERY
      SELECT 0, 0::bigint,
        COALESCE((SELECT balance FROM public.vote_wallets WHERE steam_id = v_owner.steam_id), 0);
    RETURN;
  END IF;

  -- Sérialise tous les crédits d'un même SteamID + pseudo normalisé + mois,
  -- même si plusieurs ownership_id ont existé à la suite d'une suppression/réajout.
  v_lock_key := hashtextextended(
    v_owner.steam_id || '|' || v_owner.normalized_alias || '|' || p_period,
    0
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT * INTO v_state
  FROM public.vote_wallet_alias_periods
  WHERE ownership_id = p_ownership_id AND period = p_period
  FOR UPDATE;

  IF NOT FOUND THEN
    v_current_baseline := CASE
      WHEN v_owner.baseline_period = p_period THEN v_owner.baseline_votes
      ELSE 0
    END;

    INSERT INTO public.vote_wallet_alias_periods(
      ownership_id, period, baseline_votes, credited_votes, last_seen_votes
    )
    VALUES (
      p_ownership_id,
      p_period,
      v_current_baseline,
      0,
      GREATEST(p_current_votes, 0)
    )
    RETURNING * INTO v_state;
  END IF;

  -- Baseline canonique = le plus ancien/plus bas baseline connu pour ce pseudo,
  -- ce SteamID et ce mois. Ainsi, supprimer/réajouter le pseudo ne remet jamais
  -- son compteur financier à zéro.
  SELECT COALESCE(MIN(s.baseline_votes), v_state.baseline_votes)
  INTO v_canonical_baseline
  FROM public.vote_wallet_alias_periods s
  JOIN public.vote_alias_ownerships o ON o.id = s.ownership_id
  WHERE o.steam_id = v_owner.steam_id
    AND o.normalized_alias = v_owner.normalized_alias
    AND s.period = p_period;

  -- Total déjà crédité sur toutes les incarnations du même pseudo ce mois-ci.
  SELECT COALESCE(SUM(s.credited_votes), 0)
  INTO v_already_credited
  FROM public.vote_wallet_alias_periods s
  JOIN public.vote_alias_ownerships o ON o.id = s.ownership_id
  WHERE o.steam_id = v_owner.steam_id
    AND o.normalized_alias = v_owner.normalized_alias
    AND s.period = p_period;

  v_eligible := GREATEST(GREATEST(p_current_votes, 0) - GREATEST(v_canonical_baseline, 0), 0);
  v_delta := GREATEST(v_eligible - v_already_credited, 0);
  v_amount := v_delta::bigint * GREATEST(p_amount_per_vote, 0)::bigint;

  UPDATE public.vote_wallet_alias_periods
  SET credited_votes = credited_votes + v_delta,
      last_seen_votes = GREATEST(p_current_votes, 0),
      updated_at = now()
  WHERE ownership_id = p_ownership_id AND period = p_period;

  -- Ne touche au wallet que s'il existe réellement de nouveaux votes à payer.
  IF v_delta > 0 THEN
    INSERT INTO public.vote_wallets(steam_id, balance, lifetime_earned)
    VALUES (v_owner.steam_id, v_amount, v_amount)
    ON CONFLICT (steam_id) DO UPDATE SET
      balance = public.vote_wallets.balance + EXCLUDED.balance,
      lifetime_earned = public.vote_wallets.lifetime_earned + EXCLUDED.lifetime_earned,
      updated_at = now()
    RETURNING balance INTO v_balance;

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
      v_owner.steam_id || ':' || v_owner.normalized_alias || ':' || p_period || ':' || v_eligible::text,
      jsonb_build_object(
        'alias', v_owner.alias,
        'normalized_alias', v_owner.normalized_alias,
        'current_votes', p_current_votes,
        'canonical_baseline', v_canonical_baseline,
        'already_credited', v_already_credited
      )
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  ELSE
    SELECT COALESCE(balance, 0)
    INTO v_balance
    FROM public.vote_wallets
    WHERE steam_id = v_owner.steam_id;
  END IF;

  RETURN QUERY SELECT v_delta, v_amount, COALESCE(v_balance, 0);
END;
$$;

COMMIT;
