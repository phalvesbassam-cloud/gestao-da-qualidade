
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autor text NOT NULL,
  acao text NOT NULL,
  entidade text NOT NULL,
  entidade_id text,
  fornecedor text,
  item text,
  dados jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_autor ON public.audit_log(autor);
CREATE INDEX idx_audit_log_entidade ON public.audit_log(entidade);
CREATE INDEX idx_audit_log_fornecedor ON public.audit_log(fornecedor);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_read_all" ON public.audit_log FOR SELECT USING (true);
CREATE POLICY "audit_insert_all" ON public.audit_log FOR INSERT WITH CHECK (true);
