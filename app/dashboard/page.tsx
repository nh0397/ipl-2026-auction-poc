"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Users, Info, ArrowUpRight, Briefcase, Gavel, Activity, Layers, UserCheck, History, Trophy, Zap } from "lucide-react";
import AuctionTimer from "@/components/dashboard/AuctionTimer";
import { cn, getPlayerImage, iplColors } from "@/lib/utils";
import { TeamNamePrompt } from "@/components/auction/TeamNamePrompt";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [recentSignings, setRecentSignings] = useState<any[]>([]);
  const [mySquad, setMySquad] = useState<any[]>([]);
  const [auctionConfig, setAuctionConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();
          setProfile(profileData);

          const { data: configData } = await supabase
            .from("auction_config")
            .select("*")
            .limit(1)
            .single();
          setAuctionConfig(configData);

          // Fetch Recently Bought Players (Sold players, ordered by newest)
          const { data: soldPlayers } = await supabase
            .from("players")
            .select("*")
            .eq("status", "Sold")
            .order("created_at", { ascending: false })
            .limit(10);
          
          setRecentSignings(soldPlayers || []);

          // Fetch my squad (players sold to me or my team name)
          const { data: squad } = await supabase
            .from("players")
            .select("*")
            .or(`sold_to_id.eq.${session.user.id},sold_to.eq."${profileData.team_name}"`)
            .order("player_name", { ascending: true });
          setMySquad(squad || []);

          // Subscriptions
          const channel = supabase
            .channel('dashboard-updates')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players' }, (payload) => {
              if (payload.new.status === 'Sold') {
                setRecentSignings(prev => [payload.new, ...prev.filter(p => p.id !== payload.new.id)].slice(0, 10));
              }
              if (payload.new.sold_to_id === session.user.id || payload.old.sold_to_id === session.user.id || 
                  payload.new.sold_to === profileData.team_name || payload.old.sold_to === profileData.team_name) {
                supabase.from("players")
                  .select("*")
                  .or(`sold_to_id.eq.${session.user.id},sold_to.eq."${profileData.team_name}"`)
                  .order("player_name", { ascending: true })
                  .then(({ data }) => setMySquad(data || []));
              }
            })
            .subscribe();

          return () => {
            supabase.removeChannel(channel);
          };
        } else {
          // Only redirect if we've checked and there's definitely no session
          router.replace("/");
        }
      } catch (err) {
        console.error("Dashboard Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
           <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Synchronizing Portfolio...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const squadSize = mySquad.length;
  const minPlayers = auctionConfig?.min_players ?? 18;
  const maxPlayers = auctionConfig?.max_players ?? 25;

  const initialBudget = auctionConfig?.budget_per_team || 150;
  const totalSpent = mySquad.reduce((sum, p) => {
    const priceStr = p.sold_price || "0";
    const priceValue = typeof priceStr === 'string' 
      ? parseFloat(priceStr.replace(/[^\d.]/g, '')) 
      : (typeof priceStr === 'number' ? priceStr : 0);
    return sum + (isNaN(priceValue) ? 0 : priceValue);
  }, 0);

  const remainingPurse = initialBudget - totalSpent;

  const isMinMet = squadSize >= minPlayers;
  const isMaxMet = squadSize <= maxPlayers;

  const batters = mySquad.filter(p => (p.role || '').toLowerCase().includes('batter') || (p.role || '').toLowerCase().includes('wk')).length;
  const bowlers = mySquad.filter(p => (p.role || '').toLowerCase().includes('bowler')).length;
  const allRounders = mySquad.filter(p => (p.role || '').toLowerCase().includes('all-rounder')).length;
  const indian = mySquad.filter(p => (p.type || '').toLowerCase() === 'indian').length;
  const overseas = mySquad.filter(p => (p.type || '').toLowerCase() === 'overseas').length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 leading-normal overflow-hidden pt-8 min-h-[calc(100vh-64px)] pb-12">
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
                  <span className="text-[11px] font-black uppercase tracking-[0.3em] text-blue-600">Purse Remaining</span>
                  <h2 className="text-xl font-black tracking-tight text-slate-900 italic">Financial Cap Status</h2>
                </div>
                
                <div className="flex items-baseline gap-2">
                  <span className="text-7xl lg:text-8xl font-black tracking-tighter text-slate-900">{remainingPurse.toFixed(2)}</span>
                  <span className="text-3xl font-black text-blue-600 italic">CR</span>
                </div>

                <div className="space-y-3">
                  <div className={cn(
                    "p-4 rounded-2xl border flex justify-between items-center transition-colors",
                    isMinMet ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-200"
                  )}>
                    <span className={cn("text-[10px] font-black uppercase tracking-widest block", isMinMet ? "text-emerald-600" : "text-red-500")}>
                      Squad Capacity
                    </span>
                    <span className={cn("text-lg font-black italic uppercase", isMinMet ? "text-emerald-900" : "text-red-700")}>
                      {squadSize} / {maxPlayers} <span className="text-[10px] ml-1 opacity-70">PLAYERS (MIN {minPlayers})</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Batters/WK</span>
                      <span className="text-xl font-black text-slate-800">{batters}</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Bowlers</span>
                      <span className="text-xl font-black text-slate-800">{bowlers}</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">All-Rounders</span>
                      <span className="text-xl font-black text-slate-800">{allRounders}</span>
                    </div>
                    <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100 flex flex-col items-center justify-center">
                      <span className="text-[10px] font-black uppercase text-blue-500 tracking-widest">IND <span className="text-slate-300">|</span> OS</span>
                      <span className="text-xl font-black text-blue-900">{indian} <span className="text-lg opacity-50 font-medium">| {overseas}</span></span>
                    </div>
                  </div>
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
                      {recentSignings.map((player) => {
                          const teamStyle = iplColors[player.team] || { bg: "bg-slate-50", border: "border-slate-100", text: "text-slate-600" };
                          return (
                          <div key={player.id} className={cn("p-6 flex items-center gap-6 transition-colors animate-in fade-in slide-in-from-left-2 duration-500 relative overflow-hidden group border-b", teamStyle.bg, teamStyle.border)}>
                             <div className="absolute top-0 right-0 p-3 opacity-5 font-black text-6xl transform translate-x-1/4 -translate-y-1/4 pointer-events-none">
                                {player.team}
                             </div>
                             <div className="h-14 w-14 rounded-2xl bg-slate-50 overflow-hidden ring-2 ring-white shadow-sm flex items-center justify-center text-slate-300 shrink-0 relative z-10">
                               {player.image_url ? <img src={getPlayerImage(player.image_url)!} alt="" className="h-full w-full object-cover" /> : <Users size={24} />}
                            </div>
                            
                            <div className="flex-1 min-w-0 relative z-10">
                               <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[11px] font-black text-blue-600 italic uppercase leading-none">{player.sold_to || player.team}</span>
                                  <div className="h-1 w-1 bg-slate-200 rounded-full" />
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Signed for {player.sold_price || player.price}</span>
                               </div>
                               <h4 className="text-lg font-black text-slate-900 italic uppercase truncate leading-none mb-1">{player.player_name}</h4>
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{player.role} • {player.country}</p>
                            </div>

                            <div className="text-right shrink-0 relative z-10">
                               <div className="flex flex-col items-end gap-1">
                                  <div className="h-8 w-8 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                                     <Trophy size={16} />
                                  </div>
                                  <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Hammer Down</span>
                                </div>
                             </div>
                          </div>
                       )})}
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

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center mt-auto">
                 <Link href="/history" className="text-xs font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1">
                   View Complete Auction History <ArrowUpRight size={14} />
                 </Link>
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

        {/* 3. CHAMPIONSHIP COMMAND CENTER */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
             <Link 
               href="/scoreboard"
               className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100 flex items-center gap-6 group hover:scale-[1.02] transition-all"
             >
                <div className="h-16 w-16 bg-white/10 rounded-[1.5rem] flex items-center justify-center text-white shadow-sm group-hover:bg-amber-500 transition-colors">
                   <Trophy size={28} className="fill-current" />
                </div>
                <div className="flex-1">
                   <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 block mb-1">Match Day Hub</span>
                   <h3 className="text-2xl font-black italic tracking-tight uppercase">Scoreboard Hub</h3>
                   <p className="text-xs font-bold text-indigo-200 mt-1 uppercase tracking-wide">Points, Strategy & Standings</p>
                </div>
                <ArrowUpRight size={20} className="text-white/30 group-hover:text-white" />
             </Link>

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
                  <div className="max-h-[300px] overflow-y-auto bg-white rounded-xl overflow-hidden mt-4">
                    <table className="w-full text-left border-collapse min-w-max">
                      <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-500 tracking-widest sticky top-0 z-20">
                        <tr>
                          <th className="px-3 py-2">Player</th>
                          <th className="px-3 py-2 text-center">Team & Role</th>
                          <th className="px-3 py-2 text-right">Bid</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {mySquad.map(p => {
                          const teamStyle = iplColors[p.team] || { bg: "bg-white", border: "border-slate-100", text: "text-slate-600" };
                          return (
                          <tr key={p.id} className={cn("border-b last:border-0", teamStyle.bg)}>
                            <td className="px-3 py-2 flex items-center gap-2">
                              <div className="h-6 w-6 rounded flex items-center justify-center bg-white/50 shrink-0">
                                {p.image_url ? <img src={getPlayerImage(p.image_url)!} alt="" className="h-full w-full object-cover rounded" /> : <Users size={12} />}
                              </div>
                              <span className="font-bold text-slate-900 truncate max-w-[120px]" title={p.player_name}>{p.player_name}</span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex flex-col items-center">
                                <span className={cn("text-[9px] font-black uppercase tracking-widest bg-white/50 px-1 py-0.5 rounded", teamStyle.text)}>{p.team}</span>
                                <span className="text-[10px] font-semibold text-slate-600 truncate">{p.role}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-black text-slate-900">
                               {p.sold_price?.replace(' Cr', '')} <span className="text-[10px] text-slate-500 font-bold">CR</span>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex gap-1 justify-center py-4 opacity-20">
                    {[1,2,3,4,5,6,7].map(i => <div key={i} className="h-1.5 w-6 bg-white/10 rounded-full" />)}
                  </div>
                )}
             </div>
        </div>
      </div>
    </div>
  );
}
