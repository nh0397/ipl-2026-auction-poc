SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict WS0jA9yRUmYfPKWe2ckzRKoF0gmGmhNG5GlGDTchGXmBhpV7CDq1SNcZwFQrl0g

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."flow_state" ("id", "user_id", "auth_code", "code_challenge_method", "code_challenge", "provider_type", "provider_access_token", "provider_refresh_token", "created_at", "updated_at", "authentication_method", "auth_code_issued_at", "invite_token", "referrer", "oauth_client_state_id", "linking_target_id", "email_optional") VALUES
	('d453ce0b-1296-4f30-bc1c-07b5081f86c9', NULL, NULL, NULL, NULL, 'google', '', '', '2026-03-09 22:13:48.613989+00', '2026-03-09 22:13:48.613989+00', 'oauth', NULL, NULL, 'http://localhost:3001/auth/callback', NULL, NULL, false),
	('1aeae18d-e1ee-4259-a0a8-087f2722a33f', NULL, NULL, NULL, NULL, 'google', '', '', '2026-03-09 22:14:01.386399+00', '2026-03-09 22:14:01.386399+00', 'oauth', NULL, NULL, 'http://localhost:3001/auth/callback', NULL, NULL, false),
	('6d551e7c-caab-4c69-a66d-b7bd21f3f4d4', NULL, NULL, NULL, NULL, 'google', '', '', '2026-03-09 22:14:23.338735+00', '2026-03-09 22:14:23.338735+00', 'oauth', NULL, NULL, 'http://localhost:3001/auth/callback', NULL, NULL, false),
	('4f937186-e140-4620-b54e-ad1a494e858f', NULL, NULL, NULL, NULL, 'google', '', '', '2026-03-09 22:17:09.38462+00', '2026-03-09 22:17:09.38462+00', 'oauth', NULL, NULL, 'http://localhost:3001/auth/callback', NULL, NULL, false),
	('962d4a1f-fbe5-48b0-9b79-72515aaa9b7e', NULL, NULL, NULL, NULL, 'google', '', '', '2026-03-09 22:18:26.598179+00', '2026-03-09 22:18:26.598179+00', 'oauth', NULL, NULL, 'http://localhost:3001/auth/callback', NULL, NULL, false),
	('9e482097-79ba-4391-a884-8fcab3ab29cf', NULL, NULL, NULL, NULL, 'google', '', '', '2026-03-09 22:25:51.316598+00', '2026-03-09 22:25:51.316598+00', 'oauth', NULL, NULL, 'http://localhost:3001/auth/callback', NULL, NULL, false),
	('d0d7e70f-9542-4409-b481-18585d2690ae', NULL, NULL, NULL, NULL, 'google', '', '', '2026-03-09 22:27:18.502287+00', '2026-03-09 22:27:18.502287+00', 'oauth', NULL, NULL, 'http://localhost:3001/auth/callback', NULL, NULL, false),
	('de6e2a4a-82a6-4d71-bd4b-a0b8843d6893', NULL, NULL, NULL, NULL, 'google', '', '', '2026-03-10 03:11:17.584043+00', '2026-03-10 03:11:17.584043+00', 'oauth', NULL, NULL, 'https://ipl-2026-auction-poc.vercel.app/auth/callback', NULL, NULL, false),
	('90658726-e82b-4722-9e08-e7d4fbb5bee7', NULL, NULL, NULL, NULL, 'google', '', '', '2026-03-10 05:30:41.678719+00', '2026-03-10 05:30:41.678719+00', 'oauth', NULL, NULL, 'https://ipl-2026-auction-poc.vercel.app/auth/callback', NULL, NULL, false),
	('1d29be0d-6626-4c4c-8320-66e4cf0965cf', NULL, NULL, NULL, NULL, 'google', '', '', '2026-03-10 06:52:48.420648+00', '2026-03-10 06:52:48.420648+00', 'oauth', NULL, NULL, 'https://ipl-2026-auction-poc.vercel.app/auth/callback', NULL, NULL, false),
	('df92f752-db36-4628-84ad-bc1735ef8306', NULL, NULL, NULL, NULL, 'google', '', '', '2026-03-10 06:55:18.35111+00', '2026-03-10 06:55:18.35111+00', 'oauth', NULL, NULL, 'https://ipl-2026-auction-poc.vercel.app/auth/callback', NULL, NULL, false),
	('c60cddda-7f74-42fa-a545-416ac8dd53fe', NULL, NULL, NULL, NULL, 'google', '', '', '2026-03-10 07:25:40.751969+00', '2026-03-10 07:25:40.751969+00', 'oauth', NULL, NULL, 'https://ipl-2026-auction-poc.vercel.app/auth/callback', NULL, NULL, false),
	('dcaf1a8b-d768-41bc-954f-52734802b863', NULL, NULL, NULL, NULL, 'google', '', '', '2026-03-10 07:26:11.686461+00', '2026-03-10 07:26:11.686461+00', 'oauth', NULL, NULL, 'https://ipl-2026-auction-poc.vercel.app/auth/callback', NULL, NULL, false),
	('25c360a8-876f-42a5-ab15-9a451ff6cf86', NULL, NULL, NULL, NULL, 'google', '', '', '2026-03-10 14:29:44.673669+00', '2026-03-10 14:29:44.673669+00', 'oauth', NULL, NULL, 'https://ipl-2026-auction-poc.vercel.app/auth/callback', NULL, NULL, false),
	('d1bbe3f5-f842-4a51-8320-7bc33a0c2f6f', NULL, NULL, NULL, NULL, 'google', '', '', '2026-03-10 15:20:09.480415+00', '2026-03-10 15:20:09.480415+00', 'oauth', NULL, NULL, 'https://ipl-2026-auction-poc.vercel.app/auth/callback', NULL, NULL, false),
	('42914350-eca2-4091-b34e-5e5ac76c0c0a', NULL, NULL, NULL, NULL, 'google', '', '', '2026-03-11 03:15:06.076973+00', '2026-03-11 03:15:06.076973+00', 'oauth', NULL, NULL, 'https://ipl-2026-auction-poc.vercel.app/auth/callback', NULL, NULL, false);


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', 'aec4f3a8-eb15-416e-b407-0b4884e186a5', 'authenticated', 'authenticated', 'project7072@gmail.com', NULL, '2026-03-11 01:29:00.651997+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-03-11 01:32:21.716723+00', '{"provider": "google", "providers": ["google"]}', '{"iss": "https://accounts.google.com", "sub": "110769112142857610916", "name": "Project 7072", "email": "project7072@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocLFnKLDThfQUA9GX_eWEPfQZLkfYs8QoLkJCLhNgFIlKJARpQ=s96-c", "full_name": "Project 7072", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocLFnKLDThfQUA9GX_eWEPfQZLkfYs8QoLkJCLhNgFIlKJARpQ=s96-c", "provider_id": "110769112142857610916", "email_verified": true, "phone_verified": false}', NULL, '2026-03-11 01:29:00.632184+00', '2026-03-11 01:32:21.721472+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '1685dfdd-00b9-41dc-b652-e311019c764a', 'authenticated', 'authenticated', 'harshshah661992@gmail.com', NULL, '2026-03-11 16:08:56.940481+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-03-11 16:08:56.945835+00', '{"provider": "google", "providers": ["google"]}', '{"iss": "https://accounts.google.com", "sub": "118071117836199218340", "name": "Harsh Shah", "email": "harshshah661992@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocJZK38MalwunRwknQXtLUsEdKe0vWrEcxkyWRnKMpQlyi9jYejlQw=s96-c", "full_name": "Harsh Shah", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocJZK38MalwunRwknQXtLUsEdKe0vWrEcxkyWRnKMpQlyi9jYejlQw=s96-c", "provider_id": "118071117836199218340", "email_verified": true, "phone_verified": false}', NULL, '2026-03-11 16:08:56.919402+00', '2026-03-11 17:17:26.586776+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '365433f9-feba-4aed-bab6-5e2037b8be16', 'authenticated', 'authenticated', 'tradingwithparthshah@gmail.com', NULL, '2026-03-11 06:07:15.921702+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-03-11 06:07:15.931573+00', '{"provider": "google", "providers": ["google"]}', '{"iss": "https://accounts.google.com", "sub": "111980940559515619877", "name": "Parth", "email": "tradingwithparthshah@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIKTJZFzeYs-u3Fb7xdvl2BuSLdgRxNUE0vjRyuq9ngVDCPjQ=s96-c", "full_name": "Parth", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIKTJZFzeYs-u3Fb7xdvl2BuSLdgRxNUE0vjRyuq9ngVDCPjQ=s96-c", "provider_id": "111980940559515619877", "email_verified": true, "phone_verified": false}', NULL, '2026-03-11 06:07:15.86942+00', '2026-03-11 11:18:29.993144+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'b6ea0551-f997-4f67-9065-ec24d0d0ce84', 'authenticated', 'authenticated', 'naisicric97@gmail.com', NULL, '2026-03-11 01:29:04.656621+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-03-11 16:02:49.863912+00', '{"provider": "google", "providers": ["google"]}', '{"iss": "https://accounts.google.com", "sub": "104775947337945380960", "name": "Naisarg Halvadia", "email": "naisicric97@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocKonobI09yuPC3WOfY7mJixSaJxah9sh8VaMetpQOatabOspRN1=s96-c", "full_name": "Naisarg Halvadia", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocKonobI09yuPC3WOfY7mJixSaJxah9sh8VaMetpQOatabOspRN1=s96-c", "provider_id": "104775947337945380960", "email_verified": true, "phone_verified": false}', NULL, '2026-03-11 01:29:04.651832+00', '2026-03-11 16:02:49.879295+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'a6d318ca-20a7-4b37-9976-1fb0ea12fdb4', 'authenticated', 'authenticated', 'jalan.me4u@gmail.com', NULL, '2026-03-11 22:01:46.480388+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-03-11 22:01:46.488873+00', '{"provider": "google", "providers": ["google"]}', '{"iss": "https://accounts.google.com", "sub": "107768967394144921062", "name": "Prashant Jalan", "email": "jalan.me4u@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocKR1k3w8qu93IRbBhdl1DySk0iVkjtSuLhNRWHJe_CTUh9IGfx-RQ=s96-c", "full_name": "Prashant Jalan", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocKR1k3w8qu93IRbBhdl1DySk0iVkjtSuLhNRWHJe_CTUh9IGfx-RQ=s96-c", "provider_id": "107768967394144921062", "email_verified": true, "phone_verified": false}', NULL, '2026-03-11 22:01:46.438328+00', '2026-03-11 22:01:46.528621+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('118071117836199218340', '1685dfdd-00b9-41dc-b652-e311019c764a', '{"iss": "https://accounts.google.com", "sub": "118071117836199218340", "name": "Harsh Shah", "email": "harshshah661992@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocJZK38MalwunRwknQXtLUsEdKe0vWrEcxkyWRnKMpQlyi9jYejlQw=s96-c", "full_name": "Harsh Shah", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocJZK38MalwunRwknQXtLUsEdKe0vWrEcxkyWRnKMpQlyi9jYejlQw=s96-c", "provider_id": "118071117836199218340", "email_verified": true, "phone_verified": false}', 'google', '2026-03-11 16:08:56.934133+00', '2026-03-11 16:08:56.934184+00', '2026-03-11 16:08:56.934184+00', '5822adee-e388-4ccb-b7a9-cd241cab90c8'),
	('107768967394144921062', 'a6d318ca-20a7-4b37-9976-1fb0ea12fdb4', '{"iss": "https://accounts.google.com", "sub": "107768967394144921062", "name": "Prashant Jalan", "email": "jalan.me4u@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocKR1k3w8qu93IRbBhdl1DySk0iVkjtSuLhNRWHJe_CTUh9IGfx-RQ=s96-c", "full_name": "Prashant Jalan", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocKR1k3w8qu93IRbBhdl1DySk0iVkjtSuLhNRWHJe_CTUh9IGfx-RQ=s96-c", "provider_id": "107768967394144921062", "email_verified": true, "phone_verified": false}', 'google', '2026-03-11 22:01:46.472313+00', '2026-03-11 22:01:46.472366+00', '2026-03-11 22:01:46.472366+00', '0728fdcc-cbe2-45b5-9538-ee9a2d791340'),
	('110769112142857610916', 'aec4f3a8-eb15-416e-b407-0b4884e186a5', '{"iss": "https://accounts.google.com", "sub": "110769112142857610916", "name": "Project 7072", "email": "project7072@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocLFnKLDThfQUA9GX_eWEPfQZLkfYs8QoLkJCLhNgFIlKJARpQ=s96-c", "full_name": "Project 7072", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocLFnKLDThfQUA9GX_eWEPfQZLkfYs8QoLkJCLhNgFIlKJARpQ=s96-c", "provider_id": "110769112142857610916", "email_verified": true, "phone_verified": false}', 'google', '2026-03-11 01:29:00.642362+00', '2026-03-11 01:29:00.642704+00', '2026-03-11 01:32:21.712539+00', '1c20bce2-debc-4880-aea6-6c1b8a63abb9'),
	('111980940559515619877', '365433f9-feba-4aed-bab6-5e2037b8be16', '{"iss": "https://accounts.google.com", "sub": "111980940559515619877", "name": "Parth", "email": "tradingwithparthshah@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIKTJZFzeYs-u3Fb7xdvl2BuSLdgRxNUE0vjRyuq9ngVDCPjQ=s96-c", "full_name": "Parth", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIKTJZFzeYs-u3Fb7xdvl2BuSLdgRxNUE0vjRyuq9ngVDCPjQ=s96-c", "provider_id": "111980940559515619877", "email_verified": true, "phone_verified": false}', 'google', '2026-03-11 06:07:15.913322+00', '2026-03-11 06:07:15.913418+00', '2026-03-11 06:07:15.913418+00', 'e85ce16b-a11b-4011-90e0-4997ac380b5f'),
	('104775947337945380960', 'b6ea0551-f997-4f67-9065-ec24d0d0ce84', '{"iss": "https://accounts.google.com", "sub": "104775947337945380960", "name": "Naisarg Halvadia", "email": "naisicric97@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocKonobI09yuPC3WOfY7mJixSaJxah9sh8VaMetpQOatabOspRN1=s96-c", "full_name": "Naisarg Halvadia", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocKonobI09yuPC3WOfY7mJixSaJxah9sh8VaMetpQOatabOspRN1=s96-c", "provider_id": "104775947337945380960", "email_verified": true, "phone_verified": false}', 'google', '2026-03-11 01:29:04.654084+00', '2026-03-11 01:29:04.654129+00', '2026-03-11 16:02:49.857663+00', 'fae78d6e-8432-4180-8aa5-b993b103644e');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") VALUES
	('dcce6934-d6a8-49d2-998a-1eea0602cf76', 'aec4f3a8-eb15-416e-b407-0b4884e186a5', '2026-03-11 01:32:21.717435+00', '2026-03-11 01:32:21.717435+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '67.175.86.251', NULL, NULL, NULL, NULL, NULL),
	('7cadae50-302b-4bfd-8047-bff6e43f23ea', '365433f9-feba-4aed-bab6-5e2037b8be16', '2026-03-11 06:07:15.932837+00', '2026-03-11 11:18:30.008023+00', NULL, 'aal1', NULL, '2026-03-11 11:18:30.007887', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '86.98.140.41', NULL, NULL, NULL, NULL, NULL),
	('ae384c91-535e-4e15-bef8-3fd44635b976', 'b6ea0551-f997-4f67-9065-ec24d0d0ce84', '2026-03-11 16:02:49.864439+00', '2026-03-11 16:02:49.864439+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36', '172.58.166.42', NULL, NULL, NULL, NULL, NULL),
	('093fc9fd-477e-48eb-982e-0cb0ebd8d5bf', '1685dfdd-00b9-41dc-b652-e311019c764a', '2026-03-11 16:08:56.945956+00', '2026-03-11 17:17:26.601579+00', NULL, 'aal1', NULL, '2026-03-11 17:17:26.601438', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36', '122.172.41.60', NULL, NULL, NULL, NULL, NULL),
	('5badbf12-d124-4a28-a483-1b639bbe33cb', 'a6d318ca-20a7-4b37-9976-1fb0ea12fdb4', '2026-03-11 22:01:46.489979+00', '2026-03-11 22:01:46.489979+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1', '104.28.32.92', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('093fc9fd-477e-48eb-982e-0cb0ebd8d5bf', '2026-03-11 16:08:56.950222+00', '2026-03-11 16:08:56.950222+00', 'oauth', 'bbdcd6ba-a9eb-45ec-9d5a-357f71450869'),
	('5badbf12-d124-4a28-a483-1b639bbe33cb', '2026-03-11 22:01:46.531156+00', '2026-03-11 22:01:46.531156+00', 'oauth', '0a1fa56a-1c29-40d1-b683-aa69c0827269'),
	('dcce6934-d6a8-49d2-998a-1eea0602cf76', '2026-03-11 01:32:21.72195+00', '2026-03-11 01:32:21.72195+00', 'oauth', '6edd1b8c-7daa-4ff4-9ced-2594f3a19b2f'),
	('7cadae50-302b-4bfd-8047-bff6e43f23ea', '2026-03-11 06:07:15.970156+00', '2026-03-11 06:07:15.970156+00', 'oauth', '1e1b5219-6125-4999-b491-88c0bf583d90'),
	('ae384c91-535e-4e15-bef8-3fd44635b976', '2026-03-11 16:02:49.87969+00', '2026-03-11 16:02:49.87969+00', 'oauth', '77ade512-03c2-4191-be37-f8e0fa81a36f');


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 87, 'e6fzknthxics', '1685dfdd-00b9-41dc-b652-e311019c764a', true, '2026-03-11 16:08:56.947176+00', '2026-03-11 17:17:26.556861+00', NULL, '093fc9fd-477e-48eb-982e-0cb0ebd8d5bf'),
	('00000000-0000-0000-0000-000000000000', 88, 'a7fljgnbealz', '1685dfdd-00b9-41dc-b652-e311019c764a', false, '2026-03-11 17:17:26.573974+00', '2026-03-11 17:17:26.573974+00', 'e6fzknthxics', '093fc9fd-477e-48eb-982e-0cb0ebd8d5bf'),
	('00000000-0000-0000-0000-000000000000', 89, 'b74dmgimi2cz', 'a6d318ca-20a7-4b37-9976-1fb0ea12fdb4', false, '2026-03-11 22:01:46.513279+00', '2026-03-11 22:01:46.513279+00', NULL, '5badbf12-d124-4a28-a483-1b639bbe33cb'),
	('00000000-0000-0000-0000-000000000000', 79, 'rgxyinsogbzu', 'aec4f3a8-eb15-416e-b407-0b4884e186a5', false, '2026-03-11 01:32:21.720347+00', '2026-03-11 01:32:21.720347+00', NULL, 'dcce6934-d6a8-49d2-998a-1eea0602cf76'),
	('00000000-0000-0000-0000-000000000000', 81, '4wv5x5tajead', '365433f9-feba-4aed-bab6-5e2037b8be16', true, '2026-03-11 06:07:15.957075+00', '2026-03-11 07:17:02.02721+00', NULL, '7cadae50-302b-4bfd-8047-bff6e43f23ea'),
	('00000000-0000-0000-0000-000000000000', 82, 'qhd5vwegqwuh', '365433f9-feba-4aed-bab6-5e2037b8be16', true, '2026-03-11 07:17:02.050121+00', '2026-03-11 10:16:08.684972+00', '4wv5x5tajead', '7cadae50-302b-4bfd-8047-bff6e43f23ea'),
	('00000000-0000-0000-0000-000000000000', 83, '4rbrcgdnganl', '365433f9-feba-4aed-bab6-5e2037b8be16', true, '2026-03-11 10:16:08.711469+00', '2026-03-11 11:18:29.959593+00', 'qhd5vwegqwuh', '7cadae50-302b-4bfd-8047-bff6e43f23ea'),
	('00000000-0000-0000-0000-000000000000', 84, '6di4cqs4yic6', '365433f9-feba-4aed-bab6-5e2037b8be16', false, '2026-03-11 11:18:29.978288+00', '2026-03-11 11:18:29.978288+00', '4rbrcgdnganl', '7cadae50-302b-4bfd-8047-bff6e43f23ea'),
	('00000000-0000-0000-0000-000000000000', 86, '3fyl5ry2gm6s', 'b6ea0551-f997-4f67-9065-ec24d0d0ce84', false, '2026-03-11 16:02:49.876996+00', '2026-03-11 16:02:49.876996+00', NULL, 'ae384c91-535e-4e15-bef8-3fd44635b976');


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: auction_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."auction_config" ("id", "status", "current_pool", "pools_frozen", "created_at", "updated_at", "budget_per_team", "min_players", "max_players") VALUES
	('bea25912-4ac3-4cd3-93ff-b563d89cb08d', 'setup', 'Marquee', false, '2026-03-11 01:28:37.767762+00', '2026-03-11 01:28:37.767762+00', 120, 18, 25);


--
-- Data for Name: auction_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."auction_settings" ("id", "content", "updated_at", "updated_by", "active_lot") VALUES
	('current_rules', '<p><strong>Rule book is as follows:</strong></p><ul><li><p>Rule 1</p></li><li><p>Rule 2</p></li></ul><p></p><p></p>', '2026-03-11 01:36:38.498+00', NULL, 'Set 1');


--
-- Data for Name: players; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."players" ("id", "player_name", "team", "country", "price", "type", "capped_uncapped", "acquisition", "role", "status", "sold_to", "sold_price", "image_url", "created_at", "pool", "auction_status", "sold_to_id") VALUES
	('01e9e30b-137f-4745-8027-883f327a10ae', 'Ben Duckett', 'DC', 'England', '2 Cr', 'Overseas', 'Capped', 'Auction', 'Top-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/383100/383154.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('1adba9cb-1466-4de6-9060-ce93ea52ad40', 'MS Dhoni', 'CSK', 'India', '4 Cr', 'Indian', 'Capped', 'Retained', 'Batter/WK', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/319900/319946.3.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('f78c2eb3-f3a4-4244-b26f-3521b74769e8', 'Khaleel Ahmed', 'CSK', 'India', '4.80 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322200/322268.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('1d872b60-d46d-4a21-abb5-23070b0da3a6', 'Nathan Ellis', 'CSK', 'Australia', '3.50 Cr', 'Overseas', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/329700/329711.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('f0cfc6b0-d10e-4462-9c2e-fbbe17656df7', 'Matt Henry', 'CSK', 'New Zealand', '2 Cr', 'Overseas', 'Capped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/383100/383178.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('0ea8313d-1ed4-4dfc-8cee-deab2e4e2243', 'Noor Ahmad', 'CSK', 'Afghanistan', '3 Cr', 'Overseas', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/383200/383239.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('b362cb4e-cc9e-4499-82b7-ed1efb73f551', 'Matthew Short', 'CSK', 'Australia', '1.50 Cr', 'Overseas', 'Capped', 'Auction', 'Batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/384200/384252.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('d7d6b2b6-11d5-41d0-876c-b13ad39ad7ad', 'Mukesh Choudhary', 'CSK', 'India', '2 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/398600/398614.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('f35f65e4-5873-49c9-a9a2-67aac578c45d', 'Prashant Veer', 'CSK', 'India', '14.20 Cr', 'Indian', 'Uncapped', 'Auction', 'All-rounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/410600/410613.4.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('4efc15bf-abef-4539-9f49-e29d985be2e4', 'Kartik Sharma', 'CSK', 'India', '14.20 Cr', 'Indian', 'Uncapped', 'Auction', 'Batter/WK', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/390800/390871.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('2388ac54-e36a-465d-a115-6bdb0fbb9fa0', 'Kyle Jamieson', 'DC', 'New Zealand', '2 Cr', 'Overseas', 'Capped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/321200/321236.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('14309caa-3222-42ff-92a3-10e5e35db3c9', 'Kuldeep Yadav', 'DC', 'India', '13.25 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/319900/319943.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('cbe3b313-ca56-4070-a714-c735f69b3aac', 'Mukesh Kumar', 'DC', 'India', '8 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/373900/373907.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('192b6cf8-d314-48c4-a93c-e4707ed95056', 'Karun Nair', 'DC', 'India', '50 Lakh', 'Indian', 'Capped', 'Retained', 'Top-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/399200/399231.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('adef2ca9-252c-42af-b7c8-3177c08f4da7', 'Lungi Ngidi', 'DC', 'South Africa', '2 Cr', 'Overseas', 'Capped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322000/322069.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('fa143407-5cd4-4647-a2fa-aa2d535159ef', 'Ruturaj Gaikwad', 'CSK', 'India', '18 Cr', 'Indian', 'Capped', 'Retained', 'Batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322200/322236.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('2253d561-fb44-45af-895b-c364538aed51', 'Sam Curran', 'RR', 'England', '2.40 Cr', 'Overseas', 'Capped', 'Traded', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/383100/383153.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('293e9fe9-095e-43b4-b888-43af64d9a459', 'Robin Minz', 'MI', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Wicketkeeper', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('959162b2-0962-4783-9d82-a9bfefdf3901', 'Josh Inglis', 'LSG', 'Australia', '8.60 Cr', 'Overseas', 'Capped', 'Auction', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/324200/324232.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('b7698176-2a71-4154-a322-5bb8f224440d', 'Mohammed Shami', 'LSG', 'India', '10 Cr', 'Indian', 'Capped', 'Traded', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/390300/390351.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('ad718952-f77e-4ec8-8fb2-a79b95b935ca', 'Mohsin Khan', 'LSG', 'India', '4 Cr', 'Indian', 'Uncapped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/397200/397280.4.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('674a1893-58f1-4765-a563-325c0d4be4da', 'Nicholas Pooran', 'LSG', 'West Indies', '21 Cr', 'Overseas', 'Capped', 'Retained', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/320100/320109.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('a449e18f-236b-47cd-a124-7c2cdddbfaa2', 'Prince Yadav', 'LSG', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/398600/398611.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('a51b7f63-05bd-441a-89d9-135f4d8f1d71', 'Manimaran Siddharth', 'LSG', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/330900/330975.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('486ada33-48e4-4fc4-9856-e99f31277f42', 'Naman Tiwari', 'LSG', 'India', '1 Cr', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/410600/410627.3.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('85b33daa-fd48-468c-b249-188f3a48f504', 'Praveen Dubey', 'PBKS', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/398600/398622.4.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('fcd0ce75-b2f5-4885-82d3-b45bc11fce56', 'Ryan Rickelton', 'MI', 'South Africa', '1 Cr', 'Overseas', 'Capped', 'Auction', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/366300/366321.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('1120118f-d53c-43e2-b641-d9e68900d035', 'Sherfane Rutherford', 'MI', 'West Indies', '75 Lakh', 'Overseas', 'Capped', 'Traded', 'Middle-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322100/322173.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('a2c1c75a-c7c1-4aec-a6e8-ece7c6c7c976', 'Raghu Sharma', 'MI', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/400200/400220.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('de76e121-a475-4945-bd8e-5416cd51850a', 'Tilak Varma', 'MI', 'India', '14 Cr', 'Indian', 'Capped', 'Retained', 'Batting allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/381300/381391.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('15947655-38cb-4da5-8055-97c501a15049', 'Suryakumar Yadav', 'MI', 'India', '18 Cr', 'Indian', 'Capped', 'Retained', 'Batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/331100/331163.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('bcbb657d-8e5f-4fe0-a5d0-7915bdf38b24', 'Shivam Dube', 'CSK', 'India', '12 Cr', 'Indian', 'Capped', 'Retained', 'All-rounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/383700/383773.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('e5e83897-77c1-4d0c-8174-f7fc5fe4fe8f', 'Rahul Chahar', 'CSK', 'India', '5.20 Cr', 'Indian', 'Capped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/331100/331166.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('d75485ac-c17e-43d6-893a-90bb2f6fb0a4', 'Zak Foulkes', 'CSK', 'New Zealand', '75 Lakh', 'Overseas', 'Capped', 'Auction', 'All-rounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/393500/393574.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('5a60ad6a-e450-4265-b166-0bbacc609837', 'Sarfaraz Khan', 'CSK', 'India', '75 Lakh', 'Indian', 'Capped', 'Auction', 'Batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/393600/393683.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('ec112335-6752-44e8-8767-99848cf66ebc', 'Shreyas Gopal', 'CSK', 'India', '2 Cr', 'Indian', 'Capped', 'Retained', 'All-rounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322200/322275.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('04458cdc-f8ae-41fc-9647-0ed931060ead', 'Urvil Patel', 'CSK', 'India', '4 Cr', 'Indian', 'Uncapped', 'Retained', 'Batter/WK', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/391800/391896.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('ac4de8a8-a18e-4221-bb3f-e6b9ef784a20', 'Ramakrishna Ghosh', 'CSK', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Retained', 'All-rounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/398600/398613.4.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('b4b26836-85f1-4805-9cd9-26a2cedfe939', 'T Natarajan', 'DC', 'India', '10.75 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322600/322699.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('33d7b8a9-d524-429a-9aae-6eb72c1ce391', 'Vipraj Nigam', 'DC', 'India', '50 Lakh', 'Indian', 'Uncapped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/397400/397429.4.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('52229add-a82c-4b69-9850-551f4c4cbb61', 'Mayank Yadav', 'LSG', 'India', '11 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/373900/373904.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('74efaca3-297d-419e-8a54-eed14e1ea8db', 'Tim Seifert', 'KKR', 'New Zealand', '1.50 Cr', 'Overseas', 'Capped', 'Auction', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/321300/321313.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('27cd456d-c979-4559-b8f0-6ed052172653', 'Rahul Tripathi', 'KKR', 'India', '75 Lakh', 'Indian', 'Capped', 'Auction', 'Top-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/356800/356821.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('bc00c3b4-9e94-44c3-898e-0d8c32713dac', 'Umran Malik', 'KKR', 'India', '75 Lakh', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/343200/343263.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('137d3765-234d-4b32-a297-0aadac8abd9d', 'Varun Chakravarthy', 'KKR', 'India', '12 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/331100/331167.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('4b59ecc1-6f0b-483a-be64-d3c60f9ee315', 'Brijesh Sharma', 'RR', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('29eaad7f-0a87-44f6-a1ca-0d191f468aa1', 'Rinku Singh', 'KKR', 'India', '13 Cr', 'Indian', 'Capped', 'Retained', 'Middle-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/341000/341043.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('4319a9e0-c8e8-4ca6-bf10-9202fe52a192', 'Yash Dayal', 'RCB', 'India', '5 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/387500/387586.4.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('add232b1-cc7e-466a-8dd6-9b2672327e49', 'Tim David', 'RCB', 'Australia', '3 Cr', 'Overseas', 'Capped', 'Retained', 'Middle-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/340300/340305.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('9ed392cd-3d3f-4a1a-a9f0-5ca027f58708', 'Swapnil Singh', 'RCB', 'India', '50 Lakh', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/384200/384254.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('fadbd36c-1632-475a-836c-1c9bbdeaf14a', 'Jack Edwards', 'SRH', 'Australia', '3 Cr', 'Overseas', 'Capped', 'Auction', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/392000/392014.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('01470f2a-fb67-459a-939b-8818bf166e42', 'Shardul Thakur', 'MI', 'India', '4.50 Cr', 'Indian', 'Capped', 'Traded', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322600/322696.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('91748f80-7869-416e-a8e2-6b98d45537a1', 'Sahil Parakh', 'DC', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Top-order batter', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('45336274-bf1b-4014-9012-e020e33b81d2', 'Sameer Rizvi', 'DC', 'India', '95 Lakh', 'Indian', 'Uncapped', 'Retained', 'Batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/397400/397425.4.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('0fd9c406-2129-49a9-9a15-3c6649e5bac7', 'Harshit Rana', 'KKR', 'India', '4 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/358000/358042.3.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('252fa4da-75c2-49be-9518-f2d3d45206b4', 'Gurnoor Brar', 'GT', 'India', '1.30 Cr', 'Indian', 'Uncapped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/359700/359764.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('ca06dfb8-bf59-49bb-b6dd-f70c72a4dd7c', 'Prithvi Raj', 'GT', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('cd1e80ba-4d05-4b0d-a35d-91592a4ccdbc', 'Mustafizur Rahman', 'KKR', 'Bangladesh', '9.20 Cr', 'Overseas', 'Capped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/319700/319734.3.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('bc200568-a67f-448e-83c5-8bc0f9fe5b11', 'Shreyas Iyer', 'PBKS', 'India', '26.75 Cr', 'Indian', 'Capped', 'Retained', 'Top-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/323000/323035.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('0b643dfc-1fb7-4cdc-a8a9-8cb92fa69e55', 'Xavier Bartlett', 'PBKS', 'Australia', '3 Cr', 'Overseas', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/390700/390741.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('97f6824d-9e8f-4550-8beb-bbe599e5fe5c', 'Yuzvendra Chahal', 'PBKS', 'India', '18 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/319900/319955.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('57378aec-6b9a-43ca-b29e-5669476c3560', 'Vishal Nishad', 'PBKS', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('1ab93c6f-be7f-46e1-a0bf-c225401ba75e', 'Shashank Singh', 'PBKS', 'India', '5.5 Cr', 'Indian', 'Capped', 'Retained', 'Batting allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/380600/380696.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('f6d6b5c7-83d3-4cb5-84ae-5fc204bc3d80', 'Suryansh Shedge', 'PBKS', 'India', '1 Cr', 'Indian', 'Uncapped', 'Retained', 'Batting allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/393100/393181.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('4af1f395-af6c-4f4a-8dca-bc089308c9c3', 'Vijaykumar Vyshak', 'PBKS', 'India', '2 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/390600/390654.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('51b2a672-24f7-4574-bc95-a0957d2309a3', 'Heinrich Klaasen', 'SRH', 'South Africa', '23 Cr', 'Overseas', 'Capped', 'Retained', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322000/322073.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('86250f01-37ec-480e-ad1c-1ca3d72c7d53', 'Nandre Burger', 'RR', 'South Africa', '3.50 Cr', 'Overseas', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/388400/388421.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('9f17d551-b2f5-408c-9b36-d91682810ad3', 'Kwena Maphaka', 'RR', 'South Africa', '1.50 Cr', 'Overseas', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/339500/339569.6.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('e3a6d295-2f5d-4047-b273-5d4ce5c74444', 'Kuldeep Sen', 'RR', 'India', '75 Lakh', 'Indian', 'Capped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/398600/398620.4.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('a8833005-828f-44fe-97ba-0684bd6c144f', 'Bhuvneshwar Kumar', 'RCB', 'India', '10.75 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/392400/392400.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('46041951-da59-41a5-b776-18fd9c916a8a', 'Romario Shepherd', 'RCB', 'West Indies', '50 Lakh', 'Overseas', 'Capped', 'Retained', 'Bowling allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/403700/403798.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('141f0ae9-0e40-4754-8cea-3e6e81a13351', 'Auqib Nabi Dar', 'DC', 'India', '8.4 Cr', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/413700/413761.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('298de8d7-a5ef-4084-a06c-02879e6d6993', 'Anshul Kamboj', 'CSK', 'India', '2 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/381300/381389.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('48f5a32e-e5b3-4f68-bcb7-3ffc7228dfc3', 'Quinton de Kock', 'MI', 'South Africa', '12.25 Cr', 'Overseas', 'Capped', 'Auction', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/316600/316668.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('c3a40b4a-69ee-4a2c-bd6a-0677814dd087', 'Yashasvi Jaiswal', 'RR', 'India', '18 Cr', 'Indian', 'Capped', 'Retained', 'Opening batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/340300/340309.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('e09cce3f-d8c4-4ff8-9249-3f75289eedae', 'Rishabh Pant', 'LSG', 'India', '18 Cr', 'Indian', 'Capped', 'Retained', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/323000/323036.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('28fac546-1aa2-401d-9bde-bc0c1a8b6869', 'Wanindu Hasaranga', 'LSG', 'Sri Lanka', '2 Cr', 'Overseas', 'Capped', 'Auction', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322900/322946.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('217187e7-d414-4be9-aac3-3b88082a5e53', 'Shahbaz Ahmed', 'LSG', 'India', '4 Cr', 'Indian', 'Capped', 'Retained', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/340300/340313.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('11e3162d-423b-49a1-b4c4-fc862dd56742', 'Lhuan-dre Pretorius', 'RR', 'South Africa', '30 Lakh', 'Overseas', 'Uncapped', 'Retained', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/394500/394554.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('3827df33-e760-4544-b6cb-3367774cec35', 'Arshad Khan', 'GT', 'India', '1.30 Cr', 'Indian', 'Uncapped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/398600/398617.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('3a8e3c87-e1cf-4d0e-9fd8-503758cd691d', 'Ashok Sharma', 'GT', 'India', '90 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/341000/341036.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('3d64eeac-b78b-44ca-b76e-a8e8ae730bd9', 'Cameron Green', 'KKR', 'Australia', '25.20 Cr', 'Overseas', 'Capped', 'Auction', 'Batting allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/321500/321569.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('7aac5f68-0ea6-482a-9917-54fda169b2cf', 'Madhav Tiwari', 'DC', 'India', '40 Lakh', 'Indian', 'Uncapped', 'Retained', 'All-rounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/397400/397423.7.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('570d1d53-fb96-41ba-b4d3-80358ff66104', 'Mohammed Siraj', 'GT', 'India', '12.25 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322600/322611.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('124ef468-fccf-4b90-9cbb-f58ef39b1659', 'Prasidh Krishna', 'GT', 'India', '9.50 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322600/322617.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('a9d87f3a-f703-45e8-9d63-a51358dce1aa', 'Nishant Sindhu', 'GT', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Retained', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/345000/345097.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('cc58ed36-296c-43ed-9814-97c10858e9dc', 'Kumar Kushagra', 'GT', 'India', '65 Lakh', 'Indian', 'Uncapped', 'Retained', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/398600/398618.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('99e5360b-59ee-4d6f-adac-ab2167a49963', 'Manav Suthar', 'GT', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Retained', 'Bowling allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/398600/398616.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('ed26992b-2cfe-429f-adec-5182e4c787ad', 'Luke Wood', 'GT', 'England', '75 Lakh', 'Overseas', 'Capped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/324300/324367.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('fa642b9a-fbe2-4ce4-9fb3-716c17194424', 'Kartik Tyagi', 'KKR', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/339100/339150.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('2de86272-c2c2-49d0-b679-bdf40a136a40', 'Manish Pandey', 'KKR', 'India', '75 Lakh', 'Indian', 'Capped', 'Retained', 'Top-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/323000/323052.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('ff925692-d521-498f-a358-141070dce332', 'Matheesha Pathirana', 'KKR', 'Sri Lanka', '18 Cr', 'Overseas', 'Capped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/355400/355402.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('f9f14dfc-33ea-448c-9aac-b3d615ecba89', 'Tristan Stubbs', 'DC', 'South Africa', '10 Cr', 'Overseas', 'Capped', 'Retained', 'Batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/348500/348577.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('f507fe6c-76db-495e-864f-adc5d2553af5', 'Tripurana Vijay', 'DC', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/397400/397428.4.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('94cb18b0-7fd8-424a-b9b4-c6c65a3e6750', 'Brydon Carse', 'SRH', 'England', '1 Cr', 'Overseas', 'Capped', 'Retained', 'Bowling allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/325900/325908.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('0e6420e2-0947-4549-8062-337c08167571', 'Mayank Rawat', 'MI', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Allrounder', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('8938745a-68ad-43d8-9063-8b1a21b428ef', 'Raj Bawa', 'MI', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/339100/339156.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('2b4dddec-5943-467e-af0d-fbd683a07453', 'Harnoor Singh', 'PBKS', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Retained', 'Batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/338200/338253.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('2c5c6aa1-b0b6-481b-b200-30a08401ee97', 'Harpreet Brar', 'PBKS', 'India', '3.50 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/381300/381368.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('361b2067-27c9-4a5d-9273-ec959deabcbf', 'Atharva Ankolekar', 'MI', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Allrounder', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('3bc20593-6bda-494b-94ca-313e400bd104', 'Arshin Kulkarni', 'LSG', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Retained', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/409100/409181.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('48922137-2a7b-497c-80a3-979c5d82b229', 'Abishek Porel', 'DC', 'India', '4 Cr', 'Indian', 'Capped', 'Retained', 'Wicketkeeper Batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/393400/393462.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('5afb721e-3dec-476d-9b19-ce1de518094c', 'Phil Salt', 'RCB', 'England', '11.5 Cr', 'Overseas', 'Capped', 'Retained', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/383100/383141.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('c0fe9d72-d3a6-4f61-ba75-54efb20d9ad2', 'Josh Hazlewood', 'RCB', 'Australia', '12.5 Cr', 'Overseas', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/390900/390976.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('8bd82c67-7672-421a-a24e-eeba591eb885', 'Krunal Pandya', 'RCB', 'India', '5.75 Cr', 'Indian', 'Capped', 'Retained', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322600/322614.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('ba38dae3-77d1-47b7-806d-484b205d145a', 'Mangesh Yadav', 'RCB', 'India', '5.2 Cr', 'Indian', 'Uncapped', 'Auction', 'Allrounder', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('7cf9505b-72fa-4a26-b1ef-30e973bbd6ff', 'Jordan Cox', 'RCB', 'England', '75 Lakh', 'Overseas', 'Capped', 'Auction', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/325900/325912.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('f12256e0-3209-4425-a5c0-6d764589df6e', 'Pat Cummins', 'SRH', 'Australia', '18 Cr', 'Overseas', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/390900/390954.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('de7d030e-f417-4a6d-b105-d194bcf86b63', 'Sandeep Sharma', 'RR', 'India', '4 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/323000/323055.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('fc6ed6cd-85e8-4d8f-b7da-c15bcf40b7b0', 'Ravi Singh', 'RR', 'India', '95 Lakh', 'Indian', 'Uncapped', 'Auction', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/411200/411284.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('bcf5eedb-a684-4008-91e4-61375dbceb65', 'Sushant Mishra', 'RR', 'India', '90 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('0890b6f9-550b-46aa-9224-1d41467d57f6', 'Shubman Gill', 'GT', 'India', '16.50 Cr', 'Indian', 'Capped', 'Retained', 'Top-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322600/322697.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('fa3e464b-8fe9-48b3-b8ce-99a327c16695', 'Rashid Khan', 'GT', 'Afghanistan', '18 Cr', 'Overseas', 'Capped', 'Retained', 'Bowling allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/383200/383228.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('5d77fde8-4039-4ac9-b758-5556d9f4705d', 'Rahul Tewatia', 'GT', 'India', '4 Cr', 'Indian', 'Capped', 'Retained', 'Bowling allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322200/322269.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('2fdfd5e8-11ec-4995-b313-3f25e668ee00', 'Shahrukh Khan', 'GT', 'India', '4 Cr', 'Indian', 'Capped', 'Retained', 'Batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/359700/359756.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('c1102c79-3c3f-45e8-a15b-81c59c2cbbb8', 'Sai Kishore', 'GT', 'India', '2 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/362500/362558.6.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('c4198216-4070-4223-9623-6dd54bcd9200', 'Tom Banton', 'GT', 'England', '2 Cr', 'Overseas', 'Capped', 'Auction', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/323000/323099.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('076355d8-cd09-40b6-8afc-0cfc601e2a26', 'Vaibhav Arora', 'KKR', 'India', '1.8 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/389500/389547.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('6b5ad112-3e61-40a9-a8d5-421d1c04b878', 'Tejasvi Dahiya', 'KKR', 'India', '3 Cr', 'Indian', 'Uncapped', 'Auction', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/414300/414336.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('4bbc52aa-8967-479d-8013-3fa9d0eb3f05', 'Ashutosh Sharma', 'DC', 'India', '3.8 Cr', 'Indian', 'Uncapped', 'Retained', 'Batting all-rounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/380600/380694.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('8fd1b2ac-6e48-4f80-b838-e4c1aa3073ef', 'Kamindu Mendis', 'SRH', 'Sri Lanka', '75 Lakh', 'Overseas', 'Capped', 'Retained', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/329900/329938.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('029dd047-2e45-413e-88a9-f088bd675a43', 'R Smaran', 'SRH', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Retained', 'Batter', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('763a1b34-c89b-4942-8e33-c3c4af04cb7a', 'Liam Livingstone', 'SRH', 'England', '13 Cr', 'Overseas', 'Capped', 'Auction', 'Batting allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/383100/383152.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('1f23665b-5305-4160-b658-06fd20a2d2f0', 'Praful Hinge', 'SRH', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('2c9aee99-a458-4b88-b7b4-7c31a194cf18', 'Krains Fuletra', 'SRH', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('a2eb371a-30b2-4a83-8caf-a119a3353d2d', 'Onkar Tarmale', 'SRH', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('10d5413a-c11a-4989-b771-d7ce8fdab3b9', 'Salil Arora', 'SRH', 'India', '1.5 Cr', 'Indian', 'Uncapped', 'Auction', 'Wicketkeeper batter', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('c3283820-cc9b-4c73-9278-614c9eae6989', 'Shivam Mavi', 'SRH', 'India', '75 Lakh', 'Indian', 'Capped', 'Auction', 'Bowling allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/341000/341042.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('a4310fd7-1bc0-423e-bfca-0f724028a367', 'Sakib Hussain', 'SRH', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/387600/387604.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('b0d341b1-6ab9-4d28-8cb6-e02a1707978f', 'Sunil Narine', 'KKR', 'West Indies', '12 Cr', 'Overseas', 'Capped', 'Retained', 'Bowling allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/320100/320119.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('287fefa6-1caf-4e65-98ee-8c6562b1eb41', 'Rovman Powell', 'KKR', 'West Indies', '1.5 Cr', 'Overseas', 'Capped', 'Retained', 'Middle-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322100/322172.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('b3669073-22c1-4cdf-8124-6c4b7dca0005', 'Ramandeep Singh', 'KKR', 'India', '4 Cr', 'Indian', 'Uncapped', 'Retained', 'Middle-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/380600/380670.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('08cbdbed-736a-4882-bd4d-1f7ba07dbbc1', 'Ashwani Kumar', 'MI', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/393400/393450.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('203385b6-384c-4803-969a-e0beb7a2385e', 'Ayush Badoni', 'LSG', 'India', '4 Cr', 'Indian', 'Uncapped', 'Retained', 'Batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/411800/411842.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('9d787139-7d7f-4fd5-914b-80a5249a85f5', 'Rachin Ravindra', 'KKR', 'New Zealand', '2 Cr', 'Overseas', 'Capped', 'Auction', 'Batting allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/383100/383182.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('d202b999-f700-44b3-920d-25a67da9b21f', 'Shivang Kumar', 'SRH', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('4ef49e8e-e101-4d85-8620-4b6f73f1e4bd', 'Akash Deep', 'KKR', 'India', '1 Cr', 'Indian', 'Capped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/403300/403361.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('5e9b3f24-ad58-414c-a878-819e55eb6b37', 'Ajinkya Rahane', 'KKR', 'India', '1.5 Cr', 'Indian', 'Capped', 'Retained', 'Top-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/316600/316620.3.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('602f49b9-3675-49b4-b716-c3c0aa0d8c71', 'Himmat Singh', 'LSG', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Retained', 'Batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/199700/199729.jpg', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('6c47823e-7ac0-4c63-ba6a-eb1878d30328', 'Jayant Yadav', 'GT', 'India', '75 Lakh', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322500/322553.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('4d597379-2101-4c2c-b08d-ead7eb651dda', 'Akash Singh', 'LSG', 'India', '50 Lakh', 'Indian', 'Uncapped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/299000/299091.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('df55870c-cd7c-4239-a89d-e4588643eb7c', 'Sai Sudharsan', 'GT', 'India', '8.5 Cr', 'Indian', 'Capped', 'Retained', 'Top-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/390600/390648.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('93410517-8543-4a43-b7c9-43129d33df57', 'Kagiso Rabada', 'GT', 'South Africa', '10.75 Cr', 'Overseas', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/320300/320376.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('7993ba91-7b94-4b2d-b657-e92f4f31810a', 'Virat Kohli', 'RCB', 'India', '21 Cr', 'Indian', 'Capped', 'Retained', 'Top-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/316600/316605.3.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('9c0bc36b-0a3a-47a2-849e-ab63a8ca3a6d', 'Jasprit Bumrah', 'MI', 'India', '18 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/319900/319940.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('70090090-e2c8-44d3-8fac-a273713eab00', 'Jos Buttler', 'GT', 'England', '15.75 Cr', 'Overseas', 'Capped', 'Retained', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/383100/383143.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('f613b957-fd2c-4bd8-933e-0a0d0c4df0dc', 'Vaibhav Sooryavanshi', 'RR', 'India', '1.10 Cr', 'Indian', 'Uncapped', 'Retained', 'Top-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/412600/412631.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('979815a3-8997-4e07-a25e-183e613dc011', 'Sanju Samson', 'CSK', 'India', '18 Cr', 'Indian', 'Capped', 'Auction', 'Batter/WK', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322700/322701.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('3ee6086b-6586-4429-a107-2de6473c8a03', 'Rohit Sharma', 'MI', 'India', '18 Cr', 'Indian', 'Capped', 'Retained', 'Top-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/385800/385819.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('3adee114-f4b3-41cf-ac21-833929a47747', 'Nitish Rana', 'DC', 'India', '4.2 Cr', 'Indian', 'Capped', 'Traded', 'Middle-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/323000/323054.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('dbdae802-3260-49d0-8f9e-b725864b1b87', 'Ishan Kishan', 'SRH', 'India', '11.25 Cr', 'Indian', 'Capped', 'Retained', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/331100/331165.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('7f63d8ad-a7d2-49fd-8dbc-c060e4f53c6f', 'Washington Sundar', 'GT', 'India', '3.20 Cr', 'Indian', 'Capped', 'Retained', 'Bowling allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322600/322619.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('5b3d39b4-f1ba-49a3-80a0-736213e0ebef', 'Mitchell Starc', 'DC', 'Australia', '11.75 Cr', 'Overseas', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/390900/390978.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('4fc92adb-0ade-424f-8e91-a0936377c9b6', 'Corbin Bosch', 'MI', 'South Africa', '30 Lakh', 'Overseas', 'Uncapped', 'Auction', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/393600/393647.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('267d8b9d-5f73-4a75-932f-d8c9c5c02e50', 'Aniket Verma', 'SRH', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Retained', 'Batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/399200/399246.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('4ce3eaa3-df14-4eda-bc34-51fcda3daf81', 'David Miller', 'DC', 'South Africa', '2 Cr', 'Overseas', 'Capped', 'Auction', 'Middle-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/316600/316655.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('60c6c7fb-6ec5-4a0a-85c7-4f045ba1bd20', 'Jaydev Unadkat', 'SRH', 'India', '1 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/399700/399715.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('6daf253a-4e1b-4708-bbc3-6017d4b36fdf', 'Ajay Mandal', 'DC', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Retained', 'All-rounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/397400/397422.4.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('735e9e27-7ad1-4421-b8ae-2d5e048df644', 'Dewald Brevis', 'CSK', 'South Africa', '3 Cr', 'Overseas', 'Capped', 'Retained', 'Batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/335100/335134.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('781cf92c-a281-4e3c-b668-193de441e8c7', 'Aman Khan', 'CSK', 'India', '40 Lakh', 'Indian', 'Uncapped', 'Auction', 'All-rounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/414300/414333.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('7b72060a-a3c8-455a-9fc3-bd756a76c6fd', 'Jitesh Sharma', 'RCB', 'India', '11 Cr', 'Indian', 'Capped', 'Retained', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/380600/380690.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('7e9b08ed-9bb6-4d62-bec3-82e2c94d57fa', 'Jacob Bethell', 'RCB', 'England', '50 Lakh', 'Overseas', 'Capped', 'Retained', 'Batting allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/388700/388704.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('7f1ff074-39e0-45c2-833f-6de4606904c3', 'Amit Kumar', 'SRH', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('859a7bb4-a210-4c19-8221-a8e15c938c73', 'AM Ghazanfar', 'MI', 'Afghanistan', '30 Lakh', 'Overseas', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/390500/390546.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('8a8a427f-9c97-456f-8d2f-d229b7a7f5fe', 'Abhinandan Singh', 'RCB', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/399200/399250.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('8d1870f6-cf3f-4ab7-acb5-333a21fb7bcb', 'Eshan Malinga', 'SRH', 'Sri Lanka', '1.2 Cr', 'Overseas', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/399200/399252.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('8de432ca-d0da-4227-98bb-833abcd905d5', 'Aiden Markram', 'LSG', 'South Africa', '12 Cr', 'Overseas', 'Capped', 'Retained', 'Middle-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322000/322067.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('90b45e3c-4814-4634-aeb2-58de1aee3508', 'Harsh Dubey', 'SRH', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Retained', 'Bowling allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/401100/401146.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('94ef1cb8-57d6-4c29-a251-72ed53e38183', 'Glenn Phillips', 'GT', 'New Zealand', '2 Cr', 'Overseas', 'Capped', 'Retained', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/383100/383167.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('9ba39b09-22b3-493f-8db8-a631a1470147', 'Akeal Hosein', 'CSK', 'West Indies', '2 Cr', 'Overseas', 'Capped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/321900/321939.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('9c9bc167-3db0-40e6-935b-99e12d06ace7', 'Azmatullah Omarzai', 'PBKS', 'Afghanistan', '2 Cr', 'Overseas', 'Capped', 'Retained', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/383200/383229.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('9de4af56-7a4d-492a-92d1-a2ed30eb17e0', 'Adam Milne', 'RR', 'New Zealand', '2.40 Cr', 'Overseas', 'Capped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/316600/316689.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('b5df4c14-8c87-41f2-8344-83ca57cba4c9', 'Jofra Archer', 'RR', 'England', '12.50 Cr', 'Overseas', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/383100/383146.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('b9cc75eb-5805-4dc3-a1be-e7c9e9699f52', 'Jacob Duffy', 'RCB', 'New Zealand', '2 Cr', 'Overseas', 'Capped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/387100/387134.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('bb8b0e55-5ba4-4033-9445-766212008655', 'Arjun Tendulkar', 'LSG', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Traded', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/359700/359770.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('c0362c7c-5673-4094-ac8f-4f1c92ab7ca1', 'Axar Patel', 'DC', 'India', '16.5 Cr', 'Indian', 'Capped', 'Retained', 'All-rounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/331100/331164.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('c60b6586-c4b5-43b1-a022-87bf454a6130', 'Anrich Nortje', 'LSG', 'South Africa', '2 Cr', 'Overseas', 'Capped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322000/322080.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('cc1c961b-cfb6-4c4b-8097-289de49b814c', 'Finn Allen', 'KKR', 'New Zealand', '2 Cr', 'Overseas', 'Capped', 'Auction', 'Top-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/383100/383164.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('cd1e73da-bc37-4a67-ac91-5c975e9e6b13', 'Ayush Mhatre', 'CSK', 'India', '4 Cr', 'Indian', 'Uncapped', 'Retained', 'All-rounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/390300/390331.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('d5f44db0-841a-4d05-ae7a-a1ac2545da05', 'Danish Malewar', 'MI', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Top-order batter', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('dcc50bcc-2410-4500-817b-6f72c9dba6b4', 'Abhishek Sharma', 'SRH', 'India', '14 Cr', 'Indian', 'Capped', 'Retained', 'Batting allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/358000/358037.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('dde5de81-0d29-4a14-a322-4e23d6ea80d5', 'Deepak Chahar', 'MI', 'India', '9.25 Cr', 'Indian', 'Capped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322700/322704.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('e32671e9-0fb9-439e-8404-8feb19907760', 'Jason Holder', 'GT', 'West Indies', '7 Cr', 'Overseas', 'Capped', 'Auction', 'Bowling allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/316600/316673.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('e8c9eb8d-dbb3-4c65-9b4a-a7a8d057346d', 'Dushmantha Chameera', 'DC', 'Sri Lanka', '75 Lakh', 'Overseas', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/319800/319862.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('eca22dc1-141b-4644-bd94-dc24d52acb42', 'Abdul Samad', 'LSG', 'India', '4 Cr', 'Indian', 'Capped', 'Retained', 'Batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/339100/339145.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('ee366776-2c2f-4412-a991-9e2412a3cb0d', 'Gurjapneet Singh', 'CSK', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/362500/362596.6.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('f0698d0a-aee1-4354-9313-20cef3065c4d', 'Anuj Rawat', 'GT', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Retained', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/359700/359757.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('f1ade24c-00b1-49e6-ba53-e32e2031254d', 'Devdutt Padikkal', 'RCB', 'India', '11 Cr', 'Indian', 'Capped', 'Retained', 'Top-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322200/322229.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('f2e664a5-ddf9-4661-a666-8cdbc38b6285', 'Angkrish Raghuvanshi', 'KKR', 'India', '3 Cr', 'Indian', 'Uncapped', 'Retained', 'Top-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/345000/345093.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('efca41d8-ab7e-4e4f-a544-ca9c57fdf9a1', 'Vishnu Vinod', 'PBKS', 'India', '30 Lakh', 'Indian', 'Capped', 'Retained', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/359700/359774.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('c9b55054-732f-4dc9-8cb0-605f418770c2', 'Trent Boult', 'MI', 'New Zealand', '12.50 Cr', 'Overseas', 'Capped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/383100/383185.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('14fd7bb4-3b80-4171-a777-26401e73319d', 'Will Jacks', 'MI', 'England', '5.25 Cr', 'Overseas', 'Capped', 'Auction', 'Batting allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/383100/383155.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('06c8f79d-b96e-4133-89d4-f6bae9dc9717', 'Cooper Connolly', 'PBKS', 'Australia', '1.50 Cr', 'Overseas', 'Capped', 'Retained', 'Batting allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/347800/347820.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('27180426-eb9a-4481-afa2-85bcf4a8279e', 'Arshdeep Singh', 'PBKS', 'India', '18 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/390700/390798.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('dd24ea29-3a7a-4446-896d-ab64faee2c49', 'Mayank Markande', 'MI', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/355400/355403.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('c878db52-e312-4a4f-8b58-ae9316e751c4', 'Mohd Izhar', 'MI', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('59564f19-840b-4309-99a2-78e217b9c6bb', 'Naman Dhir', 'MI', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/381300/381384.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('9333b04f-a93a-4adf-a013-161f8ce9e5b2', 'Mitchell Santner', 'MI', 'New Zealand', '2 Cr', 'Overseas', 'Capped', 'Auction', 'Bowling allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/383100/383180.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('fe2000d8-2454-406f-bf1c-9a8d7f5caf03', 'Priyansh Arya', 'PBKS', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Retained', 'Opening batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/391700/391706.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('f856c8bc-c586-4168-8297-5cfdfec8c9a8', 'Ishant Sharma', 'GT', 'India', '75 Lakh', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/316600/316602.3.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('e4159a6f-6f51-4a70-beca-8144f6f027ab', 'Akshat Raghuwanshi', 'LSG', 'India', '2.20 Cr', 'Indian', 'Uncapped', 'Auction', 'Middle-order batter', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('c345f8a7-c1aa-4c52-8466-34f52f474e2c', 'Harshal Patel', 'SRH', 'India', '8 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/381300/381372.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('edfb0647-6615-4799-8884-3d0cc11a450e', 'Digvesh Rathi', 'LSG', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/398600/398608.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('dfd12edb-89bd-4138-bee8-dda9b8688030', 'Donovan Ferreira', 'RR', 'South Africa', '1 Cr', 'Overseas', 'Capped', 'Traded', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/406000/406033.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('ca5d5832-087d-4718-9249-4ddc2d8ee7d1', 'Nehal Wadhera', 'PBKS', 'India', '4 Cr', 'Indian', 'Capped', 'Retained', 'Top-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/381300/381388.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('7e321876-c21d-4130-8976-4cf7e02bd1c5', 'Kanishk Chouhan', 'RCB', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowling allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/412600/412643.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('e6bc6b56-5be5-47e2-b53e-dff4e13a9fa6', 'Nitish Kumar Reddy', 'SRH', 'India', '6 Cr', 'Indian', 'Capped', 'Retained', 'Batting allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/390600/390655.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('264b979d-549e-4711-8aa2-e63570e0a2b7', 'Sarthak Ranjan', 'KKR', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Opening batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/414300/414334.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('9e5257c9-ab42-4a1f-8920-741335609ad0', 'Yash Thakur', 'PBKS', 'India', '3 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/392800/392812.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('0ff6da8d-56aa-40a8-8819-f65525f23c81', 'Prashant Solanki', 'KKR', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/409800/409817.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('8f7210af-fd1a-4330-884b-381488b13040', 'Matthew Breetzke', 'LSG', 'South Africa', '75 Lakh', 'Overseas', 'Capped', 'Retained', 'Batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/388400/388422.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('03ff0a98-b78b-4927-a972-e33f4c9ca787', 'Avesh Khan', 'LSG', 'India', '4.5 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322200/322244.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('374c9d22-ac52-440d-a0ba-4dec27dafbc6', 'Shubham Dubey', 'RR', 'India', '80 Lakh', 'Indian', 'Uncapped', 'Retained', 'Middle-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/398200/398224.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('5fe35f97-d2de-40d3-b6a8-11e68c6d5564', 'Yudhvir Singh', 'RR', 'India', '35 Lakh', 'Indian', 'Uncapped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/314700/314789.jpg', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('d7f33098-d9c2-42a0-97a6-f277c9eb56d4', 'Yash Raj Punja', 'RR', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('2e0b8e18-5c62-481b-948f-e15eddeb9571', 'Vignesh Puthur', 'RR', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('06ab9bc3-3d4e-4293-96d5-fd72a81dbd95', 'Rajat Patidar', 'RCB', 'India', '11 Cr', 'Indian', 'Capped', 'Retained', 'Top-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/390500/390563.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('38285b6b-4f16-4ad0-b0b4-0e60ed3eb684', 'Venkatesh Iyer', 'RCB', 'India', '7 Cr', 'Indian', 'Capped', 'Auction', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/337100/337187.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('884d76fc-aecf-4aaf-ba7a-daa87d48bf4b', 'Mukul Choudhary', 'LSG', 'India', '2.60 Cr', 'Indian', 'Uncapped', 'Auction', 'Middle-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/410600/410621.3.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('c7d77f51-cf6a-4962-b95f-cba824ee5899', 'Riyan Parag', 'RR', 'India', '14 Cr', 'Indian', 'Capped', 'Retained', 'Top-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/370900/370935.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('9f265419-eaf9-4671-9bc0-8c9c7e7da43c', 'Prithvi Shaw', 'DC', 'India', '75 Lakh', 'Indian', 'Capped', 'Auction', 'Opening batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/322600/322622.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('240a0cb6-8890-48ab-8ef7-586d32a66318', 'Lockie Ferguson', 'PBKS', 'New Zealand', '3 Cr', 'Overseas', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/383100/383174.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('86e4a259-eea4-4c2a-993c-b39cba248f16', 'Marco Jansen', 'PBKS', 'South Africa', '7 Cr', 'Overseas', 'Capped', 'Retained', 'Bowling allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/337100/337189.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('64131c4c-cf33-4d73-99d1-ef0a0a45d3d5', 'Musheer Khan', 'PBKS', 'India', '2 Cr', 'Indian', 'Uncapped', 'Retained', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/392100/392178.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('5ecaa56e-eda9-46b5-955a-21c94058d846', 'Mitchell Owen', 'PBKS', 'Australia', '1 Cr', 'Overseas', 'Capped', 'Retained', 'Middle-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/393100/393175.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('9c833509-8758-438f-973a-a2fb537cac05', 'Prabhsimran Singh', 'PBKS', 'India', '4 Cr', 'Indian', 'Capped', 'Retained', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/358000/358040.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('985b3e3e-024c-4b84-aa45-ee155f844639', 'Marcus Stoinis', 'PBKS', 'Australia', '11 Cr', 'Overseas', 'Capped', 'Retained', 'Batting allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/321500/321596.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('235e0675-499d-4de0-b7b4-dd940d6585d8', 'Mitchell Marsh', 'LSG', 'Australia', '12 Cr', 'Overseas', 'Capped', 'Retained', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/385700/385798.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('36e25742-2c7b-41c5-916a-3bb6d516243e', 'Zeeshan Ansari', 'SRH', 'India', '40 Lakh', 'Indian', 'Uncapped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/399200/399247.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('b188885b-903b-45d0-938b-f9472151960f', 'Daksh Kamra', 'KKR', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/414300/414335.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('b190134f-b934-4d8e-84ca-22bfb7825edd', 'Anukul Roy', 'KKR', 'India', '40 Lakh', 'Indian', 'Capped', 'Retained', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/341000/341041.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('f1bef189-1701-4261-9f9b-3fce6509e12e', 'Shimron Hetmyer', 'RR', 'West Indies', '11 Cr', 'Overseas', 'Capped', 'Retained', 'Middle-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/320100/320116.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('74e41839-7ce8-42e7-91cc-3b980f4129eb', 'Ravindra Jadeja', 'RR', 'India', '14 Cr', 'Indian', 'Capped', 'Traded', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/316600/316600.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('2778c9cc-f814-473c-80c8-42e08689367a', 'Ravi Bishnoi', 'RR', 'India', '7.20 Cr', 'Indian', 'Capped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/337100/337188.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('878c472a-2caf-4d0c-9630-5ba78317b42f', 'Tushar Deshpande', 'RR', 'India', '6.50 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/398600/398605.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('714a3c17-0c95-4bf7-a3c2-205814c01b0f', 'Rasikh Salam', 'RCB', 'India', '50 Lakh', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/341000/341040.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('20b862be-b10d-4778-9aab-f129187f3321', 'Suyash Sharma', 'RCB', 'India', '50 Lakh', 'Indian', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/358000/358041.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('ddeafcb2-ee56-41e2-a277-8135f88928a9', 'Satvik Deswal', 'RCB', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('4e1de119-b68c-41a3-a2c8-03beceb80271', 'Vicky Ostwal', 'RCB', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/408800/408829.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('7256cc7c-4bf3-4f5d-b13f-24a3d2238dd6', 'Vihaan Malhotra', 'RCB', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Batting allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/412600/412644.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('99b10cc0-ce34-47bc-aedc-efe6e85b80e4', 'Travis Head', 'SRH', 'Australia', '14 Cr', 'Overseas', 'Capped', 'Retained', 'Middle-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/321500/321584.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('a8ef988d-5266-4059-99f6-e19b7d680a24', 'Pathum Nissanka', 'DC', 'Sri Lanka', '4 Cr', 'Overseas', 'Capped', 'Auction', 'Top-order batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/323000/323070.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('077d7e28-7792-446f-9cde-162462f0df79', 'Pyla Avinash', 'PBKS', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Retained', 'Batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/401100/401145.2.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('0dfaa056-9ca9-4c18-b1bb-b9e0ce00128f', 'Jamie Overton', 'CSK', 'England', '3 Cr', 'Overseas', 'Capped', 'Retained', 'All-rounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/324200/324243.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('6cb87f6f-bc8b-4089-8503-09d5075df578', 'Dhruv Jurel', 'RR', 'India', '14 Cr', 'Indian', 'Capped', 'Retained', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/340300/340310.1.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('fbeda896-2ce0-4743-8dda-533f831caa58', 'Hardik Pandya', 'MI', 'India', '18 Cr', 'Indian', 'Capped', 'Retained', 'Allrounder', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/388300/388343.5.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('fefe8e5c-5046-449f-b652-da736305fc17', 'Ben Dwarshuis', 'PBKS', 'Australia', '1 Cr', 'Overseas', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/390000/390030.6.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('ff1f8b46-1fc6-40e1-9eb6-7a7ec5264cf8', 'Aman Rao', 'RR', 'India', '30 Lakh', 'Indian', 'Uncapped', 'Auction', 'Opening batter', 'Unsold', NULL, NULL, NULL, '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('6b4d6b67-b9d2-4242-a6aa-e7e13f32e8c9', 'KL Rahul', 'DC', 'India', '14 Cr', 'Indian', 'Capped', 'Retained', 'Wicketkeeper batter', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/319900/319942.3.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL),
	('270e919d-45f9-47db-b103-6c5a99d176c1', 'Nuwan Thushara', 'RCB', 'Sri Lanka', '50 Lakh', 'Overseas', 'Capped', 'Retained', 'Bowler', 'Unsold', NULL, NULL, '/lsci/db/PICTURES/CMS/381300/381395.7.png', '2026-03-10 02:40:03.659655+00', NULL, 'pending', NULL);


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "full_name", "avatar_url", "team_name", "budget", "role", "updated_at", "created_at", "email") VALUES
	('aec4f3a8-eb15-416e-b407-0b4884e186a5', 'Project 7072', 'https://lh3.googleusercontent.com/a/ACg8ocLFnKLDThfQUA9GX_eWEPfQZLkfYs8QoLkJCLhNgFIlKJARpQ=s96-c', 'New Franchise', 0, 'Viewer', '2026-03-11 01:29:00.627431+00', '2026-03-11 01:29:00.627431+00', 'project7072@gmail.com'),
	('1685dfdd-00b9-41dc-b652-e311019c764a', 'Harsh Shah', 'https://lh3.googleusercontent.com/a/ACg8ocJZK38MalwunRwknQXtLUsEdKe0vWrEcxkyWRnKMpQlyi9jYejlQw=s96-c', 'Formidable Fuckers', 120, 'Admin', '2026-03-11 16:08:56.909608+00', '2026-03-11 16:08:56.909608+00', 'harshshah661992@gmail.com'),
	('365433f9-feba-4aed-bab6-5e2037b8be16', 'Parth', 'https://lh3.googleusercontent.com/a/ACg8ocIKTJZFzeYs-u3Fb7xdvl2BuSLdgRxNUE0vjRyuq9ngVDCPjQ=s96-c', 'WIMWI Warriors', 120, 'Admin', '2026-03-11 06:07:15.842098+00', '2026-03-11 06:07:15.842098+00', 'tradingwithparthshah@gmail.com'),
	('b6ea0551-f997-4f67-9065-ec24d0d0ce84', 'Naisarg Halvadia', 'https://lh3.googleusercontent.com/a/ACg8ocKonobI09yuPC3WOfY7mJixSaJxah9sh8VaMetpQOatabOspRN1=s96-c', 'No M&M', 120, 'Admin', '2026-03-11 01:29:04.650207+00', '2026-03-11 01:29:04.650207+00', 'naisicric97@gmail.com'),
	('a6d318ca-20a7-4b37-9976-1fb0ea12fdb4', 'Prashant Jalan', 'https://lh3.googleusercontent.com/a/ACg8ocKR1k3w8qu93IRbBhdl1DySk0iVkjtSuLhNRWHJe_CTUh9IGfx-RQ=s96-c', 'Fuckchod Army', 120, 'Admin', '2026-03-11 22:01:46.414299+00', '2026-03-11 22:01:46.414299+00', 'jalan.me4u@gmail.com');


--
-- Data for Name: auction_state; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."auction_state" ("id", "current_player_id", "status", "base_price", "current_bid", "current_bidder_id", "current_bidder_name", "min_increment", "started_at", "updated_at", "passed_user_ids") VALUES
	('b207f1ba-56d5-4ac4-a1b0-d30b30ece1ec', NULL, 'waiting', 2, 0, NULL, NULL, 0.5, '2026-03-11 01:28:37.767762+00', '2026-03-11 01:28:37.767762+00', '{}');


--
-- Data for Name: bids; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: rules; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 89, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict WS0jA9yRUmYfPKWe2ckzRKoF0gmGmhNG5GlGDTchGXmBhpV7CDq1SNcZwFQrl0g

RESET ALL;
