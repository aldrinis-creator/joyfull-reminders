CREATE POLICY "No browser access to OTP challenges"
ON public.phone_otp_challenges
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);