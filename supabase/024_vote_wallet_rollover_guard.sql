BEGIN;

-- Senzany - Protection permanente contre le faux report de votes au changement de mois.
--
-- Problème corrigé :
-- au passage d'un mois au suivant, Top-Serveurs peut continuer à exposer pendant
-- quelques minutes/heures le compteur cumulé du mois précédent. L'ancienne
-- fonction considérait ce compteur comme appartenant immédiatement au nouveau
-- mois et le créditait une seconde fois.
--
-- Principe :
-- - au premier passage sur un nouveau mois, si un état du mois précédent existe,
--   on place l'ownership en "rollover_pending" ;
-- - tant que le compteur source n'est pas redescendu sous le dernier compteur du
--   mois précédent, aucun vote du nouveau mois n'est crédité ;
-- - dès que la baisse est observée, le reset Top-Serveurs est considéré comme
--   confirmé et le compteur courant devient le vrai compteur du nouveau mois ;
-- - les votes présents après ce reset sont alors crédités une seule fois.
--
-- Cette migration n'altère PAS les historiques déjà écrits et ne touche PAS aux
-- corrections exceptionnelles de septembre 2026.

ALTER TABLE public.vote_wallet_alias_periods
  ADD COLUMN IF NOT EXISTS rollover_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rollover_previous_votes integer NOT NULL DEFAULT 0
    CHECK (rollover_previous_votes >= 0);

COMMENT ON COLUMN public.vote_wallet_alias_periods.rollover_pending IS
  'Vrai lorsque le nouveau mois attend encore la confirmation du reset du compteur Top-Serveurs.';

COMMENT ON COLUMN public.vote_wallet_alias_periods.rollover_previous_votes IS
  'Dernier compteur connu du mois précédent utilisé comme garde de rollover.';

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
  v_previous public.vote_wallet_alias_periods%ROWTYPE;
  v_baseline integer;
  v_current integer;
  v_eligible integer;
  v_delta integer;
  v_amount bigint;
  v_balance bigint;
