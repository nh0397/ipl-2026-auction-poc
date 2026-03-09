"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

const ALLOWED_EMAILS = [
  'project7072@gmail.com',
  'jalan.me4u@gmail.com',
  'harshshah661992@gmail.com',
  'parthshah8462@gmail.com',
  'vatsalchilodiya@gmail.com',
  'naisicric97@gmail.com'
];

export default function AuthCallback() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let resolved = false;

    // Timeout after 30 seconds — don't leave the user hanging
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setErrorMsg("Verification timed out. Please try logging in again.");
      }
    }, 30000);

    const finalize = async (email: string | undefined) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);

      const normalizedEmail = email?.toLowerCase() || '';
      if (!ALLOWED_EMAILS.includes(normalizedEmail)) {
        await supabase.auth.signOut();
        setErrorMsg(`Access denied. ${normalizedEmail} is not authorised.`);
        return;
      }

      localStorage.setItem("auth_approved", "true");
      router.replace("/dashboard");
    };

    // 1. Check for Supabase-level error params in URL (e.g. db trigger failure)
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    if (oauthError) {
      resolved = true;
      clearTimeout(timeout);
      const desc = params.get("error_description")?.replace(/\+/g, " ");
      setErrorMsg(desc || "Authentication failed. Please try again.");
      return;
    }

    // 2. Listen for the SIGNED_IN event — this fires for ALL OAuth flows
    //    (both PKCE and implicit) once Supabase resolves the session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        subscription.unsubscribe();
        finalize(session.user.email);
      }
    });

    // 3. Also try immediately in case session is already available
    //    (returning user, or PKCE exchange already completed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !resolved) {
        subscription.unsubscribe();
        finalize(session.user.email);
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
