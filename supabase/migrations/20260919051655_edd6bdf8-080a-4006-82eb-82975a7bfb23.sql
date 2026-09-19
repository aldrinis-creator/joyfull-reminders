CREATE TABLE public.reminder_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reminder_id UUID,
  occurrence_at TIMESTAMPTZ,
  channel TEXT NOT NULL,
  mode TEXT,
  outcome TEXT NOT NULL,
  detail TEXT,
  target TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reminder_deliveries_reminder_idx ON public.reminder_deliveries (reminder_id, occurrence_at DESC);
CREATE INDEX reminder_deliveries_user_idx ON public.reminder_deliveries (user_id, created_at DESC);

GRANT SELECT ON public.reminder_deliveries TO authenticated;
GRANT ALL ON public.reminder_deliveries TO service_role;

ALTER TABLE public.reminder_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own delivery records"
ON public.reminder_deliveries FOR SELECT TO authenticated
USING (auth.uid() = user_id);