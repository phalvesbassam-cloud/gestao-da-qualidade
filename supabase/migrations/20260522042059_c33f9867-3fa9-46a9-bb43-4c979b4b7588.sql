
CREATE TABLE IF NOT EXISTS public.nota_override (
  processo text PRIMARY KEY,
  nota_final numeric NOT NULL,
  motivo text NOT NULL,
  observacao text,
  autor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nota_override ENABLE ROW LEVEL SECURITY;

CREATE POLICY "override_read_all" ON public.nota_override FOR SELECT USING (true);
CREATE POLICY "override_insert_all" ON public.nota_override FOR INSERT WITH CHECK (true);
CREATE POLICY "override_update_all" ON public.nota_override FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "override_delete_all" ON public.nota_override FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS nota_override_touch ON public.nota_override;
CREATE TRIGGER nota_override_touch BEFORE UPDATE ON public.nota_override
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
