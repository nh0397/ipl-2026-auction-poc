"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, BookOpen, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Live Auction", href: "/auction", icon: Trophy },
  { name: "Rulebook", href: "/rules", icon: BookOpen },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 font-sans">
      <div className="container flex h-16 items-center px-8 mx-auto max-w-6xl">
        <div className="mr-8 flex items-center space-x-2">
          <Trophy className="h-6 w-6 text-blue-600" />
          <span className="text-xl font-bold tracking-tight">IPL 2026 Admin</span>
        </div>
        <div className="flex h-full items-center space-x-6 text-sm font-medium">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center space-x-2 transition-colors hover:text-blue-600",
                pathname === item.href ? "text-blue-600 border-b-2 border-blue-600 h-full flex items-center pt-0.5" : "text-slate-600"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.name}</span>
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center space-x-4">
          <div className="h-8 w-8 rounded-full bg-slate-200" />
        </div>
      </div>
    </nav>
  );
}
