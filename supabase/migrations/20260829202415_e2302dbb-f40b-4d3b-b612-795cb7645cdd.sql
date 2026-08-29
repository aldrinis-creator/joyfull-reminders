ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pincode text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_pincode text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_city text;