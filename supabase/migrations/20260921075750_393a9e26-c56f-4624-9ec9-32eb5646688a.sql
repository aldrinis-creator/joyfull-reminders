CREATE INDEX IF NOT EXISTS reminders_due_at_idx ON public.reminders (due_at);
CREATE INDEX IF NOT EXISTS reminder_alerts_reminder_id_idx ON public.reminder_alerts (reminder_id);

CREATE OR REPLACE FUNCTION public.due_reminder_alerts(p_limit integer DEFAULT 200)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  reminder_id uuid,
  offset_minutes integer,
  last_notified_occurrence_at timestamptz,
  renotify_count integer,
  last_renotified_at timestamptz,
  title text,
  category public.reminder_category,
  due_at timestamptz,
  recurrence public.recurrence_kind,
  recurrence_interval_days integer,
  completed boolean,
  medicine_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id,
         a.user_id,
         a.reminder_id,
         a.offset_minutes,
         a.last_notified_occurrence_at,
         a.renotify_count,
         a.last_renotified_at,
         r.title,
         r.category,
         r.due_at,
         r.recurrence,
         r.recurrence_interval_days,
         r.completed,
         r.medicine_id
  FROM public.reminder_alerts a
  JOIN public.reminders r ON r.id = a.reminder_id
  WHERE NOT (r.recurrence = 'once' AND r.completed)
    -- the alert's fire moment for its first occurrence has arrived
    AND r.due_at - make_interval(mins => a.offset_minutes) <= now()
    -- already fully nudged for a recent occurrence: the next occurrence of any
    -- recurring reminder is at least a day away, so nothing is missed here
    AND NOT (
      COALESCE(a.renotify_count, 0) >= 3
      AND a.last_notified_occurrence_at IS NOT NULL
      AND a.last_notified_occurrence_at > now() - interval '1 hour'
    )
  ORDER BY r.due_at
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.due_reminder_alerts(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.due_reminder_alerts(integer) TO service_role;

-- cron schedule is changed separately (job is owned by another role).