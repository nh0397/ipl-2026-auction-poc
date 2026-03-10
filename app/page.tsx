"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, LogIn, Chrome, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function LoginPageContent() {
  const [loading, setLoading] = useState(false);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Show error if redirected back with error param
    const err = searchParams.get("error");
    if (err === "not_allowed") setErrorMsg("Your account is not authorized to access this platform.");
    if (err === "auth_failed") setErrorMsg("Authentication failed. Please try again.");

    // If already logged in with approval flag, go straight to dashboard
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && localStorage.getItem("auth_approved") === "true") {
        router.replace("/dashboard");
      }
    };
    checkSession();

    // Connection check
    const checkConnection = async () => {
      try {
        const { error } = await supabase.from('players').select('id').limit(1);
        setDbConnected(!error || error.code === 'PGRST116');
      } catch {
        setDbConnected(false);
      }
    };
    checkConnection();
  }, [searchParams, router]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error("Error logging in:", error);
      setErrorMsg("Failed to start login. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white font-sans overflow-hidden">
      {/* 70% Left Section - Hero Image (Hidden on mobile or stacks) */}
      <div className="hidden lg:flex lg:w-[70%] relative bg-slate-900">
        <img 
          src="/images/login-hero.png" 
          alt="IPL Auction Hero" 
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/60 to-transparent" />
        <div className="relative z-10 flex flex-col justify-end p-20 text-white max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <Trophy className="h-10 w-10 text-yellow-500" />
            <span className="text-2xl font-black uppercase tracking-widest text-yellow-500">Official Portal</span>
          </div>
          <h1 className="text-7xl font-black uppercase tracking-tighter leading-none mb-6">
            IPL 2026 <br /> Auction POC.
          </h1>
          <p className="text-xl font-medium text-slate-200 leading-relaxed">
            Register now to participate in the most anticipated cricket event of the year. 
            Build your dream team and dominate the league.
          </p>
        </div>
      </div>

      {/* 30% Right Section - Login Form (Full width on mobile) */}
      <div className="w-full lg:w-[30%] flex flex-col justify-center p-8 md:p-12 lg:p-16 bg-white shadow-[-20px_0_50px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-md mx-auto w-full space-y-10">
          <div className="bg-blue-600 p-8 text-white text-center rounded-[2rem]">
            <Trophy className="h-16 w-16 mx-auto mb-4" />
            <h1 className="text-3xl font-black tracking-tighter uppercase leading-tight">IPL 2026 <br /> Auction POC</h1>
          </div>

          <div className="space-y-3">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Sign In</h2>
            <p className="text-slate-500 font-medium text-lg leading-snug">
              Access the live bidding arena with your verified Google account.
            </p>
          </div>

          <div className="space-y-4">
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm font-bold">
                {errorMsg}
              </div>
            )}
            <Button 
              variant="outline" 
              className="w-full h-14 text-base font-bold flex items-center justify-center gap-3 border-2 border-slate-100 hover:bg-slate-50 hover:border-blue-600 transition-all rounded-2xl shadow-sm"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Chrome className="h-5 w-5 text-blue-600" />
              )}
              <span>{loading ? "Authenticating..." : "Continue with Google"}</span>
            </Button>
          </div>

          <div className="flex items-center gap-4 py-2">
            <div className="h-[1px] flex-1 bg-slate-100" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Fast & Secure</span>
            <div className="h-[1px] flex-1 bg-slate-100" />
          </div>

          <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100/50">
            <h4 className="text-blue-900 font-black text-xs uppercase mb-2">Participant Notice</h4>
            <p className="text-blue-800 text-xs font-medium leading-relaxed opacity-80">
              Only registered auctioneers are permitted. Ensure your Google account is linked to your team manager profile.
            </p>
          </div>

          <div className="pt-8">
            <div className="flex items-center justify-center gap-2">
                <div className={`h-2 w-2 rounded-full ${dbConnected === true ? 'bg-green-500' : dbConnected === false ? 'bg-red-500' : 'bg-slate-300 animate-pulse'}`} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {dbConnected === true ? 'Supabase Connected' : dbConnected === false ? 'Connection Failed' : 'Checking Connection...'}
                </span>
            </div>
            <p className="text-[10px] text-center text-slate-300 font-bold uppercase tracking-widest mt-2">
              © 2026 IPL AUCTION AUTHORITY
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <Trophy className="h-12 w-12 text-blue-600 animate-bounce" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Auction Portal...</p>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
