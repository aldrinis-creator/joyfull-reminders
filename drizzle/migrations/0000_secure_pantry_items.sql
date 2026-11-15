GRANT SELECT, INSERT, UPDATE, DELETE ON public.pantry_items TO authenticated;
GRANT ALL ON public.pantry_items TO service_role;

ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own pantry items" ON public.pantry_items;
DROP POLICY IF EXISTS "Users can update their own pantry items" ON public.pantry_items;
DROP POLICY IF EXISTS "Users can delete their own pantry items" ON public.pantry_items;
DROP POLICY IF EXISTS "Users can add their own pantry items" ON public.pantry_items;

CREATE POLICY "Users can view their own pantry items" ON public.pantry_items
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can add their own pantry items" ON public.pantry_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own pantry items" ON public.pantry_items
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own pantry items" ON public.pantry_items
  FOR DELETE TO authenticated USING (auth.uid() = user_id);