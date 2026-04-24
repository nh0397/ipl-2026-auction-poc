CREATE TABLE IF NOT EXISTS public.workflow_dispatch_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  app_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  app_user_email TEXT,
  workflow_id TEXT NOT NULL,
  date_ist TEXT,
  ref TEXT NOT NULL,
  github_run_id BIGINT,
  github_run_number INTEGER,
  github_actor TEXT,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS workflow_dispatch_events_created_at_idx
  ON public.workflow_dispatch_events (created_at DESC);
