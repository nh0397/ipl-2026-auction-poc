CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_id UUID;
  assigned_role TEXT;
BEGIN
  IF lower(new.email) = 'project7072@gmail.com' THEN
    assigned_role := 'Admin';
  ELSE
    assigned_role := 'Viewer';
  END IF;

  SELECT id INTO existing_id
  FROM public.profiles
  WHERE lower(email) = lower(new.email);

  IF existing_id IS NOT NULL THEN
    UPDATE public.profiles
    SET
      id = new.id,
      full_name = COALESCE(new.raw_user_meta_data->>'full_name', full_name),
      avatar_url = COALESCE(new.raw_user_meta_data->>'avatar_url', avatar_url),
      role = assigned_role,
      updated_at = NOW()
    WHERE lower(email) = lower(new.email);
  ELSE
    INSERT INTO public.profiles (id, email, full_name, avatar_url, role, budget)
    VALUES (
      new.id,
      new.email,
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'avatar_url',
      assigned_role,
      CASE WHEN assigned_role = 'Viewer' THEN 0 ELSE 120 END
    );
  END IF;

  RETURN NEW;
END;
$$;
