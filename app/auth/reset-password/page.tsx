"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password.length < 8) {
      setErrorMsg("Password should be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccessMsg("Password updated successfully. Redirecting to sign in...");
      setTimeout(() => {
        router.replace("/");
      }, 1200);
    } catch (error: any) {
      const msg = typeof error?.message === "string" ? error.message : "Could not update password.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm space-y-5"
      >
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Account Recovery</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Reset Password</h1>
          <p className="text-sm text-slate-500">Set a new password for your account.</p>
        </div>

        {errorMsg ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{errorMsg}</div>
        ) : null}
        {successMsg ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{successMsg}</div>
        ) : null}

        <div className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (min 8 chars)"
            autoComplete="new-password"
            className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            autoComplete="new-password"
            className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          />
        </div>

        <Button type="submit" className="w-full h-11 rounded-xl text-sm font-bold" disabled={isSubmitting}>
          {isSubmitting ? "Updating..." : "Update Password"}
        </Button>

        <button
          type="button"
          onClick={() => router.replace("/")}
          className="w-full text-xs font-bold text-slate-500 hover:text-slate-700"
        >
          Back to Sign In
        </button>
      </form>
    </div>
  );
}
