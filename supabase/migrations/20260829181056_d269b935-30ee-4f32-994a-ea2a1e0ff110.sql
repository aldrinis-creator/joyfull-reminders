-- ENUMS
CREATE TYPE public.app_role AS ENUM ('user','vendor','admin');
CREATE TYPE public.reminder_category AS ENUM ('personal_family','finance_tax','automotive','academic_career','subscription','health','household','custom');
CREATE TYPE public.recurrence_kind AS ENUM ('once','daily','weekly','monthly','yearly','custom');
CREATE TYPE public.reminder_priority AS ENUM ('low','normal','high');
CREATE TYPE public.special_date_kind AS ENUM ('birthday','anniversary','memorial','exam','milestone','other');
CREATE TYPE public.vendor_kind AS ENUM ('florist','bakery','gift_shop','other');
CREATE TYPE public.order_status AS ENUM ('pending_payment','paid','confirmed','out_for_delivery','delivered','cancelled','failed');
CREATE TYPE public.payment_status AS ENUM ('created','captured','failed','refunded');
CREATE TYPE public.occurrence_status AS ENUM ('pending','snoozed','acknowledged','completed','missed');

-- ROLE HELPER
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  avatar_url text,
  city text,
  address text,
  latitude double precision,
  longitude double precision,
  alarm_sound text NOT NULL DEFAULT 'chime',
  push_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.phone)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- FAMILY
CREATE TABLE public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  relationship text NOT NULL DEFAULT 'Family',
  birth_date date,
  birth_year integer,
  photo_url text,
  likes text[] NOT NULL DEFAULT '{}',
  music_genres text[] NOT NULL DEFAULT '{}',
  gift_hints text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own family members" ON public.family_members FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER family_members_updated BEFORE UPDATE ON public.family_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.special_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_member_id uuid NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  kind public.special_date_kind NOT NULL DEFAULT 'birthday',
  title text NOT NULL,
  event_date date NOT NULL,
  recurring boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_dates TO authenticated;
GRANT ALL ON public.special_dates TO service_role;
ALTER TABLE public.special_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own special dates" ON public.special_dates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_member_id uuid REFERENCES public.family_members(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text,
  price_paise integer,
  notes text,
  fulfilled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_items TO authenticated;
GRANT ALL ON public.wishlist_items TO service_role;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wishlist" ON public.wishlist_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- REMINDERS
CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_member_id uuid REFERENCES public.family_members(id) ON DELETE SET NULL,
  title text NOT NULL,
  category public.reminder_category NOT NULL DEFAULT 'custom',
  description text,
  due_at timestamptz NOT NULL,
  birth_year integer,
  recurrence public.recurrence_kind NOT NULL DEFAULT 'once',
  recurrence_interval_days integer,
  priority public.reminder_priority NOT NULL DEFAULT 'normal',
  action_type text,
  amount_paise integer,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reminders" ON public.reminders FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER reminders_updated BEFORE UPDATE ON public.reminders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.reminder_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_id uuid NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  offset_minutes integer NOT NULL DEFAULT 0,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_alerts TO authenticated;
GRANT ALL ON public.reminder_alerts TO service_role;
ALTER TABLE public.reminder_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alerts" ON public.reminder_alerts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.reminder_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_id uuid NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  occurrence_at timestamptz NOT NULL,
  status public.occurrence_status NOT NULL DEFAULT 'pending',
  snoozed_until timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_occurrences TO authenticated;
GRANT ALL ON public.reminder_occurrences TO service_role;
ALTER TABLE public.reminder_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own occurrences" ON public.reminder_occurrences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_id uuid NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  label text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_items TO authenticated;
GRANT ALL ON public.checklist_items TO service_role;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checklist" ON public.checklist_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- STREAKS
CREATE TABLE public.user_streaks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_completed_on date,
  badges text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_streaks TO authenticated;
GRANT ALL ON public.user_streaks TO service_role;
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own streaks" ON public.user_streaks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- VENDORS
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  kind public.vendor_kind NOT NULL DEFAULT 'gift_shop',
  description text,
  city text,
  address text,
  phone text,
  image_url text,
  latitude double precision,
  longitude double precision,
  rating numeric(2,1) NOT NULL DEFAULT 4.5,
  service_radius_km integer NOT NULL DEFAULT 5,
  ships_all_india boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vendors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active vendors public" ON public.vendors FOR SELECT USING (is_active = true);
CREATE POLICY "vendor manages own shop" ON public.vendors FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER vendors_updated BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.vendor_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_paise integer NOT NULL,
  image_url text,
  tag text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vendor_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_products TO authenticated;
GRANT ALL ON public.vendor_products TO service_role;
ALTER TABLE public.vendor_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active products public" ON public.vendor_products FOR SELECT USING (is_active = true);
CREATE POLICY "vendor manages own products" ON public.vendor_products FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.owner_id = auth.uid()));

