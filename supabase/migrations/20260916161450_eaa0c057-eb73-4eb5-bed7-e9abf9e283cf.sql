ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS medicine_alert_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS medicine_alert_member_id uuid REFERENCES public.family_members(id) ON DELETE SET NULL;