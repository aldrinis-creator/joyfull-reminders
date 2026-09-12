CREATE TYPE public.document_type AS ENUM ('insurance','puc','id_proof','vehicle','warranty','subscription','other');

CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  family_member_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  doc_type public.document_type NOT NULL DEFAULT 'other',
  file_path TEXT NOT NULL,
  expiry_date DATE,
  notes TEXT,
  reminder_id UUID REFERENCES public.reminders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own documents"
  ON public.documents FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX documents_user_expiry_idx ON public.documents (user_id, expiry_date);

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Users manage their own documents files"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = (auth.uid())::text)
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = (auth.uid())::text);