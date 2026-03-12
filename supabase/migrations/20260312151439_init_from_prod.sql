


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  existing_id UUID;
  assigned_role TEXT;
BEGIN
  -- STRICT WHITELIST: ONLY THESE 4 GET ADMIN
  IF new.email IN (
    'jalan.me4u@gmail.com',
    'harshshah661992@gmail.com',
    'tradingwithparthshah@gmail.com',
    'naisicric97@gmail.com'
  ) THEN
    assigned_role := 'Admin';
  ELSE
    assigned_role := 'Viewer';
  END IF;

  SELECT id INTO existing_id FROM public.profiles WHERE email = new.email;
  
  IF existing_id IS NOT NULL THEN
    UPDATE public.profiles SET 
      id = new.id,
      full_name = COALESCE(new.raw_user_meta_data->>'full_name', full_name),
      avatar_url = COALESCE(new.raw_user_meta_data->>'avatar_url', avatar_url),
      role = assigned_role,
      updated_at = NOW()
    WHERE email = new.email;
  ELSE
    INSERT INTO public.profiles (id, email, full_name, avatar_url, role, budget)
    VALUES (
      new.id, new.email, 
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'avatar_url', 
      assigned_role, 
      CASE WHEN assigned_role = 'Viewer' THEN 0 ELSE 120 END
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."auction_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "status" "text" DEFAULT 'setup'::"text" NOT NULL,
    "current_pool" "text" DEFAULT 'Marquee'::"text",
    "pools_frozen" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "budget_per_team" numeric DEFAULT 120,
    "min_players" integer DEFAULT 18,
    "max_players" integer DEFAULT 25,
    CONSTRAINT "auction_config_status_check" CHECK (("status" = ANY (ARRAY['setup'::"text", 'frozen'::"text", 'live'::"text", 'paused'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."auction_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auction_settings" (
    "id" "text" DEFAULT 'current_rules'::"text" NOT NULL,
    "content" "text" DEFAULT '<h1>IPL 2026 Auction Rules</h1><p>Start writing here...</p>'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    "active_lot" "text" DEFAULT 'Set 1'::"text"
);


ALTER TABLE "public"."auction_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auction_state" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "current_player_id" "uuid",
    "status" "text" DEFAULT 'waiting'::"text" NOT NULL,
    "base_price" numeric DEFAULT 2 NOT NULL,
    "current_bid" numeric DEFAULT 0 NOT NULL,
    "current_bidder_id" "uuid",
    "current_bidder_name" "text",
    "min_increment" numeric DEFAULT 0.5 NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "passed_user_ids" "text"[] DEFAULT '{}'::"text"[],
    CONSTRAINT "auction_state_status_check" CHECK (("status" = ANY (ARRAY['waiting'::"text", 'active'::"text", 'sold'::"text", 'unsold'::"text"])))
);


ALTER TABLE "public"."auction_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bids" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid",
    "bidder_id" "uuid",
    "bidder_name" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bids" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "user_name" "text" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_name" "text" NOT NULL,
    "team" "text" NOT NULL,
    "country" "text" NOT NULL,
    "price" "text" NOT NULL,
    "type" "text",
    "capped_uncapped" "text",
    "acquisition" "text",
    "role" "text",
    "status" "text" DEFAULT 'Available'::"text" NOT NULL,
    "sold_to" "text",
    "sold_price" "text",
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "pool" "text",
    "auction_status" "text" DEFAULT 'pending'::"text",
    "sold_to_id" "uuid",
    CONSTRAINT "players_auction_status_check" CHECK (("auction_status" = ANY (ARRAY['pending'::"text", 'on_block'::"text", 'sold'::"text", 'unsold'::"text"])))
);


ALTER TABLE "public"."players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "team_name" "text" DEFAULT 'New Franchise'::"text",
    "budget" numeric DEFAULT 120,
    "role" "text" DEFAULT 'Participant'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "email" "text" NOT NULL,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['Admin'::"text", 'Participant'::"text", 'Viewer'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rules" OWNER TO "postgres";


ALTER TABLE ONLY "public"."auction_config"
    ADD CONSTRAINT "auction_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auction_settings"
    ADD CONSTRAINT "auction_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auction_state"
    ADD CONSTRAINT "auction_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bids"
    ADD CONSTRAINT "bids_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rules"
    ADD CONSTRAINT "rules_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_players_pool" ON "public"."players" USING "btree" ("pool");



ALTER TABLE ONLY "public"."auction_settings"
    ADD CONSTRAINT "auction_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."auction_state"
    ADD CONSTRAINT "auction_state_current_bidder_id_fkey" FOREIGN KEY ("current_bidder_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."auction_state"
    ADD CONSTRAINT "auction_state_current_player_id_fkey" FOREIGN KEY ("current_player_id") REFERENCES "public"."players"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bids"
    ADD CONSTRAINT "bids_bidder_id_fkey" FOREIGN KEY ("bidder_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bids"
    ADD CONSTRAINT "bids_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."auction_config";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."auction_settings";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."auction_state";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."bids";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."players";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profiles";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";


















GRANT ALL ON TABLE "public"."auction_config" TO "anon";
GRANT ALL ON TABLE "public"."auction_config" TO "authenticated";
GRANT ALL ON TABLE "public"."auction_config" TO "service_role";



GRANT ALL ON TABLE "public"."auction_settings" TO "anon";
GRANT ALL ON TABLE "public"."auction_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."auction_settings" TO "service_role";



GRANT ALL ON TABLE "public"."auction_state" TO "anon";
GRANT ALL ON TABLE "public"."auction_state" TO "authenticated";
GRANT ALL ON TABLE "public"."auction_state" TO "service_role";



GRANT ALL ON TABLE "public"."bids" TO "anon";
GRANT ALL ON TABLE "public"."bids" TO "authenticated";
GRANT ALL ON TABLE "public"."bids" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."players" TO "anon";
GRANT ALL ON TABLE "public"."players" TO "authenticated";
GRANT ALL ON TABLE "public"."players" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."rules" TO "anon";
GRANT ALL ON TABLE "public"."rules" TO "authenticated";
GRANT ALL ON TABLE "public"."rules" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


