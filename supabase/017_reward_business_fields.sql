BEGIN;

ALTER TABLE public.reward_rules
ADD COLUMN IF NOT EXISTS bitcoin_amount INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.reward_rules
DROP CONSTRAINT IF EXISTS reward_rules_bitcoin_amount_check;

ALTER TABLE public.reward_rules
ADD CONSTRAINT reward_rules_bitcoin_amount_check
CHECK (bitcoin_amount >= 0);

NOTIFY pgrst, 'reload schema';

COMMIT;
