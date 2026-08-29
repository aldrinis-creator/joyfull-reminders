ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS calendar_token text UNIQUE;

CREATE INDEX IF NOT EXISTS profiles_calendar_token_idx
  ON public.profiles (calendar_token)
  WHERE calendar_token IS NOT NULL;

-- Only the system (service role) may set or rotate a calendar token.
CREATE OR REPLACE FUNCTION public.guard_profile_calendar_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claims', true) IS NOT NULL
     AND coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') <> 'service_role'
     AND NEW.calendar_token IS DISTINCT FROM OLD.calendar_token THEN
    NEW.calendar_token := OLD.calendar_token;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_calendar_token ON public.profiles;
CREATE TRIGGER guard_profile_calendar_token
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_calendar_token();