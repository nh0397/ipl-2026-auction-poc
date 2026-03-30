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
  const lastStatus = useRef(initialSession ? 'in' : 'out');
  const router = useRouter();
  const hasInitialized = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      const currentStatus = currentUser ? 'in' : 'out';
      
      setUser(currentUser);
      
      // ONLY refresh on actual sign-in/sign-out transitions,
      // and NOT if we've already handled it (prevents infinite loop).
      if (lastStatus.current !== currentStatus && hasInitialized.current) {
        lastStatus.current = currentStatus;
        if (event === 'SIGNED_IN') {
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
