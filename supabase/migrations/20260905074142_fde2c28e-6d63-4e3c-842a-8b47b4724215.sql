ALTER TABLE public.greetings
  ADD COLUMN IF NOT EXISTS voice_note_path text,
  ADD COLUMN IF NOT EXISTS voice_note_seconds integer;