-- ORDERS
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  product_id uuid REFERENCES public.vendor_products(id) ON DELETE SET NULL,
  reminder_id uuid REFERENCES public.reminders(id) ON DELETE SET NULL,
  family_member_id uuid REFERENCES public.family_members(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  amount_paise integer NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending_payment',
  recipient_name text,
  delivery_address text,
  delivery_date date,
  gift_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own orders" ON public.orders FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vendor sees its orders" ON public.orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.owner_id = auth.uid()));
CREATE POLICY "vendor updates its orders" ON public.orders FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.owner_id = auth.uid()));
CREATE TRIGGER orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status public.order_status NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_events TO authenticated;
GRANT ALL ON public.order_events TO service_role;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see own order events" ON public.order_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = o.vendor_id AND v.owner_id = auth.uid()))));
CREATE POLICY "vendor adds order events" ON public.order_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o JOIN public.vendors v ON v.id = o.vendor_id WHERE o.id = order_id AND v.owner_id = auth.uid()));

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'razorpay',
  provider_order_id text,
  provider_payment_id text,
  amount_paise integer NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'created',
  signature_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_provider_order_idx ON public.payments (provider_order_id);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payments" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SEED DEMO VENDORS
INSERT INTO public.vendors (id, name, kind, description, city, address, phone, rating, service_radius_km, ships_all_india, is_demo, latitude, longitude, image_url) VALUES
 ('11111111-1111-4111-8111-000000000001','Blossom & Bloom','florist','Hand-tied bouquets and fresh roses, delivered the same day.','Mumbai','Shop 4, Linking Road, Bandra West','+91 98200 11223',4.8,5,true,true,19.0596,72.8295,null),
 ('11111111-1111-4111-8111-000000000002','Sugar Street Bakery','bakery','Eggless cakes, cheesecakes and custom photo cakes baked fresh daily.','Mumbai','12 Hill Road, Bandra West','+91 98200 44556',4.7,4,false,true,19.0544,72.8302,null),
 ('11111111-1111-4111-8111-000000000003','The Gift Loft','gift_shop','Curated hampers, personalised mugs and keepsakes for every milestone.','Mumbai','7 Turner Road, Bandra West','+91 98200 77889',4.6,5,true,true,19.0620,72.8340,null),
 ('11111111-1111-4111-8111-000000000004','Petal Post','florist','Pan-India flower delivery with next-day dispatch.','Delhi','21 Khan Market','+91 98110 22334',4.5,5,true,true,28.5996,77.2270,null),
 ('11111111-1111-4111-8111-000000000005','Cocoa Craft Patisserie','bakery','Belgian chocolate truffle cakes and celebration desserts.','Bengaluru','44 Indiranagar 100ft Road','+91 98450 55667',4.9,3,false,true,12.9719,77.6412,null),
 ('11111111-1111-4111-8111-000000000006','Smiles & Surprises','gift_shop','Surprise boxes, balloon decor and last-minute gifting.','Bengaluru','9 Koramangala 5th Block','+91 98450 88990',4.4,5,true,true,12.9345,77.6266,null);

INSERT INTO public.vendor_products (vendor_id, name, description, price_paise, tag) VALUES
 ('11111111-1111-4111-8111-000000000001','Red Rose Bouquet (12)','A dozen long-stem red roses with baby''s breath.',89900,'Bestseller'),
 ('11111111-1111-4111-8111-000000000001','Mixed Seasonal Bunch','Lilies, carnations and gerberas in a jute wrap.',74900,null),
 ('11111111-1111-4111-8111-000000000001','Orchid Elegance','Purple orchids in a ceramic vase.',129900,'Premium'),
 ('11111111-1111-4111-8111-000000000002','Half Kg Chocolate Truffle','Rich Belgian chocolate, eggless.',64900,'Bestseller'),
 ('11111111-1111-4111-8111-000000000002','1 Kg Photo Cake','Edible photo print on vanilla sponge.',124900,null),
 ('11111111-1111-4111-8111-000000000002','Red Velvet Jar Set (4)','Individually packed cake jars.',59900,null),
 ('11111111-1111-4111-8111-000000000003','Deluxe Celebration Hamper','Dry fruits, chocolates, candle and card.',159900,'Premium'),
 ('11111111-1111-4111-8111-000000000003','Personalised Photo Mug','Printed with your favourite picture.',44900,null),
 ('11111111-1111-4111-8111-000000000004','Sunshine Gerbera Box','Yellow gerberas in a signature hat box.',99900,null),
 ('11111111-1111-4111-8111-000000000004','Anniversary Rose Heart','50 roses arranged in a heart.',249900,'Premium'),
 ('11111111-1111-4111-8111-000000000005','Hazelnut Praline Cake 1Kg','Layered praline with roasted hazelnuts.',144900,'Bestseller'),
 ('11111111-1111-4111-8111-000000000005','Assorted Macaron Box (12)','Twelve French macarons.',89900,null),
 ('11111111-1111-4111-8111-000000000006','Balloon Surprise Box','Pop-open box with balloons and a note.',79900,null),
 ('11111111-1111-4111-8111-000000000006','Memory Scrapbook Kit','Build-your-own photo scrapbook.',54900,null);