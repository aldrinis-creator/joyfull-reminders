CREATE POLICY "Users manage their own alarm sounds"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'alarm-sounds' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'alarm-sounds' AND auth.uid()::text = (storage.foldername(name))[1]);