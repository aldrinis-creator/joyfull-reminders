ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMPTZ;

DO $$
DECLARE cmd TEXT;
BEGIN
  SELECT replace(command, 'cron/dispatch-reminders', 'cron/weekly-digest')
    INTO cmd FROM cron.job WHERE jobname = 'dispatch-reminders' LIMIT 1;
  IF cmd IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-digest') THEN
      PERFORM cron.unschedule('weekly-digest');
    END IF;
    -- Monday 02:30 UTC = Monday 08:00 IST
    PERFORM cron.schedule('weekly-digest', '30 2 * * 1', cmd);
  END IF;
END $$;