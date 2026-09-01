ALTER TYPE public.greeting_status ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE public.greeting_status ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE public.greetings
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

CREATE INDEX IF NOT EXISTS greetings_scheduled_idx
  ON public.greetings (scheduled_for)
  WHERE scheduled_for IS NOT NULL;

CREATE INDEX IF NOT EXISTS greetings_reminder_idx
  ON public.greetings (reminder_id);