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
    const handleAuth = async () => {
      const params = new URLSearchParams(window.location.search);

      // 1. Supabase returned an error before we even got here
      const oauthError = params.get("error");
      if (oauthError) {
        const desc = params.get("error_description")?.replace(/\+/g, " ");
        setErrorMsg(desc || "Authentication failed. Please try again.");
        return;
      }

      // 2. PKCE flow: exchange the code for a session and use the
      //    session returned directly — no second getSession() call needed
      const code = params.get("code");
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error || !data.session) {
          setErrorMsg("Could not complete login. Please try again.");
          return;
        }
        return finalize(data.session.user.email);
      }

      // 3. Implicit flow fallback: tokens arrive as URL hash fragments.
      //    Supabase processes these automatically; just wait a tick then
      //    read the session.
      await new Promise((r) => setTimeout(r, 500));
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        setErrorMsg("Could not establish a session. Please try again.");
        return;
      }
      return finalize(session.user.email);
    };

    const finalize = async (email: string | undefined) => {
      const normalizedEmail = email?.toLowerCase() || '';

      if (!ALLOWED_EMAILS.includes(normalizedEmail)) {
        await supabase.auth.signOut();
        setErrorMsg(`Access denied. ${normalizedEmail} is not authorised for this platform.`);
        return;
      }

      localStorage.setItem("auth_approved", "true");
      router.replace("/dashboard");
    };

    handleAuth();
  }, [router]);

  // Error state — clear landing, not a loop
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

  // Loading state
  return (
    <div className="flex min-h-screen items-center justify-center font-sans bg-slate-50">
      <div className="text-center space-y-4">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin mx-auto" />
        <p className="text-slate-700 font-black uppercase tracking-widest text-xs">Verifying access...</p>
      </div>
    </div>
  );
}
