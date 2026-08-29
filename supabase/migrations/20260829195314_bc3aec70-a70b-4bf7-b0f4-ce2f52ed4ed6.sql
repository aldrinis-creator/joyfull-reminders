CREATE TABLE public.phone_otp_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms','whatsapp')),
  purpose TEXT NOT NULL DEFAULT 'signin' CHECK (purpose IN ('signin','verify')),
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  user_id UUID,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_phone_otp_phone_created ON public.phone_otp_challenges (phone, created_at DESC);

GRANT ALL ON public.phone_otp_challenges TO service_role;

ALTER TABLE public.phone_otp_challenges ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER phone_otp_challenges_updated BEFORE UPDATE ON public.phone_otp_challenges
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
ALTER TABLE public.family_members ADD COLUMN IF NOT EXISTS whatsapp_verified_at TIMESTAMPTZ;