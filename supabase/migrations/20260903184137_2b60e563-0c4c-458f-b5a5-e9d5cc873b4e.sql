CREATE TABLE public.reminder_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_id uuid NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  family_member_id uuid NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (reminder_id, family_member_id)
);

CREATE INDEX reminder_recipients_reminder_idx ON public.reminder_recipients (reminder_id);
CREATE INDEX reminder_recipients_member_idx ON public.reminder_recipients (family_member_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_recipients TO authenticated;
GRANT ALL ON public.reminder_recipients TO service_role;

ALTER TABLE public.reminder_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own reminder recipients"
ON public.reminder_recipients FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

INSERT INTO public.reminder_recipients (user_id, reminder_id, family_member_id)
SELECT r.user_id, r.id, r.family_member_id
FROM public.reminders r
WHERE r.family_member_id IS NOT NULL
ON CONFLICT DO NOTHING;