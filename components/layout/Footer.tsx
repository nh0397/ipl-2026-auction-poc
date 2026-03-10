"use client";

import Link from "next/link";
import { Gavel } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-white border-t border-slate-100 py-4 px-6 md:px-12">
      <div className="w-full flex flex-col md:flex-row justify-between items-center gap-6">
        
        {/* BRAND */}
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 bg-slate-900 rounded-lg flex items-center justify-center shadow-sm">
            <Gavel className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-black uppercase tracking-tighter text-base text-slate-900">
            Auction<span className="text-blue-600">Hub</span>
          </span>
        </div>

        {/* SUPPORT / CONTACT */}
        <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
          <span>Support:</span>
          <a 
            href="mailto:jalan.me4u@gmail.com" 
            className="text-blue-600 hover:underline decoration-blue-600/30 underline-offset-4"
          >
            Prashant Jalan
          </a>
        </div>

        {/* COPYRIGHT */}
        <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1">
          <span>©</span>
          <span>{currentYear} AUCTIONHUB COUNCIL</span>
        </div>

      </div>
    </footer>
  );
}
