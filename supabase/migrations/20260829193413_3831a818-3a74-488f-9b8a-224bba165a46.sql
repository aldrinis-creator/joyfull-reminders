-- 1. Orders can no longer be created directly from the browser; only the
--    server (service role) may insert, so the price is always authoritative.
REVOKE INSERT ON public.orders FROM authenticated;
DROP POLICY IF EXISTS "own orders" ON public.orders;
CREATE POLICY "read own orders" ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "update own orders" ON public.orders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own orders" ON public.orders FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 2. Keep the SECURITY DEFINER role helper out of reach of signed-in users.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated, anon, PUBLIC;