BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.vote_alias_ownerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_id uuid,
  steam_id text NOT NULL,
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  baseline_period text NOT NULL,
  baseline_votes integer NOT NULL DEFAULT 0 CHECK (baseline_votes >= 0),
  migrated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS vote_alias_ownerships_active_alias_uq
ON public.vote_alias_ownerships(normalized_alias)
WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS vote_alias_ownerships_steam_idx
ON public.vote_alias_ownerships(steam_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.vote_wallet_alias_periods (
  ownership_id uuid NOT NULL REFERENCES public.vote_alias_ownerships(id) ON DELETE CASCADE,
  period text NOT NULL,
  baseline_votes integer NOT NULL DEFAULT 0 CHECK (baseline_votes >= 0),
  credited_votes integer NOT NULL DEFAULT 0 CHECK (credited_votes >= 0),
  last_seen_votes integer NOT NULL DEFAULT 0 CHECK (last_seen_votes >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ownership_id, period)
);

CREATE TABLE IF NOT EXISTS public.vote_wallets (
  steam_id text PRIMARY KEY,
  balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned bigint NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
  lifetime_claimed bigint NOT NULL DEFAULT 0 CHECK (lifetime_claimed >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vote_wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  steam_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('vote_credit','claim','refund','adjustment')),
  amount bigint NOT NULL,
  period text,
  ownership_id uuid REFERENCES public.vote_alias_ownerships(id) ON DELETE SET NULL,
  votes integer,
  claim_id uuid,
  idempotency_key text UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vote_wallet_ledger_steam_idx
ON public.vote_wallet_ledger(steam_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.vote_wallet_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  steam_id text NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','delivery_created','refunded','failed')),
  delivery_id uuid,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vote_wallet_claims_steam_idx
ON public.vote_wallet_claims(steam_id, created_at DESC);

-- Les pseudos déjà présents au moment de l'installation conservent leurs votes actuels.
INSERT INTO public.vote_alias_ownerships (
  alias_id, steam_id, alias, normalized_alias, baseline_period, baseline_votes, migrated
)
SELECT
  id,
  steam_id,
  alias,
  normalized_alias,
  to_char(now() AT TIME ZONE 'Europe/Paris', 'YYYY-MM'),
  0,
  true
FROM public.topserveurs_vote_aliases a
WHERE NOT EXISTS (
  SELECT 1 FROM public.vote_alias_ownerships o
  WHERE o.normalized_alias = a.normalized_alias AND o.ended_at IS NULL
);

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
BEGIN
  SELECT * INTO v_owner FROM public.vote_alias_ownerships WHERE id = p_ownership_id FOR UPDATE;
  IF NOT FOUND OR v_owner.ended_at IS NOT NULL THEN
    RETURN QUERY SELECT 0, 0::bigint, COALESCE((SELECT balance FROM public.vote_wallets WHERE steam_id=v_owner.steam_id),0);
    RETURN;
  END IF;

  SELECT * INTO v_state
  FROM public.vote_wallet_alias_periods
  WHERE ownership_id = p_ownership_id AND period = p_period
  FOR UPDATE;

  IF NOT FOUND THEN
    v_baseline := CASE WHEN v_owner.baseline_period = p_period THEN v_owner.baseline_votes ELSE 0 END;
    INSERT INTO public.vote_wallet_alias_periods(ownership_id, period, baseline_votes, credited_votes, last_seen_votes)
    VALUES (p_ownership_id, p_period, v_baseline, 0, GREATEST(p_current_votes,0))
    RETURNING * INTO v_state;
  END IF;

  v_eligible := GREATEST(GREATEST(p_current_votes,0) - v_state.baseline_votes, 0);
  v_delta := GREATEST(v_eligible - v_state.credited_votes, 0);
  v_amount := v_delta::bigint * GREATEST(p_amount_per_vote,0)::bigint;

  UPDATE public.vote_wallet_alias_periods
  SET credited_votes = GREATEST(credited_votes, v_eligible),
      last_seen_votes = GREATEST(p_current_votes,0),
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
    INSERT INTO public.vote_wallet_ledger(steam_id, kind, amount, period, ownership_id, votes, idempotency_key, metadata)
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

  RETURN QUERY SELECT v_delta, v_amount, COALESCE(v_balance,0);
END;
$$;

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
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Montant invalide'; END IF;
  SELECT balance INTO v_balance FROM public.vote_wallets WHERE steam_id=p_steam_id FOR UPDATE;
  IF COALESCE(v_balance,0) < p_amount THEN RAISE EXCEPTION 'Solde insuffisant'; END IF;

  UPDATE public.vote_wallets
  SET balance = balance - p_amount, lifetime_claimed = lifetime_claimed + p_amount, updated_at=now()
  WHERE steam_id=p_steam_id;

  INSERT INTO public.vote_wallet_claims(steam_id, amount, status)
  VALUES (p_steam_id, p_amount, 'reserved') RETURNING id INTO v_claim;

  INSERT INTO public.vote_wallet_ledger(steam_id, kind, amount, claim_id, metadata)
  VALUES (p_steam_id, 'claim', -p_amount, v_claim, jsonb_build_object('status','reserved'));

  RETURN v_claim;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_vote_wallet_claim(p_claim_id uuid, p_error text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_claim public.vote_wallet_claims%ROWTYPE;
BEGIN
  SELECT * INTO v_claim FROM public.vote_wallet_claims WHERE id=p_claim_id FOR UPDATE;
  IF NOT FOUND OR v_claim.status <> 'reserved' THEN RETURN false; END IF;
  UPDATE public.vote_wallets
  SET balance=balance+v_claim.amount,
      lifetime_claimed=GREATEST(lifetime_claimed-v_claim.amount,0),
      updated_at=now()
  WHERE steam_id=v_claim.steam_id;
  UPDATE public.vote_wallet_claims SET status='refunded', error_message=p_error, updated_at=now() WHERE id=p_claim_id;
  INSERT INTO public.vote_wallet_ledger(steam_id,kind,amount,claim_id,metadata)
  VALUES(v_claim.steam_id,'refund',v_claim.amount,p_claim_id,jsonb_build_object('error',COALESCE(p_error,'')));
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_vote_wallet_alias(uuid,text,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_vote_wallet_claim(text,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_vote_wallet_claim(uuid,text) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
