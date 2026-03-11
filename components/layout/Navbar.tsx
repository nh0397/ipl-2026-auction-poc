"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LayoutDashboard, ShieldCheck, LogOut, BookOpen, ChevronDown, User, Activity, Gavel, Search, Menu, X, Users, History } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
        setRole(profile?.role || null);
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
          .then(({ data }) => setRole(data?.role || null));
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

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    localStorage.removeItem("auth_approved");
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (!user) return null;

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/registry", label: "Player Pool", icon: Search },
    { href: "/squads", label: "Team Rosters", icon: Users },
    { href: "/auction", label: "Live Auction", icon: Gavel },
    { href: "/history", label: "Auction History", icon: History },
    { href: "/rules", label: "Rulebook", icon: BookOpen },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/90 backdrop-blur-xl">
      <div className="w-full px-4 sm:px-6 md:px-12 h-14 md:h-16 flex items-center justify-between">
        
        {/* LEFT: Branding + Mobile Menu Button */}
        <div className="flex items-center gap-3 md:gap-10">
          {/* Mobile hamburger */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {isMobileMenuOpen
              ? <X size={20} className="text-slate-600" />
              : <Menu size={20} className="text-slate-600" />
            }
          </button>

          <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3 group">
            <div className="h-8 w-8 md:h-9 md:w-9 bg-slate-900 rounded-xl flex items-center justify-center transition-all group-hover:rotate-6 group-hover:scale-105 shadow-sm">
              <Gavel className="h-4 w-4 md:h-5 md:w-5 text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-black uppercase tracking-tighter text-base md:text-lg text-slate-900">
                IPL Auction<span className="text-blue-600">Hub</span>
              </span>
              <span className="text-[7px] md:text-[8px] font-black uppercase tracking-[0.3em] text-slate-300 mt-0.5 hidden sm:block">Franchise Portal 2026</span>
            </div>
          </Link>

          {/* Desktop NAV */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                  pathname === link.href ? "text-blue-600 bg-blue-50/50" : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <link.icon size={16} />
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* RIGHT: User Profile Dropdown */}
        <div className="flex items-center gap-3 md:gap-6" ref={dropdownRef}>
          <div className="relative">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={cn(
                "flex items-center gap-2 sm:gap-3 p-1 rounded-full transition-all border border-transparent",
                isDropdownOpen ? "bg-slate-100 border-slate-200" : "hover:bg-slate-50 hover:border-slate-100"
              )}
            >
              <div className="h-8 w-8 md:h-9 md:w-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm md:text-base font-bold shadow-md shadow-blue-100 ring-2 ring-white">
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
              <ChevronDown size={14} className={cn("text-slate-300 transition-transform mr-1 hidden sm:block", isDropdownOpen && "rotate-180")} />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-3 w-64 bg-white rounded-[1.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 py-2.5 z-[60] animate-in fade-in zoom-in-95 duration-200">
                <div className="px-5 py-4 mb-2 border-b border-slate-50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                      {role === 'Admin' ? 'Auction Council' : role === 'Participant' ? 'Franchise Owner' : 'Spectator'}
                    </span>
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

      {/* Mobile Nav Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white/95 backdrop-blur-xl px-4 py-3 space-y-1">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                pathname === link.href ? "text-blue-600 bg-blue-50" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <link.icon size={18} />
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
