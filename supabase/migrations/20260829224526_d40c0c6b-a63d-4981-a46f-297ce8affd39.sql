ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS payment_url text,
  ADD COLUMN IF NOT EXISTS upi_id text,
  ADD COLUMN IF NOT EXISTS upi_payee_name text,
  ADD COLUMN IF NOT EXISTS payment_amount numeric(12,2);

ALTER TABLE public.reminders
  ADD CONSTRAINT reminders_payment_amount_nonneg CHECK (payment_amount IS NULL OR payment_amount >= 0);