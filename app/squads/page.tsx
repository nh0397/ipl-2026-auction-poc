"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Users, ArrowLeft, Briefcase, Activity } from "lucide-react";
import Link from "next/link";
import { cn, getPlayerImage } from "@/lib/utils";

export default function SquadsOverview() {
  const [teams, setTeams] = useState<any[]>([]);
  const [playersByTeam, setPlayersByTeam] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);

  const iplColors: Record<string, { bg: string, border: string, text: string }> = {
    CSK: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-800" },
    MI: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800" },
    RCB: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800" },
    KKR: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-800" },
    DC: { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-800" },
    GT: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800" },
    LSG: { bg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-800" },
    PBKS: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-800" },
    RR: { bg: "bg-pink-50", border: "border-pink-200", text: "text-pink-800" },
    SRH: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-800" }
  };

  const fetchTeamsAndSquads = async () => {
    setLoading(true);
    
    // 1. Fetch all franchise owners/admins
    const { data: teamProfiles } = await supabase
      .from("profiles")
      .select("*")
      .neq("role", "Viewer")
      .order("team_name", { ascending: true });

    if (!teamProfiles) {
      setLoading(false);
      return;
    }
    setTeams(teamProfiles);

    // 2. Fetch all sold players
    const { data: soldPlayers } = await supabase
      .from("players")
      .select("*")
      .eq("auction_status", "sold"); // Fixed: status -> auction_status and Sold -> sold based on admin/page.tsx
    
    // 3. Group players by team name
    const grouped: Record<string, any[]> = {};
    teamProfiles.forEach(t => {
      grouped[t.team_name || t.full_name] = [];
    });

    if (soldPlayers) {
      soldPlayers.forEach(p => {
        const teamKey = p.sold_to;
        if (teamKey && grouped[teamKey]) {
          grouped[teamKey].push(p);
        } else if (teamKey) {
           grouped[teamKey] = [p];
        }
      });
    }

    setPlayersByTeam(grouped);
    if (teamProfiles.length > 0 && !activeTeamId) {
      setActiveTeamId(teamProfiles[0].id);
    }
    
    const { data: conf } = await supabase.from("auction_config").select("*").single();
    setConfig(conf);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchTeamsAndSquads();

    // Set up Real-time subscriptions
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        () => fetchTeamsAndSquads()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => fetchTeamsAndSquads()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auction_config' },
        () => fetchTeamsAndSquads()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const calculateTeamStats = (teamName: string, initialBudgetStr: string) => {
    const squad = playersByTeam[teamName] || [];
    const playersBought = squad.length;
    const minPlayers = config?.min_players || 15;
    const maxPlayers = config?.max_players || 25;
    
    const minLeft = Math.max(0, minPlayers - playersBought);
    const maxLeft = Math.max(0, maxPlayers - playersBought);
    
    // Total purse is from their profile or config
    const totalPurse = parseFloat(initialBudgetStr) || parseFloat(config?.budget_per_team) || 100;
    
    const totalUsed = squad.reduce((acc, player) => {
       const priceStr = player.sold_price || "0";
       const priceNum = parseFloat(priceStr.replace(/[^\d.]/g, '')) || 0;
       return acc + priceNum;
    }, 0);
    
    const spentPerPlayer = playersBought > 0 ? (totalUsed / playersBought) : 0;
    const purseLeft = totalPurse - totalUsed;
    
    return {
      playersBought,
      minLeft,
      maxLeft,
      totalPurse: totalPurse.toFixed(2),
      totalUsed: totalUsed.toFixed(2),
      spentPerPlayer: spentPerPlayer.toFixed(2),
      purseLeft: purseLeft.toFixed(2)
    };
  };

  const activeTeam = teams.find(t => t.id === activeTeamId);
  const teamName = activeTeam?.team_name || activeTeam?.full_name;
  const activeSquad = playersByTeam[teamName] || [];

  const batters = activeSquad.filter(p => p.role?.toLowerCase().includes('batter') || p.role?.toLowerCase().includes('wk')).length;
  const bowlers = activeSquad.filter(p => p.role?.toLowerCase().includes('bowler')).length;
  const allRounders = activeSquad.filter(p => p.role?.toLowerCase().includes('all-rounder')).length;

  const currentStats = activeTeam ? calculateTeamStats(teamName, activeTeam.budget) : null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 leading-normal p-4 md:p-8 pt-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
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
                <Users className="h-7 w-7 text-blue-600" />
                Franchise Squads
              </h1>
              <p className="text-slate-500 font-medium tracking-tight">View live roster composition of all participating teams</p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-2">IPL Team Legend:</span>
          {Object.entries(iplColors).map(([team, colors]) => (
             <div key={team} className={cn("px-2 py-1 flex items-center gap-1.5 rounded-lg border", colors.bg, colors.border)}>
                <div className={cn("text-[9px] font-black uppercase tracking-widest", colors.text)}>{team}</div>
             </div>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* Sidebar - Teams List */}
          <div className="w-full lg:w-80 shrink-0 flex flex-col gap-2">
            {loading ? (
              <div className="p-12 text-center text-slate-400 font-black uppercase tracking-widest animate-pulse">
                Loading teams...
              </div>
            ) : teams.map(team => (
              <button
                key={team.id}
                onClick={() => setActiveTeamId(team.id)}
                className={cn(
                  "p-5 rounded-2xl border text-left transition-all relative overflow-hidden group",
                  activeTeamId === team.id 
                    ? "bg-slate-900 border-slate-800 text-white shadow-xl scale-[1.02]" 
                    : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                )}
              >
                {activeTeamId === team.id && (
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Briefcase size={60} />
                  </div>
                )}
                <div className="relative z-10">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1 flex justify-between items-center">
                    {team.full_name}
                    {activeTeamId === team.id && <Activity className="text-emerald-400 h-3 w-3" />}
                  </div>
                  <div className={cn(
                    "text-lg font-black uppercase tracking-tighter leading-none mb-3",
                    activeTeamId === team.id ? "text-white" : "text-slate-900"
                  )}>
                    {team.team_name || team.full_name}
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="flex flex-col">
                       <span className={cn("text-[9px] font-black uppercase tracking-widest", activeTeamId === team.id ? "text-slate-400" : "text-slate-300")}>Purse</span>
                       <span className={cn("text-base font-black italic", activeTeamId === team.id ? "text-emerald-400" : "text-slate-600")}>{team.budget} Cr</span>
                    </div>
                    <div className="flex flex-col">
                       <span className={cn("text-[9px] font-black uppercase tracking-widest", activeTeamId === team.id ? "text-slate-400" : "text-slate-300")}>Players</span>
                       <span className={cn("text-base font-black italic", activeTeamId === team.id ? "text-blue-400" : "text-slate-600")}>{(playersByTeam[team.team_name || team.full_name] || []).length} / {(config?.max_players || 25)}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Main Content - Active Squad Table */}
          <div className="flex-1 w-full bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
            {!activeTeam || !currentStats ? (
              <div className="flex-1 flex items-center justify-center p-12 text-center text-slate-400 font-black uppercase tracking-widest">
                Select a franchise to view their squad
              </div>
            ) : (
               <>
                 {/* Header Stats */}
                 <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                    <div>
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Live Roster For</span>
                       <h2 className="text-4xl font-black italic uppercase tracking-tighter text-slate-900">{teamName}</h2>
                       <div className="text-xs font-bold text-slate-500 tracking-widest mt-1 uppercase">{activeTeam.full_name}</div>
                    </div>
                    
                    <div className="flex flex-wrap gap-3">
                        <div className="p-3 bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center min-w-[80px]">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Bat/WK</span>
                          <span className="text-xl font-black text-slate-800">{batters}</span>
                        </div>
                        <div className="p-3 bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center min-w-[80px]">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Bowl</span>
                          <span className="text-xl font-black text-slate-800">{bowlers}</span>
                        </div>
                        <div className="p-3 bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center min-w-[80px]">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">All-R</span>
                          <span className="text-xl font-black text-slate-800">{allRounders}</span>
                        </div>
                    </div>
                 </div>

                 {/* Table */}
                 <div className="flex-1 overflow-x-auto p-6 md:p-8">
                   {activeSquad.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-center text-slate-400 font-black uppercase tracking-widest bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                         No players acquired yet
                      </div>
                   ) : (
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-widest">Player Name</th>
                              <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-widest text-center">Country / Type</th>
                              <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-widest text-center">Role</th>
                              <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-widest text-right">Sold For</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeSquad.map(player => {
                               const teamStyle = iplColors[player.team] || { bg: "bg-white", border: "border-slate-100", text: "text-slate-600" };
                               return (
                                 <tr key={player.id} className={cn("border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors", teamStyle.bg)}>
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 shrink-0 bg-white rounded-lg overflow-hidden border border-slate-200">
                                           {player.image_url ? <img src={getPlayerImage(player.image_url)!} alt="" className="w-full h-full object-cover object-top" /> : <Users size={20} className="m-auto opacity-20 mt-2" />}
                                        </div>
                                        <span className="font-bold text-slate-900">{player.player_name}</span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <div className="flex flex-col items-center">
                                        <span className="text-sm font-semibold text-slate-700">{player.type === 'Overseas' ? 'Foreign' : 'Indian'}</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{player.country}</span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <span className={cn("text-xs font-black uppercase tracking-widest bg-white/60 px-2 py-1 rounded", teamStyle.text)}>
                                        {player.role}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <span className="text-lg font-black text-slate-900 bg-white/50 px-3 py-1.5 rounded-lg shadow-sm">
                                        {player.sold_price?.replace(' Cr', '')} <span className="text-xs text-slate-500 font-bold">CR</span>
                                      </span>
                                    </td>
                                 </tr>
                               );
                            })}
                          </tbody>
                        </table>
                      </div>
                   )}

                   {/* Team Roster Summary Stats */}
                   <div className="mt-8 bg-slate-50 rounded-2xl border border-slate-200 p-6">
                      <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Financial & Roster Summary</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                         
                         <div className="p-3 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Bought</span>
                           <span className="text-xl font-black text-blue-600">{currentStats.playersBought}</span>
                         </div>
                         
                         <div className="p-3 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Min Left</span>
                           <span className="text-xl font-black text-amber-500">{currentStats.minLeft}</span>
                         </div>
                         
                         <div className="p-3 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Max Left</span>
                           <span className="text-xl font-black text-slate-700">{currentStats.maxLeft}</span>
                         </div>
                         
                         <div className="p-3 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Purse</span>
                           <span className="text-lg font-black text-slate-900">{currentStats.totalPurse}</span>
                         </div>

                         <div className="p-3 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Used</span>
                           <span className="text-lg font-black text-rose-600">{currentStats.totalUsed}</span>
                         </div>

                         <div className="p-3 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Spent/Player</span>
                           <span className="text-lg font-black text-slate-600">{currentStats.spentPerPlayer}</span>
                         </div>

                         <div className="p-3 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm bg-emerald-50/50 border-emerald-100">
                           <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block mb-1">Purse Left</span>
                           <span className="text-xl font-black text-emerald-600">{currentStats.purseLeft}</span>
                         </div>

                      </div>
                   </div>

                 </div>
               </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
