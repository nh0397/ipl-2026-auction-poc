"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const AuthContext = createContext<{
  user: any;
  profile: any;
  isLoading: boolean;
}>({
  user: null,
  profile: null,
  isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ 
  children, 
  initialSession,
  initialProfile 
}: { 
  children: React.ReactNode;
  initialSession: any;
  initialProfile: any;
}) {
  const [user, setUser] = useState(initialSession?.user ?? null);
  const [profile, setProfile] = useState(initialProfile);
  const [isLoading, setIsLoading] = useState(!initialSession);
  const router = useRouter();
  const hasInitialized = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      // ONLY refresh on actual sign-in/sign-out transitions,
      // NOT on INITIAL_SESSION or TOKEN_REFRESHED (which cause infinite loops).
      if (event === 'SIGNED_IN' && hasInitialized.current) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", currentUser?.id)
          .single();
        setProfile(prof || null);
        router.refresh();
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        router.refresh();
      }
      
      hasInitialized.current = true;
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
