"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Trophy, LayoutDashboard, ShieldCheck, LogOut, BookOpen, ChevronDown, User, Activity, Gavel, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
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

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      subscription.unsubscribe();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem("auth_approved");
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (!user) return null;

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/90 backdrop-blur-xl">
      <div className="w-full px-6 md:px-12 h-16 flex items-center justify-between">
        
        {/* LEFT: Branding */}
        <div className="flex items-center gap-10">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="h-9 w-9 bg-slate-900 rounded-xl flex items-center justify-center transition-all group-hover:rotate-6 group-hover:scale-105 shadow-sm">
              <Gavel className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-black uppercase tracking-tighter text-lg text-slate-900">
                IPL Auction<span className="text-blue-600">Hub</span>
              </span>
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-300 mt-0.5">Franchise Portal 2026</span>
            </div>
          </Link>

          {/* MAIN NAV */}
          <div className="hidden md:flex items-center gap-1">
            <Link 
              href="/dashboard" 
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                pathname === "/dashboard" ? "text-blue-600 bg-blue-50/50" : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <LayoutDashboard size={16} />
              Strategic Table
            </Link>

            <Link 
              href="/registry" 
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                pathname === "/registry" ? "text-blue-600 bg-blue-50/50" : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <Search size={16} />
              The Registry
            </Link>

            <Link 
              href="/rules" 
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                pathname === "/rules" ? "text-blue-600 bg-blue-50/50" : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <BookOpen size={16} />
              Auction Rules
            </Link>
          </div>
        </div>

        {/* RIGHT: User Profile Dropdown */}
        <div className="flex items-center gap-6" ref={dropdownRef}>
          <div className="relative">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={cn(
                "flex items-center gap-3 p-1 rounded-full transition-all border border-transparent",
                isDropdownOpen ? "bg-slate-100 border-slate-200" : "hover:bg-slate-50 hover:border-slate-100"
              )}
            >
              <div className="h-9 w-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-md shadow-blue-100 ring-2 ring-white">
                 {user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:flex flex-col items-start mr-1 text-left">
                <span className="text-sm font-bold text-slate-900 leading-none mb-1">
                  {user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0]}
                </span>
                <div className="flex items-center gap-1">
                   <div className="h-1 w-1 bg-emerald-500 rounded-full animate-pulse" />
                   <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none">In Room</span>
                </div>
              </div>
              <ChevronDown size={14} className={cn("text-slate-300 transition-transform mr-1", isDropdownOpen && "rotate-180")} />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-3 w-64 bg-white rounded-[1.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 py-2.5 z-[60] animate-in fade-in zoom-in-95 duration-200">
                <div className="px-5 py-4 mb-2 border-b border-slate-50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{role === 'Admin' ? 'Auction Council' : 'Franchise Owner'}</span>
                    <Activity size={12} className="text-emerald-500" />
                  </div>
                  <p className="text-sm font-bold text-slate-900 truncate">{user.email}</p>
                </div>
                
                <div className="px-2 space-y-0.5">
                  {role === "Admin" && (
                    <Link 
                      href="/admin" 
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-blue-50/50 hover:text-blue-600 rounded-xl transition-colors"
                    >
                      <ShieldCheck size={18} className="text-blue-600" />
                      Auction Command
                    </Link>
                  )}
                  
                  <Link 
                    href="/dashboard" 
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
                  >
                    <User size={18} className="text-slate-400" />
                    Squad Portfolio
                  </Link>

                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors mt-2 border-t border-slate-50 pt-3"
                  >
                    <LogOut size={18} />
                    Leave Room
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
