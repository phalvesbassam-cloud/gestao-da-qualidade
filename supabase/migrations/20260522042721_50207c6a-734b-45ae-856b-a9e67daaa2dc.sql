
-- Tabela de evidências
CREATE TABLE public.rnc_evidencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rnc_id text NOT NULL,
  url text NOT NULL,
  nome text NOT NULL,
  tipo text,
  observacao text,
  autor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rnc_evidencia_rnc_id ON public.rnc_evidencia(rnc_id);

ALTER TABLE public.rnc_evidencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidencia_read_all" ON public.rnc_evidencia FOR SELECT USING (true);
CREATE POLICY "evidencia_insert_all" ON public.rnc_evidencia FOR INSERT WITH CHECK (true);
CREATE POLICY "evidencia_delete_all" ON public.rnc_evidencia FOR DELETE USING (true);
CREATE POLICY "evidencia_update_all" ON public.rnc_evidencia FOR UPDATE USING (true) WITH CHECK (true);

-- Bucket público
INSERT INTO storage.buckets (id, name, public) VALUES ('rnc-evidencias', 'rnc-evidencias', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "rnc_evi_read" ON storage.objects FOR SELECT USING (bucket_id = 'rnc-evidencias');
CREATE POLICY "rnc_evi_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'rnc-evidencias');
CREATE POLICY "rnc_evi_delete" ON storage.objects FOR DELETE USING (bucket_id = 'rnc-evidencias');
CREATE POLICY "rnc_evi_update" ON storage.objects FOR UPDATE USING (bucket_id = 'rnc-evidencias');
