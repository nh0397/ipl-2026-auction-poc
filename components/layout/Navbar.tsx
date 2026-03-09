"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Trophy, LayoutDashboard, ShieldCheck, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", currentUser.id)
          .single();
        setRole(profile?.role || "Participant");
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        supabase
          .from("profiles")
          .select("role")
          .eq("id", currentUser.id)
          .single()
          .then(({ data }) => setRole(data?.role || "Participant"));
      } else {
        setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (!user) return null;

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <span className="font-black uppercase tracking-tighter text-lg bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              Auction POC
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <Link 
              href="/dashboard" 
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                pathname === "/dashboard" ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>

            <Link 
              href="/rules" 
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                pathname === "/rules" ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <Trophy className="h-4 w-4" />
              Rules
            </Link>
            
            {role === "Admin" && (
              <Link 
                href="/admin" 
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                  pathname === "/admin" ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-50"
                )}
              >
                <ShieldCheck className="h-4 w-4" />
                Admin Panel
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-black uppercase text-slate-400 tracking-widest">{role}</span>
            <span className="text-sm font-bold text-slate-700 truncate max-w-[150px]">
              {user.user_metadata?.full_name || user.email}
            </span>
          </div>
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleLogout}
            className="rounded-full hover:bg-red-50 hover:text-red-600 text-slate-400 h-10 w-10 transition-colors"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
