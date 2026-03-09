"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuth = async () => {
      const { error } = await supabase.auth.getSession();
      if (!error) {
        router.push("/");
      } else {
        router.push("/login?error=auth_failed");
      }
    };
    handleAuth();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center font-sans bg-slate-50">
      <div className="text-center space-y-4">
        <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-600 font-bold tracking-tight">Completing authentication...</p>
      </div>
    </div>
  );
}
