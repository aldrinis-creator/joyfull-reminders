CREATE POLICY "Users manage their own greeting voice notes"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'greeting-voice-notes' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'greeting-voice-notes' AND (storage.foldername(name))[1] = auth.uid()::text);