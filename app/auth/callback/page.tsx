"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

export default function AuthCallback() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setErrorMsg("Verification timed out. Please try logging in again.");
      }
    }, 30000);

    const finalize = async () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      localStorage.setItem("auth_approved", "true");
      router.replace("/dashboard");
    };

    // 1. Check for OAuth error params
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    if (oauthError) {
      resolved = true;
      clearTimeout(timeout);
      const desc = params.get("error_description")?.replace(/\+/g, " ");
      setErrorMsg(desc || "Authentication failed. Please try again.");
      return;
    }

    // 2. Listen for SIGNED_IN event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        subscription.unsubscribe();
        finalize();
      }
    });

    // 3. Check if session already exists
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !resolved) {
        subscription.unsubscribe();
        finalize();
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [router]);

  if (errorMsg) {
    return (
      <div className="flex min-h-screen items-center justify-center font-sans bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-lg p-10 text-center space-y-6 border border-red-100">
          <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Login Failed</h2>
            <p className="text-slate-500 font-medium leading-relaxed text-sm">{errorMsg}</p>
          </div>
          <button
            onClick={() => router.replace("/")}
            className="w-full h-12 bg-slate-900 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-800 transition-all cursor-pointer"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center font-sans bg-slate-50">
      <div className="text-center space-y-4">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin mx-auto" />
        <p className="text-slate-700 font-black uppercase tracking-widest text-xs">Verifying access...</p>
        <p className="text-slate-400 text-xs font-medium">Times out in 30 seconds</p>
      </div>
    </div>
  );
}
