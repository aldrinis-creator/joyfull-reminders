ALTER TYPE public.reminder_category ADD VALUE IF NOT EXISTS 'appointment';
ALTER TYPE public.reminder_category ADD VALUE IF NOT EXISTS 'meeting';

ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS participants text,
  ADD COLUMN IF NOT EXISTS vehicle_number text,
  ADD COLUMN IF NOT EXISTS institution text,
  ADD COLUMN IF NOT EXISTS occasion_kind public.special_date_kind;