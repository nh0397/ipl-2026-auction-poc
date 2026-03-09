"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

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
      // Step 1: Check if Supabase itself returned an error in the URL
      const params = new URLSearchParams(window.location.search);
      const oauthError = params.get("error");
      const oauthErrorDesc = params.get("error_description");

      if (oauthError) {
        const msg = oauthErrorDesc?.replace(/\+/g, " ") || "Authentication failed.";
        console.error("OAuth error from Supabase:", msg);
        setErrorMsg(msg);
        return; // Don't redirect — show error to user
      }

      // Step 2: Handle PKCE code exchange if present
      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setErrorMsg("Failed to complete login. Please try again.");
          return;
        }
      }

      // Step 3: Get the session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setErrorMsg("Could not establish a session. Please try again.");
        return;
      }

      // Step 4: Check the allowlist
      const email = session.user.email?.toLowerCase() || '';
      if (!ALLOWED_EMAILS.includes(email)) {
        await supabase.auth.signOut();
        setErrorMsg(`Access denied. ${email} is not authorized for this platform.`);
        return;
      }

      // ✅ All clear — store approval and go to dashboard
      localStorage.setItem("auth_approved", "true");
      router.replace("/dashboard");
    };

    handleAuth();
  }, [router]);

  // Show error state (not a loop)
  if (errorMsg) {
    return (
      <div className="flex min-h-screen items-center justify-center font-sans bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-lg p-10 text-center space-y-6 border border-red-100">
          <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Login Failed</h2>
            <p className="text-slate-500 font-medium leading-relaxed">{errorMsg}</p>
          </div>
          <button
            onClick={() => router.replace("/")}
            className="w-full h-12 bg-slate-900 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-800 transition-all"
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
        <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-600 font-bold tracking-tight">Verifying access...</p>
        <p className="text-slate-400 text-xs">Checking your credentials</p>
      </div>
    </div>
  );
}
