ALTER TABLE public.greetings
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS provider_error text;

CREATE INDEX IF NOT EXISTS greetings_provider_message_id_idx
  ON public.greetings (provider_message_id)
  WHERE provider_message_id IS NOT NULL;