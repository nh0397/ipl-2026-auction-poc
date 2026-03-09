-- Pre-seed Authorized Users for IPL 2026 Auction POC
-- This version uses a robust NOT EXISTS check to avoid constraint errors.

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data, role, aud)
SELECT 
  gen_random_uuid(), 
  v.email, 
  now(), 
  v.meta::jsonb, 
  'authenticated', 
  'authenticated'
FROM (VALUES 
  ('project7072@gmail.com', '{"full_name": "System Admin"}'),
  ('jalan.me4u@gmail.com', '{"full_name": "Prashant Jalan"}'),
  ('harshshah661992@gmail.com', '{"full_name": "Harsh Shah"}'),
  ('parthshah8462@gmail.com', '{"full_name": "Parth Shah"}'),
  ('vatsalchilodiya@gmail.com', '{"full_name": "Vatsal Chilodiya"}'),
  ('naisicric97@gmail.com', '{"full_name": "Naisarg Halvadiya"}')
) AS v(email, meta)
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE auth.users.email = v.email
);

-- 2. Ensure your account is Admin
UPDATE profiles SET role = 'Admin' 
WHERE id = (SELECT id FROM auth.users WHERE email = 'project7072@gmail.com');

-- Disable RLS for now so you can see all profiles
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
