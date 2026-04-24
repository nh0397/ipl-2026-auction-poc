ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_admin_manage ON public.profiles;
CREATE POLICY profiles_admin_manage
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles AS me
    WHERE me.id = auth.uid()
      AND me.role = 'Admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles AS me
    WHERE me.id = auth.uid()
      AND me.role = 'Admin'
  )
);
