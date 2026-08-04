BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  mystery_title text NOT NULL DEFAULT 'Événement mystère',
  event_type text NOT NULL DEFAULT 'community' CHECK (event_type IN ('major','community','vote','seasonal')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','cancelled','completed')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  reveal_at timestamptz,
  is_mystery boolean NOT NULL DEFAULT false,
  description text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  rewards text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  vote_milestone integer CHECK (vote_milestone IS NULL OR vote_milestone >= 1000),
  is_featured boolean NOT NULL DEFAULT false,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at),
  CHECK (reveal_at IS NULL OR reveal_at < starts_at)
);
CREATE INDEX IF NOT EXISTS events_starts_at_idx ON public.events(starts_at);
CREATE INDEX IF NOT EXISTS events_status_idx ON public.events(status, starts_at);
CREATE INDEX IF NOT EXISTS events_vote_milestone_idx ON public.events(vote_milestone) WHERE vote_milestone IS NOT NULL;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO postgres, service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
