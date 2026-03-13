-- CREATE AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id),
    admin_name TEXT,
    action_type TEXT NOT NULL,
    details JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ENABLE REAL-TIME
-- Note: You might need to check if the publication already exists or add to it manually
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;

-- ENABLE RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ALLOW ADMINS TO READ/WRITE
CREATE POLICY "Admins can manage audit logs" 
ON public.audit_logs
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'Admin'
  )
);
