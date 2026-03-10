"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Users, Info, ArrowUpRight, Briefcase, Gavel, Activity, Layers, UserCheck, History, Trophy } from "lucide-react";
import AuctionTimer from "@/components/dashboard/AuctionTimer";
import { cn, getPlayerImage } from "@/lib/utils";
import { TeamNamePrompt } from "@/components/auction/TeamNamePrompt";

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [recentSignings, setRecentSignings] = useState<any[]>([]);
  const [mySquad, setMySquad] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        setProfile(profileData);

        // Fetch Recently Bought Players (Sold players, ordered by newest)
        const { data: soldPlayers } = await supabase
          .from("players")
          .select("*")
          .eq("status", "Sold")
          .order("created_at", { ascending: false })
          .limit(10);
        
        setRecentSignings(soldPlayers || []);

        // Fetch my squad (players sold to me)
        if (profileData?.team_name) {
          const { data: squad } = await supabase
            .from("players")
            .select("*")
            .eq("sold_to", profileData.team_name)
            .order("player_name", { ascending: true });
          setMySquad(squad || []);
        }
      }
      setLoading(false);
    };

    fetchData();

    // Subscribe to player updates for real-time signings
    const channel = supabase
      .channel('player-signings')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players' }, (payload) => {
        if (payload.new.status === 'Sold') {
          setRecentSignings(prev => [payload.new, ...prev.filter(p => p.id !== payload.new.id)].slice(0, 10));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="bg-[#FDFDFF] selection:bg-blue-100 font-sans text-slate-900 overflow-x-hidden min-h-[calc(100vh-64px)] pb-12">
      {/* 1. FRANCHISE TABLE COMMAND ROW */}
      <div className="w-full border-b border-slate-100 bg-white/50 backdrop-blur-sm px-6 md:px-12 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-30">
        <div className="flex items-center gap-4">
           <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse" />
           <p className="text-sm font-bold tracking-tight text-slate-400">
             Franchise Delegate: <span className="text-slate-900 font-black italic">{profile?.full_name || "Owner"}</span> 
           </p>
           <div className="h-4 w-[1px] bg-slate-200 hidden md:block" />
           <div className="hidden lg:flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Purse Status</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 px-2 py-0.5 bg-blue-50 rounded-md uppercase">Verified for Bidding</span>
           </div>
        </div>
        
        <div className="flex items-center gap-8">
           <AuctionTimer />
        </div>
      </div>

      <div className="w-full px-6 md:px-12 py-8 space-y-8">
        
        {/* Team Name Prompt */}
        {profile && (
          <TeamNamePrompt profile={profile} onUpdated={() => window.location.reload()} />
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
          
          {/* PURSE PANEL */}
          <div className="md:col-span-12 lg:col-span-4 space-y-8">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.03)] p-10 relative overflow-hidden group h-full flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                 <Briefcase size={120} />
              </div>
              
              <div className="relative z-10 flex flex-col gap-12">
                <div className="space-y-1">
                  <span className="text-[11px] font-black uppercase tracking-[0.3em] text-blue-600">Total Purse Available</span>
                  <h2 className="text-xl font-black tracking-tight text-slate-900 italic">Financial Cap Status</h2>
                </div>
                
                <div className="flex items-baseline gap-2">
                  <span className="text-8xl font-black tracking-tighter text-slate-900">{profile?.budget || 0}</span>
                  <span className="text-3xl font-black text-blue-600 italic">CR</span>
                </div>

                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100/50">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Squad Roster Capacity</span>
                  <span className="text-lg font-black text-slate-900 italic uppercase">0/25 <span className="text-[10px] text-slate-300 ml-1">PLAYERS ACQUIRED</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* RECENT ACQUISITIONS FEED */}
          <div className="md:col-span-12 lg:col-span-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col relative">
             <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/10">
                <div className="flex items-center gap-3">
                   <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                      <History size={16} />
                   </div>
                   <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5 block">Strategic Feed</span>
                      <h3 className="text-xl font-black italic uppercase tracking-tighter text-slate-900">Recent Signings Portfolio</h3>
                   </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 rounded-full">
                   <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                   <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Live Acquisition Updates</span>
                </div>
             </div>

             <div className="flex-1 min-h-[300px] flex flex-col overflow-y-auto max-h-[450px]">
                {recentSignings.length > 0 ? (
                   <div className="grid grid-cols-1 gap-px bg-slate-50">
                      {recentSignings.map((player) => (
                         <div key={player.id} className="bg-white p-6 flex items-center gap-6 hover:bg-slate-50/50 transition-colors animate-in fade-in slide-in-from-left-2 duration-500">
                            <div className="h-14 w-14 rounded-2xl bg-slate-50 overflow-hidden ring-2 ring-white shadow-sm flex items-center justify-center text-slate-300 shrink-0">
                               {player.image_url ? <img src={getPlayerImage(player.image_url)!} alt="" className="h-full w-full object-cover" /> : <Users size={24} />}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                               <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[11px] font-black text-blue-600 italic uppercase leading-none">{player.sold_to || player.team}</span>
                                  <div className="h-1 w-1 bg-slate-200 rounded-full" />
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Signed for {player.sold_price || player.price}</span>
                               </div>
                               <h4 className="text-lg font-black text-slate-900 italic uppercase truncate leading-none mb-1">{player.player_name}</h4>
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{player.role} • {player.country}</p>
                            </div>

                            <div className="text-right shrink-0">
                               <div className="flex flex-col items-end gap-1">
                                  <div className="h-8 w-8 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                                     <Trophy size={16} />
                                  </div>
                                  <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Hammer Down</span>
                               </div>
                            </div>
                         </div>
                      ))}
                   </div>
                ) : (
                   <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
                      <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 border border-dashed border-slate-200 mb-2">
                         <Gavel size={32} />
                      </div>
                      <div className="max-w-md space-y-2">
                         <h4 className="text-lg font-black italic uppercase text-slate-900 tracking-tight">Market Latency</h4>
                         <p className="text-slate-400 font-medium text-sm leading-relaxed px-10">
                           Strategic Notice: No acquisitions have been finalized in the current session. Monitor the bidding terminal for live signings.
                         </p>
                      </div>
                   </div>
                )}
             </div>

             <div className="p-4 bg-slate-900 text-white/50 border-t border-slate-800 flex justify-between items-center px-8 shrink-0">
                <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                   <Activity size={10} className="text-blue-400" />
                   Protocol: Real-time Signature Sync
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Auction Lifecycle 2026</span>
             </div>
          </div>
        </div>

        {/* 3. AUCTION ROOM UTILITIES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6 group cursor-help transition-all hover:shadow-md">
                <div className="h-16 w-16 bg-blue-50 rounded-[1.5rem] flex items-center justify-center text-blue-600 shadow-sm group-hover:scale-105 transition-transform">
                   <Gavel size={28} />
                </div>
                <div className="flex-1">
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1 underline decoration-slate-100">Auctioneer's Hammer</span>
                   <h3 className="text-2xl font-black text-slate-900 italic tracking-tight italic uppercase">Hammer Status: Idle</h3>
                   <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wide">Ready for Bidding War</p>
                </div>
                <ArrowUpRight size={16} className="text-slate-200 group-hover:text-blue-400" />
             </div>

             <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl shadow-slate-200 flex flex-col gap-6 relative overflow-hidden transition-all">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-white/10 rounded-xl flex items-center justify-center text-blue-400">
                     <Users size={24} />
                  </div>
                  <div className="relative z-10">
                     <span className="text-[10px] font-black uppercase tracking-widest text-white/30 block">My Squad</span>
                     <h3 className="text-xl font-black text-white italic tracking-tight uppercase">{mySquad.length} Players Signed</h3>
                  </div>
                </div>
                {mySquad.length > 0 ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {mySquad.map(p => (
                      <div key={p.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                        <div className="h-10 w-10 rounded-lg bg-white/10 overflow-hidden flex items-center justify-center text-white/30 shrink-0">
                          {p.image_url ? <img src={getPlayerImage(p.image_url)!} alt="" className="h-full w-full object-cover" /> : <Users size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-black text-white italic uppercase truncate block">{p.player_name}</span>
                          <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">{p.role} • {p.sold_price}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-1">
                    {[1,2,3,4,5,6,7].map(i => <div key={i} className="h-1.5 w-6 bg-white/10 rounded-full" />)}
                  </div>
                )}
             </div>
        </div>

      </div>
    </div>
  );
}
