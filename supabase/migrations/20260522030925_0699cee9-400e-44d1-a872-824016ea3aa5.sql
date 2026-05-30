
CREATE TABLE public.app_config (
  id TEXT PRIMARY KEY DEFAULT 'global',
  ir_window_days INTEGER NOT NULL DEFAULT 365,
  ir_points_per_recurrence INTEGER NOT NULL DEFAULT 5,
  ir_buckets JSONB NOT NULL DEFAULT '[{"max":0,"pct":100},{"max":5,"pct":90},{"max":10,"pct":60},{"max":15,"pct":30},{"max":999999,"pct":0}]'::jsonb,
  nc_weights JSONB NOT NULL DEFAULT '{"grave":8,"moderada":4,"leve":2,"melhoria":0}'::jsonb,
  ir_status_filter TEXT NOT NULL DEFAULT 'reprovado',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_read_all" ON public.app_config FOR SELECT USING (true);
CREATE POLICY "config_update_all" ON public.app_config FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "config_insert_all" ON public.app_config FOR INSERT WITH CHECK (true);

INSERT INTO public.app_config (id) VALUES ('global') ON CONFLICT DO NOTHING;
