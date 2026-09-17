CREATE TYPE public.medicine_frequency AS ENUM ('daily', 'weekly', 'interval');

CREATE TABLE public.medicines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dosage text,
  instructions text,
  frequency public.medicine_frequency NOT NULL DEFAULT 'daily',
  days_of_week smallint[] NOT NULL DEFAULT '{}',
  interval_days integer NOT NULL DEFAULT 1,
  times text[] NOT NULL DEFAULT '{}',
  total_qty integer,
  remaining_qty integer,
  low_stock_threshold integer NOT NULL DEFAULT 2,
  start_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  end_date date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicines TO authenticated;
GRANT ALL ON public.medicines TO service_role;

ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own medicines"
ON public.medicines FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER medicines_set_updated_at
BEFORE UPDATE ON public.medicines
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.reminders
  ADD COLUMN medicine_id uuid REFERENCES public.medicines(id) ON DELETE CASCADE;

CREATE INDEX medicines_user_idx ON public.medicines (user_id);
CREATE INDEX reminders_medicine_idx ON public.reminders (medicine_id);