BEGIN
  v_current := GREATEST(COALESCE(p_current_votes, 0), 0);

  SELECT *
  INTO v_owner
  FROM public.vote_alias_ownerships
  WHERE id = p_ownership_id
  FOR UPDATE;

  IF NOT FOUND OR v_owner.ended_at IS NOT NULL THEN
    RETURN QUERY
    SELECT
      0,
      0::bigint,
      COALESCE(
        (
          SELECT balance
          FROM public.vote_wallets
          WHERE steam_id = v_owner.steam_id
        ),
        0
      );
    RETURN;
  END IF;

  SELECT *
  INTO v_state
  FROM public.vote_wallet_alias_periods
  WHERE ownership_id = p_ownership_id
    AND period = p_period
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Cas normal d'un alias créé/attaché pendant le mois courant :
    -- on conserve le baseline prévu par l'ownership.
    IF v_owner.baseline_period = p_period THEN
      v_baseline := GREATEST(COALESCE(v_owner.baseline_votes, 0), 0);

      INSERT INTO public.vote_wallet_alias_periods(
        ownership_id,
        period,
        baseline_votes,
        credited_votes,
        last_seen_votes,
        rollover_pending,
        rollover_previous_votes
      )
      VALUES (
        p_ownership_id,
        p_period,
        v_baseline,
        0,
        v_current,
        false,
        0
      )
      RETURNING * INTO v_state;

    ELSE
      -- Cherche le dernier état connu AVANT la nouvelle période.
      SELECT *
      INTO v_previous
      FROM public.vote_wallet_alias_periods
      WHERE ownership_id = p_ownership_id
        AND period < p_period
      ORDER BY period DESC
      LIMIT 1;

      IF FOUND AND GREATEST(COALESCE(v_previous.last_seen_votes, 0), 0) > 0 THEN
        -- Nouveau mois : on attend explicitement de voir le compteur source
        -- repasser sous le dernier compteur du mois précédent.
        INSERT INTO public.vote_wallet_alias_periods(
          ownership_id,
          period,
          baseline_votes,
          credited_votes,
          last_seen_votes,
          rollover_pending,
          rollover_previous_votes
        )
        VALUES (
          p_ownership_id,
          p_period,
          0,
          0,
          v_current,
          true,
          GREATEST(COALESCE(v_previous.last_seen_votes, 0), 0)
        )
        RETURNING * INTO v_state;

      ELSE
        -- Aucun compteur précédent exploitable : fonctionnement normal.
        INSERT INTO public.vote_wallet_alias_periods(
          ownership_id,
          period,
          baseline_votes,
          credited_votes,
          last_seen_votes,
          rollover_pending,
          rollover_previous_votes
        )
        VALUES (
          p_ownership_id,
          p_period,
          0,
          0,
          v_current,
          false,
          0
        )
        RETURNING * INTO v_state;
      END IF;
    END IF;
  END IF;

  -- Tant que Top-Serveurs expose encore le compteur de l'ancien mois,
  -- on mémorise l'observation mais on ne crédite RIEN.
  IF v_state.rollover_pending THEN
    IF v_current >= v_state.rollover_previous_votes THEN
      UPDATE public.vote_wallet_alias_periods
      SET last_seen_votes = v_current,
          updated_at = now()
      WHERE ownership_id = p_ownership_id
        AND period = p_period;

      SELECT COALESCE(balance, 0)
      INTO v_balance
      FROM public.vote_wallets
      WHERE steam_id = v_owner.steam_id;

      RETURN QUERY
      SELECT 0, 0::bigint, COALESCE(v_balance, 0);
      RETURN;
    END IF;

    -- Le compteur est redescendu : reset confirmé.
    -- Le compteur courant représente désormais les vrais votes du nouveau mois.
    UPDATE public.vote_wallet_alias_periods
    SET baseline_votes = 0,
        credited_votes = 0,
        last_seen_votes = v_current,
        rollover_pending = false,
        rollover_previous_votes = 0,
        updated_at = now()
    WHERE ownership_id = p_ownership_id
      AND period = p_period
    RETURNING * INTO v_state;
  END IF;

  v_eligible := GREATEST(v_current - v_state.baseline_votes, 0);
  v_delta := GREATEST(v_eligible - v_state.credited_votes, 0);
  v_amount := v_delta::bigint * GREATEST(COALESCE(p_amount_per_vote, 0), 0)::bigint;

  UPDATE public.vote_wallet_alias_periods
  SET credited_votes = GREATEST(credited_votes, v_eligible),
      last_seen_votes = v_current,
      updated_at = now()
  WHERE ownership_id = p_ownership_id
    AND period = p_period;

  INSERT INTO public.vote_wallets(
    steam_id,
    balance,
    lifetime_earned
  )
  VALUES (
    v_owner.steam_id,
    v_amount,
    v_amount
  )
  ON CONFLICT (steam_id) DO UPDATE
  SET balance = public.vote_wallets.balance + EXCLUDED.balance,
      lifetime_earned = public.vote_wallets.lifetime_earned + EXCLUDED.lifetime_earned,
      updated_at = now()
  RETURNING balance INTO v_balance;

  IF v_delta > 0 THEN
    INSERT INTO public.vote_wallet_ledger(
      steam_id,
      kind,
      amount,
      period,
      ownership_id,
      votes,
      idempotency_key,
      metadata
    )
    VALUES (
      v_owner.steam_id,
      'vote_credit',
      v_amount,
      p_period,
      p_ownership_id,
      v_delta,
      p_ownership_id::text || ':' || p_period || ':' || v_eligible::text,
      jsonb_build_object(
        'alias', v_owner.alias,
        'current_votes', v_current,
        'rollover_guard', true
      )
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN QUERY
  SELECT v_delta, v_amount, COALESCE(v_balance, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_vote_wallet_alias(uuid,text,integer,integer)
TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
