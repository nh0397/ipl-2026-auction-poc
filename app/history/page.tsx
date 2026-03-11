"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { History, ArrowLeft, Trophy } from "lucide-react";
import Link from "next/link";
import { getPlayerImage, cn, iplColors } from "@/lib/utils";

export default function AuctionHistory() {
  const [soldPlayers, setSoldPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("players")
        .select("*")
        .eq("status", "Sold")
        .order("created_at", { ascending: false });
      
      if (data) setSoldPlayers(data);
      setLoading(false);
    };

    fetchHistory();

    // Real-time
    const channel = supabase
      .channel('history-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players' }, (payload) => {
        if (payload.new.status === 'Sold') {
          setSoldPlayers(prev => [payload.new, ...prev.filter(p => p.id !== payload.new.id)]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 leading-normal p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link 
                href="/dashboard" 
                className="h-10 w-10 border-2 border-slate-200 rounded-full flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm bg-white"
            >
                <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-2">
                <History className="h-7 w-7 text-blue-600" />
                Complete History
              </h1>
              <p className="text-slate-500 font-medium tracking-tight">Chronological record of all players acquired</p>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
          <div className="p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-white">
            <div className="text-sm font-black uppercase tracking-widest text-slate-400">Total Players Sold: <span className="text-white">{soldPlayers.length}</span></div>
          </div>

          <div className="flex flex-col">
            {loading ? (
              <div className="p-12 text-center text-slate-400 font-black uppercase tracking-widest animate-pulse">
                Loading history...
              </div>
            ) : soldPlayers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-black uppercase tracking-widest">
                No players have been sold yet
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {soldPlayers.map((player) => {
                  const teamStyle = iplColors[player.team] || { bg: "bg-slate-50", border: "border-slate-100", text: "text-slate-600" };
                  return (
                  <div key={player.id} className={cn("p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors group relative overflow-hidden", teamStyle.bg, teamStyle.border)}>
                    <div className="absolute top-0 right-0 p-3 opacity-5 font-black text-6xl transform translate-x-1/4 -translate-y-1/4 pointer-events-none">
                       {player.team}
                    </div>
                    <div className="flex items-center gap-6 relative z-10">
                      <div className="relative shrink-0">
                        <div className="h-16 w-16 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 p-1">
                          <img src={getPlayerImage(player.image_url) || undefined} alt="" className="w-full h-full object-cover object-top rounded-xl" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full border-2 border-white shadow-sm">
                          {player.type === "Overseas" ? "OS" : "IND"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">
                          {player.sold_to}
                        </div>
                        <div className="text-xl font-black uppercase tracking-tighter text-slate-900 leading-none mb-1">
                          {player.player_name}
                        </div>
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                          {player.role}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-start sm:items-end bg-white/60 sm:bg-transparent p-3 sm:p-0 rounded-xl relative z-10">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                        Sold Price
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black tracking-tighter text-slate-900">
                           {player.sold_price?.replace(' Cr', '') || '0'}
                        </span>
                        <span className="text-sm font-black italic text-slate-600">CR</span>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
