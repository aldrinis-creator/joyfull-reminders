ALTER TABLE public.phone_otp_challenges
  ADD COLUMN provider_message_id text,
  ADD COLUMN provider_status text NOT NULL DEFAULT 'created'
    CHECK (provider_status IN ('created', 'accepted', 'sent', 'delivered', 'read', 'failed', 'rejected')),
  ADD COLUMN provider_error text;

CREATE INDEX idx_phone_otp_provider_message_id
  ON public.phone_otp_challenges (provider_message_id)
  WHERE provider_message_id IS NOT NULL;