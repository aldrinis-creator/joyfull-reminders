ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS upi_id text,
  ADD COLUMN IF NOT EXISTS upi_payee_name text;

ALTER TABLE public.vendors
  DROP CONSTRAINT IF EXISTS vendors_upi_id_format;

ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_upi_id_format
  CHECK (upi_id IS NULL OR upi_id ~ '^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9._-]{1,64}$');