BEGIN;

-- Les votants non inscrits doivent pouvoir apparaître dans le classement officiel.
ALTER TABLE public.monthly_vote_rankings
ALTER COLUMN steam_id DROP NOT NULL;

ALTER TABLE public.monthly_vote_rankings
DROP CONSTRAINT IF EXISTS monthly_vote_rankings_steam_id_check;

ALTER TABLE public.monthly_vote_rankings
DROP CONSTRAINT IF EXISTS monthly_vote_rankings_status_check;

ALTER TABLE public.monthly_vote_rankings
ADD CONSTRAINT monthly_vote_rankings_status_check
CHECK (
  status IN (
    'pending',
    'ready',
    'unidentified',
    'no_reward',
    'no_items',
    'delivery_created',
    'failed'
  )
);

-- Un SteamID reste unique dans un classement lorsqu'il existe.
-- PostgreSQL autorise plusieurs NULL dans cette contrainte, ce qui convient
-- aux pseudos Top-Serveurs non encore rattachés à un compte Senzany.
NOTIFY pgrst, 'reload schema';

COMMIT;
