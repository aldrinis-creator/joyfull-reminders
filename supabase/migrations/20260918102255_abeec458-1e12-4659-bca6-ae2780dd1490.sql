ALTER TABLE public.reminder_alerts
  ADD COLUMN IF NOT EXISTS renotify_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_renotified_at timestamptz;