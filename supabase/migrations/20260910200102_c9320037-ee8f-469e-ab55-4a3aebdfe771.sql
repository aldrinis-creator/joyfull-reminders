ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS alarm_volume numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS alarm_sound_path text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_alarm_volume_range CHECK (alarm_volume >= 0 AND alarm_volume <= 1);