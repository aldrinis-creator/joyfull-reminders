ALTER TABLE public.reminder_alerts
  ADD COLUMN IF NOT EXISTS last_notified_occurrence_at timestamptz;

CREATE INDEX IF NOT EXISTS reminder_alerts_dispatch_idx
  ON public.reminder_alerts (reminder_id, last_notified_occurrence_at);