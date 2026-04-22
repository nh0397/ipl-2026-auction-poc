"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";

const APP_NAME = "IPL 2026 Auction Hub";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 4 1.5l2.7-2.6C17 2.9 14.7 2 12 2 6.9 2 2.8 6.4 2.8 11.8S6.9 21.6 12 21.6c6.9 0 9.1-4.9 9.1-7.4 0-.5-.1-.9-.1-1.3H12z"
      />
      <path
        fill="#34A853"
        d="M2.8 11.8c0 1.7.6 3.3 1.7 4.6l2.8-2.2c-.4-.7-.7-1.5-.7-2.4s.2-1.7.7-2.4L4.5 7.2c-1.1 1.3-1.7 2.9-1.7 4.6z"
      />
      <path
        fill="#4A90E2"
        d="M12 21.6c2.7 0 5-.9 6.7-2.4l-3.2-2.6c-.9.6-2.1 1-3.5 1-2.6 0-4.8-1.8-5.6-4.1l-2.9 2.2c1.6 3.3 4.8 5.9 8.5 5.9z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.5c-.2-.5-.4-1.1-.4-1.7s.1-1.2.4-1.7L3.5 7.9C2.9 9.1 2.6 10.4 2.6 11.8s.3 2.7.9 3.9l2.9-2.2z"
      />
    </svg>
  );
}

