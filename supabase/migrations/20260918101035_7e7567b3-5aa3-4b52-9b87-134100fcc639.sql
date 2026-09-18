INSERT INTO public.reminder_alerts (user_id, reminder_id, offset_minutes)
SELECT r.user_id, r.id, 0
FROM public.reminders r
WHERE r.category = 'health'
  AND r.medicine_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.reminder_alerts a WHERE a.reminder_id = r.id
  );