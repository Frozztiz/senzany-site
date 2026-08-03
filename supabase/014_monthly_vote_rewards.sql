-- SENZANY — Classements mensuels de votes et génération contrôlée des livraisons
BEGIN;

CREATE TABLE IF NOT EXISTS public.monthly_vote_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL UNIQUE CHECK (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  year integer NOT NULL CHECK (year >= 2020),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','ready','processing','completed','failed')),
  snapshot_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  completed_at timestamptz,
  error_message text,
  ranking_count integer NOT NULL DEFAULT 0 CHECK (ranking_count >= 0),
  delivery_count integer NOT NULL DEFAULT 0 CHECK (delivery_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.monthly_vote_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.monthly_vote_runs(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 1),
  steam_id text NOT NULL CHECK (steam_id ~ '^\d{17}$'),
  player_name text NOT NULL,
  votes integer NOT NULL DEFAULT 0 CHECK (votes >= 0),
  aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  reward_rule_id uuid NULL REFERENCES public.reward_rules(id) ON DELETE SET NULL,
  reward_name text,
  reward_snapshot jsonb,
  delivery_id uuid NULL REFERENCES public.deliveries(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','ready','no_reward','no_items','delivery_created','failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, steam_id),
  UNIQUE (run_id, position)
);

CREATE INDEX IF NOT EXISTS monthly_vote_runs_status_idx
  ON public.monthly_vote_runs(status, period DESC);
CREATE INDEX IF NOT EXISTS monthly_vote_rankings_run_position_idx
  ON public.monthly_vote_rankings(run_id, position);
CREATE INDEX IF NOT EXISTS monthly_vote_rankings_steam_idx
  ON public.monthly_vote_rankings(steam_id);

ALTER TABLE public.monthly_vote_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_vote_rankings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.monthly_vote_runs, public.monthly_vote_rankings
TO postgres, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