function LoginPageContent() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const [loadingAction, setLoadingAction] = useState<"google" | "signIn" | "signUp" | null>(null);
  const [authMode, setAuthMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Show error if redirected back with error param
    const err = searchParams.get("error");
    if (err === "not_allowed") setErrorMsg("Your account is not authorized to access this platform.");
    if (err === "auth_failed") setErrorMsg("Authentication failed. Please try again.");

    // Redirect if already logged in (Stateless check)
    if (user && profile) {
      if (profile.role === 'Viewer') {
        router.replace("/auction");
      } else {
        router.replace("/dashboard");
      }
    }

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
  }, [searchParams, router, user, profile]);

  const handleGoogleLogin = async () => {
    setLoadingAction("google");
    setErrorMsg(null);
    setSuccessMsg(null);
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
      setLoadingAction(null);
    }
  };

  const validateEmailPassword = () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setErrorMsg("Please enter both email and password.");
      return null;
    }
    if (!trimmedEmail.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return null;
    }
    if (authMode === "signUp") {
      if (password.length < 8) {
        setErrorMsg("Password should be at least 8 characters.");
        return null;
      }
      if (password !== confirmPassword) {
        setErrorMsg("Passwords do not match.");
        return null;
      }
    }
    return { trimmedEmail };
  };

  const handleEmailAuth = async () => {
    const validated = validateEmailPassword();
    if (!validated) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoadingAction(authMode);

    try {
      if (authMode === "signIn") {
        const { error } = await supabase.auth.signInWithPassword({
          email: validated.trimmedEmail,
          password,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: validated.trimmedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;

        if (!data.session) {
          setSuccessMsg("Account created. Please check your email to verify and then sign in.");
        } else {
          setSuccessMsg("Account created. You are now signed in.");
        }
      }
    } catch (error: any) {
      const rawMsg = typeof error?.message === "string" ? error.message : "";
      if (/invalid login credentials/i.test(rawMsg)) {
        setErrorMsg("Invalid credentials. If you originally used Google, click 'Forgot password?' to set a password for this email.");
      } else if (/user already registered/i.test(rawMsg)) {
        setErrorMsg("This email already exists. Sign in, or use 'Forgot password?' to create/reset a password for this email.");
      } else {
        setErrorMsg(rawMsg || "Authentication failed. Please try again.");
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleForgotPassword = async () => {
    const emailToReset = resetEmail.trim().toLowerCase();
    if (!emailToReset || !emailToReset.includes("@")) {
      setErrorMsg("Enter a valid email to reset your password.");
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoadingAction("signIn");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailToReset, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      setSuccessMsg("Password reset email sent. Check your inbox.");
      setShowForgotPassword(false);
    } catch (error: any) {
      const msg = typeof error?.message === "string" ? error.message : "Could not send reset email.";
      setErrorMsg(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="flex h-[100dvh] bg-[var(--background)] text-[var(--foreground)] font-sans overflow-hidden">
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
            {APP_NAME}
          </h1>
          <p className="text-xl font-medium text-slate-200 leading-relaxed">
            Register now to participate in the most anticipated cricket event of the year. 
            Build your dream team and dominate the league.
          </p>
        </div>
      </div>

      {/* Right Section - Login Form */}
      <div className="w-full lg:w-[34%] xl:w-[32%] flex flex-col px-5 py-4 md:px-8 md:py-6 bg-[color-mix(in_oklab,var(--background)_92%,white_8%)] border-l border-[var(--border)] shadow-[-20px_0_50px_rgba(0,0,0,0.05)] z-20">
        <div className="w-full max-w-lg mx-auto h-full flex flex-col justify-center gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2.5 flex-1 min-w-0">
              <img
                src="/images/ipl2026.png"
                alt={`${APP_NAME} logo`}
                className="h-12 w-12 rounded-xl border border-[var(--border)] bg-[var(--card)] object-cover p-1 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-blue-700 dark:text-yellow-300">Official Portal</p>
                <h1 className="text-[1.65rem] leading-none font-black tracking-tight text-[var(--foreground)] truncate">{APP_NAME}</h1>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 md:p-6 shadow-[0_12px_35px_-22px_rgba(15,23,42,0.5)] space-y-4">
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-[var(--foreground)] tracking-tight uppercase">Sign In</h2>
              <p className="text-[var(--muted-foreground)] font-medium text-sm leading-snug">
                Access live bidding with Google or your email and password.
              </p>
            </div>
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-bold">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-xs font-bold">
                {successMsg}
              </div>
            )}
            <Button 
              variant="outline" 
              className="w-full h-12 text-sm font-bold flex items-center justify-center gap-3 border-2 border-[var(--border)] hover:bg-[var(--secondary)] hover:border-blue-500 dark:hover:border-yellow-400 transition-all rounded-xl shadow-sm"
              onClick={handleGoogleLogin}
              disabled={loadingAction !== null}
            >
              {loadingAction === "google" ? (
                <div className="h-4 w-4 border-2 border-blue-600 dark:border-yellow-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              <span>{loadingAction === "google" ? "Authenticating..." : "Continue with Google"}</span>
            </Button>

            <div className="flex items-center gap-4 py-1">
              <div className="h-[1px] flex-1 bg-[var(--border)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted-foreground)]/60">Or</span>
              <div className="h-[1px] flex-1 bg-[var(--border)]" />
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--secondary)] p-1">
                <button
                  onClick={() => {
                    setAuthMode("signIn");
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                className={`h-9 rounded-lg text-xs font-bold transition ${
                    authMode === "signIn" ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setAuthMode("signUp");
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                className={`h-9 rounded-lg text-xs font-bold transition ${
                    authMode === "signUp" ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {authMode === "signIn" && showForgotPassword ? (
                <div className="rounded-xl border border-blue-200/60 bg-blue-500/10 dark:border-yellow-300/40 dark:bg-yellow-400/10 p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-blue-900 dark:text-yellow-100">
                    Enter your email and we&apos;ll send a reset link.
                  </p>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full h-10 px-3 rounded-xl border border-[var(--input)] bg-[var(--background)] text-xs font-medium text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-yellow-300/30 focus:border-blue-400 dark:focus:border-yellow-400"
                    autoComplete="email"
                  />
                  <Button
                    type="button"
                    className="w-full h-9 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-yellow-400 dark:hover:bg-yellow-300 dark:text-slate-900 text-white"
                    onClick={handleForgotPassword}
                    disabled={loadingAction !== null}
                  >
                    {loadingAction === "signIn" ? "Sending..." : "Send Reset Link"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="w-full text-[11px] font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full h-10 px-3 rounded-xl border border-[var(--input)] bg-[var(--background)] text-xs font-medium text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-yellow-300/30 focus:border-blue-400 dark:focus:border-yellow-400"
                    autoComplete="email"
                  />

                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={authMode === "signUp" ? "Create a password (min 8 chars)" : "Password"}
                    className="w-full h-10 px-3 rounded-xl border border-[var(--input)] bg-[var(--background)] text-xs font-medium text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-yellow-300/30 focus:border-blue-400 dark:focus:border-yellow-400"
                    autoComplete={authMode === "signUp" ? "new-password" : "current-password"}
                  />

                  {authMode === "signIn" && (
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setResetEmail(email);
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className="text-[11px] font-bold text-blue-700 hover:text-blue-800 dark:text-yellow-300 dark:hover:text-yellow-200"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}

                  {authMode === "signUp" && (
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      className="w-full h-10 px-3 rounded-xl border border-[var(--input)] bg-[var(--background)] text-xs font-medium text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-yellow-300/30 focus:border-blue-400 dark:focus:border-yellow-400"
                      autoComplete="new-password"
                    />
                  )}

                  <Button
                    className="w-full h-10 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-yellow-400 dark:hover:bg-yellow-300 dark:text-slate-900 text-white"
                    onClick={handleEmailAuth}
                    disabled={loadingAction !== null}
                  >
                    {loadingAction === authMode ? "Please wait..." : authMode === "signUp" ? "Create Account" : "Sign In with Email"}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-2xl border border-blue-400/50 dark:border-yellow-300/50">
            <h4 className="text-[var(--foreground)] font-black text-[11px] uppercase mb-1">Participant Notice</h4>
            <p className="text-[var(--foreground)] text-xs font-medium leading-relaxed opacity-95">
              Only registered users are permitted. You can continue with Google or use email and password.
            </p>
          </div>

            <div className="flex items-center justify-center gap-2">
                <div className={`h-2 w-2 rounded-full ${dbConnected === true ? 'bg-green-500' : dbConnected === false ? 'bg-red-500' : 'bg-slate-300 animate-pulse'}`} />
                <span className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
                    {dbConnected === true ? 'Supabase Connected' : dbConnected === false ? 'Connection Failed' : 'Checking Connection...'}
                </span>
            </div>
            <p className="text-[10px] text-center text-[var(--muted-foreground)]/70 font-bold uppercase tracking-widest mt-2">
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
          <Trophy className="h-12 w-12 text-blue-600 dark:text-yellow-400 animate-bounce" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Auction Portal...</p>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
