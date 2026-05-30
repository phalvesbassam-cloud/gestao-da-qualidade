
ALTER TABLE public.nota_override
  ADD COLUMN IF NOT EXISTS codigo_item TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS lote TEXT NOT NULL DEFAULT '';

ALTER TABLE public.nota_override DROP CONSTRAINT IF EXISTS nota_override_pkey;
ALTER TABLE public.nota_override ADD PRIMARY KEY (processo, codigo_item, lote);
