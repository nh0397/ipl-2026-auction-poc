-- Pre-seed Authorized Users for IPL 2026 Auction POC
-- These profiles will be linked to real Google OAuth users when they first log in.
-- The trigger in schema.sql handles updating the UUID to match the auth user.

-- NOTE: Do NOT insert into auth.users manually. Let Google OAuth handle that.
-- We only seed profiles with a temporary UUID that gets replaced on first login.

INSERT INTO profiles (id, email, full_name, role, budget) VALUES
  (gen_random_uuid(), 'project7072@gmail.com', 'System Admin', 'Admin', 120),
  (gen_random_uuid(), 'jalan.me4u@gmail.com', 'Prashant Jalan', 'Admin', 120),
  (gen_random_uuid(), 'harshshah661992@gmail.com', 'Harsh Shah', 'Participant', 120),
  (gen_random_uuid(), 'parthshah8462@gmail.com', 'Parth Shah', 'Participant', 120),
  (gen_random_uuid(), 'vatsalchilodiya@gmail.com', 'Vatsal Chilodiya', 'Participant', 120),
  (gen_random_uuid(), 'naisicric97@gmail.com', 'Naisarg Halvadiya', 'Participant', 120)
ON CONFLICT (email) DO NOTHING;

-- Disable RLS for now so you can see all profiles
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
