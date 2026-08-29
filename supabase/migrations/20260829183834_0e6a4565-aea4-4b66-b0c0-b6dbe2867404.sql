ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS whatsapp_phone text,
  ADD COLUMN IF NOT EXISTS pincode text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS greetings_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS pincode text,
  ADD COLUMN IF NOT EXISTS serviceable_pincodes text[] NOT NULL DEFAULT '{}'::text[];

CREATE TABLE IF NOT EXISTS public.pincodes (
  code text PRIMARY KEY,
  city text NOT NULL,
  state text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pincodes TO anon;
GRANT SELECT ON public.pincodes TO authenticated;
GRANT ALL ON public.pincodes TO service_role;

ALTER TABLE public.pincodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pincodes readable by everyone"
  ON public.pincodes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TYPE public.greeting_channel AS ENUM ('email', 'whatsapp', 'share');
CREATE TYPE public.greeting_status AS ENUM ('draft', 'sent', 'failed', 'skipped');

CREATE TABLE public.greetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_member_id uuid REFERENCES public.family_members(id) ON DELETE CASCADE,
  reminder_id uuid REFERENCES public.reminders(id) ON DELETE SET NULL,
  occasion text NOT NULL DEFAULT 'birthday',
  occasion_key text NOT NULL,
  channel public.greeting_channel NOT NULL DEFAULT 'share',
  recipient text,
  card_style text NOT NULL DEFAULT 'confetti',
  message text NOT NULL,
  status public.greeting_status NOT NULL DEFAULT 'draft',
  provider_message_id text,
  error_message text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX greetings_unique_occasion
  ON public.greetings (user_id, family_member_id, occasion_key, channel)
  WHERE status = 'sent';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.greetings TO authenticated;
GRANT ALL ON public.greetings TO service_role;

ALTER TABLE public.greetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own greetings"
  ON public.greetings FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER greetings_updated
  BEFORE UPDATE ON public.greetings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.pincodes (code, city, state, latitude, longitude) VALUES
  ('400001','Mumbai','Maharashtra',18.9388,72.8354),
  ('400051','Mumbai','Maharashtra',19.0596,72.8295),
  ('400705','Navi Mumbai','Maharashtra',19.0330,73.0297),
  ('411001','Pune','Maharashtra',18.5196,73.8553),
  ('110001','New Delhi','Delhi',28.6330,77.2194),
  ('110024','New Delhi','Delhi',28.5680,77.2430),
  ('122001','Gurugram','Haryana',28.4595,77.0266),
  ('201301','Noida','Uttar Pradesh',28.5708,77.3260),
  ('560001','Bengaluru','Karnataka',12.9767,77.5993),
  ('560034','Bengaluru','Karnataka',12.9279,77.6271),
  ('600001','Chennai','Tamil Nadu',13.0918,80.2829),
  ('600040','Chennai','Tamil Nadu',13.0500,80.2200),
  ('500001','Hyderabad','Telangana',17.3850,78.4867),
  ('500081','Hyderabad','Telangana',17.4435,78.3772),
  ('700001','Kolkata','West Bengal',22.5726,88.3639),
  ('700091','Kolkata','West Bengal',22.5750,88.4300),
  ('380001','Ahmedabad','Gujarat',23.0225,72.5714),
  ('302001','Jaipur','Rajasthan',26.9124,75.7873),
  ('226001','Lucknow','Uttar Pradesh',26.8467,80.9462),
  ('682001','Kochi','Kerala',9.9312,76.2673),
  ('641001','Coimbatore','Tamil Nadu',11.0168,76.9558),
  ('452001','Indore','Madhya Pradesh',22.7196,75.8577),
  ('800001','Patna','Bihar',25.5941,85.1376),
  ('751001','Bhubaneswar','Odisha',20.2961,85.8245),
  ('160017','Chandigarh','Chandigarh',30.7333,76.7794),
  ('530001','Visakhapatnam','Andhra Pradesh',17.6868,83.2185),
  ('440001','Nagpur','Maharashtra',21.1458,79.0882),
  ('395001','Surat','Gujarat',21.1702,72.8311),
  ('781001','Guwahati','Assam',26.1445,91.7362),
  ('248001','Dehradun','Uttarakhand',30.3165,78.0322)
ON CONFLICT (code) DO NOTHING;

UPDATE public.vendors SET pincode = CASE city
  WHEN 'Mumbai' THEN '400051'
  WHEN 'Delhi' THEN '110024'
  WHEN 'New Delhi' THEN '110024'
  WHEN 'Bengaluru' THEN '560034'
  ELSE pincode END
WHERE pincode IS NULL;