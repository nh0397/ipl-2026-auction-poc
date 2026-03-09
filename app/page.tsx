"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, LogIn, Chrome } from "lucide-react";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    checkUser();

    // Connection check
    const checkConnection = async () => {
        try {
            const { error } = await supabase.from('players').select('id').limit(1);
            // If error is just "table doesn't exist", the connection itself is working
            if (!error || error.code === 'PGRST116' || error.message.includes('relation "players" does not exist')) {
                setDbConnected(true);
            } else {
                setDbConnected(false);
            }
        } catch (e) {
            setDbConnected(false);
        }
    };
    checkConnection();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans">
        <Card className="w-full max-w-md shadow-2xl border-none">
          <CardHeader className="text-center">
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Welcome, {user.user_metadata.full_name || user.email}</CardTitle>
            <CardDescription className="text-slate-500">You are ready for the auction.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pt-4">
            <Button onClick={handleLogout} variant="outline" className="w-full border-2 hover:border-red-600 hover:text-red-600 font-bold h-11 rounded-xl transition-all">
              Sign Out from Auction
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <div className="bg-blue-600 p-8 text-white text-center">
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
