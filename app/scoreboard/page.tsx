"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Trophy, Medal, Shield, Zap, Star, Activity, 
  ChevronRight, Lock, History, AlertCircle, TrendingUp,
  Calculator, Save, RefreshCw, ChevronLeft, Search, Clock,
  Users, User, Download
} from "lucide-react";
import { cn, getPlayerImage, iplColors } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { calculateDream11Points, MatchStats } from "@/lib/scoring";

export default function ScoreboardPage() {
  const [profile, setProfile] = useState<any>(null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [allMatches, setAllMatches] = useState<any[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [matchPoints, setMatchPoints] = useState<Record<string, number>>({});
  const [allNominations, setAllNominations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cvcChangesUsed, setCvcChangesUsed] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"sheet" | "others" | "standings">("sheet");
  const [selectedTeammateId, setSelectedTeammateId] = useState<string | null>(null);
  const [standings, setStandings] = useState<any[]>([]);

  // Calculator State
  const [calcStats, setCalcStats] = useState<Partial<MatchStats>>({
    runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, catches: 0, 
    stumpings: 0, lbwBowled: 0, maidens: 0, isDuck: false, role: 'Batter'
  });
  const [calcActivePlayerId, setCalcActivePlayerId] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedMatchId) {
      fetchMatchSpecificData(selectedMatchId);
    }
  }, [selectedMatchId]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      // 1. Profile
      if (session) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        setProfile(profileData);
        setCvcChangesUsed(profileData?.cvc_changes_used || 0);
      }

      // 2. All Franchises (Teammates)
      const { data: teamsDataRaw } = await supabase
        .from("profiles")
        .select("*")
        .neq("role", "Viewer")
        .order("team_name", { ascending: true });
      
      const teamsData = teamsDataRaw || [];
      setFranchises(teamsData);

      // Default teammate tab to the first teammate
      if (session && teamsData.length > 0) {
        const firstTeammate = teamsData.find(t => t.id !== session.user.id);
        if (firstTeammate) setSelectedTeammateId(firstTeammate.id);
      }

      // 3. All Sold Players
      const { data: playersData } = await supabase
        .from("players")
        .select("*")
        .eq("auction_status", "sold")
        .order("player_name", { ascending: true });
      setAllPlayers(playersData || []);

      // 4. All Matches
      const { data: matchesData } = await supabase
        .from("matches")
        .select("*")
        .order("match_no", { ascending: true });
      
      if (matchesData) {
        setAllMatches(matchesData);
        const nextMatch = matchesData.find(m => !m.is_locked) || matchesData[0];
        if (nextMatch) setSelectedMatchId(nextMatch.id);
      }
    } catch (error) {
      console.error("Error fetching scoreboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchSpecificData = async (matchId: string) => {
    // 1. All Nominations for this match
    const { data: nomsData } = await supabase
      .from("nominations")
      .select("*")
      .eq("match_id", matchId);
    setAllNominations(nomsData || []);

    // 2. All Points recorded for this match
    const { data: pointsData } = await supabase
      .from("match_points")
      .select("*")
      .eq("match_id", matchId);
    
    const pointsMap: Record<string, number> = {};
    pointsData?.forEach(p => {
      pointsMap[p.player_id] = p.points;
    });
    setMatchPoints(pointsMap);
  };

  const updatePoint = (playerId: string, val: string) => {
    const num = parseFloat(val) || 0;
    setMatchPoints(prev => ({ ...prev, [playerId]: num }));
  };

  const updateNomination = async (type: 'captain' | 'vc', playerId: string) => {
    if (!profile || !selectedMatchId) return;
    
    const selectedMatch = allMatches.find(m => m.id === selectedMatchId);
    if (selectedMatch?.is_locked) {
      alert("This match is locked.");
      return;
    }

    const currentNom = allNominations.find(n => n.team_id === profile.id);
    const isChange = (type === 'captain' && currentNom?.captain_id !== playerId) ||
                     (type === 'vc' && currentNom?.vc_id !== playerId);
    
    if (isChange && cvcChangesUsed >= 4) {
      alert("Season limit of 4 C/VC changes reached!");
      return;
    }

    setSaving(true);
    const updates: any = {
      team_id: profile.id,
      match_id: selectedMatchId,
      [type === 'captain' ? 'captain_id' : 'vc_id']: playerId
    };

    const { error } = await supabase
      .from("nominations")
      .upsert(updates, { onConflict: "team_id,match_id" });

    if (!error && isChange) {
      await supabase
        .from("profiles")
        .update({ cvc_changes_used: cvcChangesUsed + 1 })
        .eq("id", profile.id);
      setCvcChangesUsed(cvcChangesUsed + 1);
    }

    if (error) alert(error.message);
    else await fetchMatchSpecificData(selectedMatchId);
    setSaving(false);
  };

  const updateBooster = async (boosterId: string) => {
    if (!profile || !selectedMatchId) return;
    const selectedMatch = allMatches.find(m => m.id === selectedMatchId);
    if (selectedMatch?.is_locked) {
      alert("This match is locked.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("nominations")
      .upsert({
        team_id: profile.id,
        match_id: selectedMatchId,
        booster_id: boosterId
      }, { onConflict: "team_id,match_id" });

    if (error) alert(error.message);
    else await fetchMatchSpecificData(selectedMatchId);
    setSaving(false);
  };

  const saveAllMyPoints = async () => {
    if (!selectedMatchId || !profile) return;
    setSaving(true);

    const mySquadIds = allPlayers.filter(p => p.sold_to_id === profile.id).map(p => p.id);
    const updates = Object.entries(matchPoints)
      .filter(([playerId]) => mySquadIds.includes(playerId))
      .map(([playerId, points]) => ({
        match_id: selectedMatchId,
        player_id: playerId,
        points: points
      }));

    if (updates.length > 0) {
      const { error } = await supabase
        .from("match_points")
        .upsert(updates, { onConflict: "player_id,match_id" });

      if (error) alert("Error saving: " + error.message);
      else alert("Your squad points saved!");
    }
    setSaving(false);
  };

  const downloadSquadCSV = (targetTeamId: string) => {
    const team = franchises.find(t => t.id === targetTeamId);
    if (!team) return;

    const teamPlayers = allPlayers.filter(p => p.sold_to_id === targetTeamId);
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Player Name,Team,Role,Price\n";
    
    teamPlayers.forEach(p => {
      csvContent += `"${p.player_name}","${p.team}","${p.role}","${p.sold_price || p.price}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${team.team_name}_Squad.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const applyCalcPoints = () => {
    if (!calcActivePlayerId) return;
    const finalPoints = calculateDream11Points(calcStats as MatchStats);
    setMatchPoints(prev => ({ ...prev, [calcActivePlayerId]: finalPoints }));
    setCalcActivePlayerId(null);
  };

  // Standings Logic
  const calculateStandings = async () => {
    // Fetch ALL points and nominations for global standings
    const { data: allPoints } = await supabase.from("match_points").select("*");
    const { data: allNoms } = await supabase.from("nominations").select("*");

    const standingsData = franchises.map(team => {
      let totalPoints = 0;
      const teamPlayers = allPlayers.filter(p => p.sold_to_id === team.id);
      
      allMatches.forEach(m => {
        const nom = allNoms?.find(n => n.team_id === team.id && n.match_id === m.id);
        teamPlayers.forEach(player => {
          const ptRecord = allPoints?.find(p => p.player_id === player.id && p.match_id === m.id);
          if (ptRecord) {
            let pts = ptRecord.points;
            if (nom?.captain_id === player.id) pts *= 2;
            else if (nom?.vc_id === player.id) pts *= 1.5;
            totalPoints += pts;
          }
        });
      });
      return { ...team, totalPoints };
    });

    standingsData.sort((a, b) => b.totalPoints - a.totalPoints);
    setStandings(standingsData);
  };

  useEffect(() => {
    if (activeTab === "standings") {
      calculateStandings();
    }
  }, [activeTab, matchPoints]);
  const selectedMatch = allMatches.find(m => m.id === selectedMatchId);

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
       <div className="text-white font-black italic uppercase tracking-tighter text-4xl animate-pulse">Loading Scoreboard Hub...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xl">
           <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
                 <Trophy size={24} />
              </div>
              <div>
                 <h1 className="text-2xl font-black italic uppercase tracking-tighter leading-none">Points Table</h1>
                 <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-1">Season Progress & Live Scoring</p>
              </div>
           </div>

           <div className="flex items-center gap-3 bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  const idx = allMatches.findIndex(m => m.id === selectedMatchId);
                  if (idx > 0) setSelectedMatchId(allMatches[idx-1].id);
                }}
                disabled={allMatches.findIndex(m => m.id === selectedMatchId) === 0}
              >
                <ChevronLeft size={20} />
              </Button>
              <select 
                value={selectedMatchId}
                onChange={(e) => setSelectedMatchId(e.target.value)}
                className="bg-transparent font-black italic uppercase text-xs tracking-tighter text-slate-900 focus:outline-none cursor-pointer px-4"
              >
                 {allMatches.map(m => (
                    <option key={m.id} value={m.id}>{m.title} (Game {m.match_no})</option>
                 ))}
              </select>
              <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                     const idx = allMatches.findIndex(m => m.id === selectedMatchId);
                     if (idx < allMatches.length - 1) setSelectedMatchId(allMatches[idx+1].id);
                  }}
                  disabled={allMatches.findIndex(m => m.id === selectedMatchId) === allMatches.length - 1}
              >
                <ChevronRight size={20} />
              </Button>
           </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-white/50 backdrop-blur-md p-1.5 rounded-[1.5rem] border border-slate-200 w-full md:w-fit">
           <button 
             onClick={() => setActiveTab("sheet")}
             className={cn(
               "flex-1 md:flex-none px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
               activeTab === "sheet" ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-900"
             )}
           >
             My Sheet
           </button>
           <button 
             onClick={() => setActiveTab("others")}
             className={cn(
               "flex-1 md:flex-none px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
               activeTab === "others" ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-900"
             )}
           >
             Teammates
           </button>
           <button 
             onClick={() => setActiveTab("standings")}
             className={cn(
               "flex-1 md:flex-none px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
               activeTab === "standings" ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-900"
             )}
           >
             Standings
           </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
           
           <div className="lg:col-span-9 space-y-6">
              {(activeTab === "sheet" || activeTab === "others") ? (
                 <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                    
                    {/* Search & Actions */}
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                       <div className="relative w-full md:w-80">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <Input 
                            placeholder="Search player or team..."
                            className="pl-11 h-11 bg-white border-slate-200 rounded-xl font-bold text-sm shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                       </div>
                       
                       <div className="flex flex-wrap gap-2 items-center">
                          {profile && (
                             <Button 
                               onClick={saveAllMyPoints} 
                               disabled={saving}
                               className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 rounded-2xl font-black uppercase tracking-widest flex gap-2 shadow-xl"
                             >
                                {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                                Sync Points ({allPlayers.filter(p => p.sold_to_id === profile.id).length})
                             </Button>
                          )}
                          <Button 
                            variant="outline"
                            onClick={() => downloadSquadCSV(activeTab === "sheet" ? profile?.id : selectedTeammateId!)}
                            className="h-[52px] border-slate-200 rounded-2xl font-black uppercase tracking-widest flex gap-2 text-slate-600 px-6"
                          >
                             <Download size={16} />
                             Download CSV
                          </Button>
                       </div>
                    </div>

                    {/* Teammate Sub-Tabs */}
                    {activeTab === "others" && (
                       <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200 overflow-x-auto no-scrollbar">
                          {franchises.filter(t => t.id !== profile?.id).map(team => (
                             <button
                               key={team.id}
                               onClick={() => setSelectedTeammateId(team.id)}
                               className={cn(
                                 "flex-none px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                 selectedTeammateId === team.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                               )}
                             >
                                {team.team_name}
                             </button>
                          ))}
                       </div>
                    )}

                    {/* Unified Master Grid */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
                       <div className="max-h-[800px] overflow-y-auto">
                          <table className="w-full text-left border-collapse">
                             <thead className="bg-slate-50 sticky top-0 z-20">
                                <tr>
                                   <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 w-1/3">Player & Franchise</th>
                                   <th className="px-4 py-5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Tactics</th>
                                   <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Match Points</th>
                                </tr>
                             </thead>
                              <tbody className="text-sm">
                                 {franchises
                                   .filter(team => {
                                      if (activeTab === "sheet") return team.id === profile?.id;
                                      if (activeTab === "others") return team.id === selectedTeammateId;
                                      return false;
                                   })
                                   .map(team => {
                                   const teamPlayers = allPlayers.filter(p => 
                                      p.sold_to_id === team.id && 
                                      (p.player_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                       team.team_name.toLowerCase().includes(searchQuery.toLowerCase()))
                                   );
                                   if (teamPlayers.length === 0) return null;

                                   const nom = allNominations.find(n => n.team_id === team.id);

                                   return (
                                   <React.Fragment key={team.id}>
                                      <tr className="bg-slate-50/50 border-y border-slate-100">
                                         <td colSpan={3} className="px-8 py-3">
                                            <div className="flex items-center gap-3">
                                               <div className="h-6 w-6 bg-slate-900 rounded overflow-hidden flex items-center justify-center text-[10px] text-white font-black">
                                                  {team.team_name.charAt(0)}
                                               </div>
                                               <span className="font-black italic uppercase tracking-tight text-slate-900">{team.team_name}</span>
                                               {profile?.id === team.id && (
                                                  <span className="text-[8px] font-black uppercase tracking-widest bg-blue-100 text-blue-600 px-2 py-0.5 rounded ml-2">Your Squad</span>
                                               )}
                                            </div>
                                         </td>
                                      </tr>
                                      {teamPlayers.map(player => (
                                         <tr 
                                           key={player.id} 
                                           className={cn(
                                             "border-b border-slate-50 hover:bg-slate-50 transition-colors",
                                             calcActivePlayerId === player.id && "bg-indigo-50/50"
                                           )}
                                         >
                                            <td className="px-8 py-4">
                                               <div className="flex items-center gap-4">
                                                  <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                                                     {player.image_url ? <img src={getPlayerImage(player.image_url)!} className="w-full h-full object-cover object-top" alt="" /> : <User size={20} className="m-auto mt-2 opacity-10" />}
                                                  </div>
                                                  <div className="min-w-0">
                                                     <div className="font-bold text-slate-900 truncate">{player.player_name}</div>
                                                     <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{player.role}</div>
                                                  </div>
                                               </div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                               <div className="flex justify-center gap-1.5">
                                                  {nom?.captain_id === player.id ? (
                                                     <div className="h-7 px-3 bg-amber-500 text-white rounded-lg flex items-center justify-center font-black text-[10px] shadow-sm">CAP (2x)</div>
                                                  ) : nom?.vc_id === player.id ? (
                                                     <div className="h-7 px-3 bg-indigo-500 text-white rounded-lg flex items-center justify-center font-black text-[10px] shadow-sm">VC (1.5x)</div>
                                                  ) : (
                                                     profile?.id === team.id && !selectedMatch?.is_locked ? (
                                                        <div className="flex gap-1 group-hover:opacity-100 opacity-20 transition-opacity">
                                                           <Button 
                                                             variant="ghost" 
                                                             className="h-7 w-7 p-0 rounded-lg text-[8px] font-black border border-slate-200 hover:bg-amber-500 hover:text-white"
                                                             onClick={() => updateNomination('captain', player.id)}
                                                             title="Set as Captain"
                                                           >C</Button>
                                                           <Button 
                                                             variant="ghost" 
                                                             className="h-7 w-7 p-0 rounded-lg text-[8px] font-black border border-slate-200 hover:bg-indigo-500 hover:text-white"
                                                             onClick={() => updateNomination('vc', player.id)}
                                                             title="Set as VC"
                                                           >VC</Button>
                                                        </div>
                                                     ) : null
                                                  )}
                                               </div>
                                            </td>
                                            <td className="px-8 py-4">
                                               <div className="flex items-center justify-end gap-3">
                                                  {profile?.id === team.id && (
                                                     <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className={cn("h-8 w-8 rounded-lg", calcActivePlayerId === player.id ? "bg-slate-900 text-white" : "text-slate-300 hover:bg-slate-100")}
                                                        onClick={() => {
                                                           setCalcActivePlayerId(player.id);
                                                           const role = player.role?.toLowerCase();
                                                           setCalcStats(prev => ({
                                                              ...prev,
                                                              role: role?.includes('bowl') ? 'Bowler' : role?.includes('wk') ? 'WK' : role?.includes('all') ? 'All-Rounder' : 'Batter'
                                                           }));
                                                        }}
                                                     >
                                                        <Calculator size={14} />
                                                     </Button>
                                                  )}
                                                  <Input 
                                                     type="number"
                                                     step="0.5"
                                                     disabled={profile?.id !== team.id}
                                                     className={cn(
                                                       "w-24 h-10 text-right font-black border-slate-200 rounded-xl focus:ring-0",
                                                       profile?.id === team.id ? "bg-white" : "bg-slate-50/50 text-slate-400 cursor-not-allowed"
                                                     )}
                                                     value={matchPoints[player.id] || 0}
                                                     onChange={(e) => updatePoint(player.id, e.target.value)}
                                                  />
                                               </div>
                                            </td>
                                         </tr>
                                      ))}
                                   </React.Fragment>
                                )})}
                             </tbody>
                          </table>
                       </div>
                    </div>
                 </div>
              ) : (
                 <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <Card className="bg-white border-slate-200 shadow-xl rounded-[2.5rem] overflow-hidden">
                       <CardHeader className="p-8 border-b border-slate-100 bg-slate-50/50">
                          <CardTitle className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Live Championship Standings</CardTitle>
                          <CardDescription className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-1">Aggregated Performance Multi-Match Leaderboard</CardDescription>
                       </CardHeader>
                       <CardContent className="p-0">
                          <table className="w-full text-left border-collapse">
                             <thead className="bg-slate-50">
                                <tr>
                                   <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Rank</th>
                                   <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Franchise</th>
                                   <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Total Points</th>
                                </tr>
                             </thead>
                             <tbody>
                                {standings.map((team: any, idx: number) => (
                                   <tr key={team.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                      <td className="px-8 py-6">
                                         <span className={cn(
                                            "h-8 w-8 flex items-center justify-center rounded-lg font-black text-xs",
                                            idx === 0 ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-400"
                                         )}>{idx + 1}</span>
                                      </td>
                                      <td className="px-8 py-6">
                                         <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xs">
                                               {team.team_name?.charAt(0)}
                                            </div>
                                            <div>
                                               <div className="font-black italic uppercase text-slate-900 leading-none">{team.team_name}</div>
                                               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{team.full_name}</div>
                                            </div>
                                         </div>
                                      </td>
                                      <td className="px-8 py-6 text-right font-black italic text-3xl tracking-tighter text-slate-900">
                                         {Math.floor(team.totalPoints)}
                                      </td>
                                   </tr>
                                ))}
                             </tbody>
                          </table>
                       </CardContent>
                    </Card>
                 </div>
              )}
           </div>

           {/* Sidebar: Calculator & Status */}
           <div className="lg:col-span-3 space-y-6">
              
              {calcActivePlayerId && (
                 <Card className="bg-indigo-600 border-none rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                    <CardHeader className="p-6">
                       <CardTitle className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-2 text-white">
                          <Calculator size={18} className="text-indigo-300" />
                          Points Calculator
                       </CardTitle>
                       <CardDescription className="text-indigo-200 font-bold text-[9px] tracking-widest uppercase">
                          {allPlayers.find(p => p.id === calcActivePlayerId)?.player_name}
                       </CardDescription>
                    </CardHeader>
                    <CardContent className="px-6 pb-6 space-y-4">
                       <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                             <label className="text-[8px] font-black uppercase text-indigo-300">Runs</label>
                             <Input type="number" className="h-9 bg-indigo-700 border-indigo-500 text-white font-bold" value={calcStats.runs} onChange={(e) => setCalcStats(prev => ({...prev, runs: parseInt(e.target.value) || 0}))} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[8px] font-black uppercase text-indigo-300">Balls</label>
                             <Input type="number" className="h-9 bg-indigo-700 border-indigo-500 text-white font-bold" value={calcStats.balls} onChange={(e) => setCalcStats(prev => ({...prev, balls: parseInt(e.target.value) || 0}))} />
                          </div>
                       </div>
                       <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                             <label className="text-[8px] font-black uppercase text-indigo-300">Wickets</label>
                             <Input type="number" className="h-9 bg-indigo-700 border-indigo-500 text-white font-bold" value={calcStats.wickets} onChange={(e) => setCalcStats(prev => ({...prev, wickets: parseInt(e.target.value) || 0}))} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[8px] font-black uppercase text-indigo-300">Catches</label>
                             <Input type="number" className="h-9 bg-indigo-700 border-indigo-500 text-white font-bold" value={calcStats.catches} onChange={(e) => setCalcStats(prev => ({...prev, catches: parseInt(e.target.value) || 0}))} />
                          </div>
                       </div>
                       <div className="pt-3 border-t border-indigo-500 flex justify-between items-center text-white">
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Total</span>
                          <span className="text-3xl font-black italic tracking-tighter">{calculateDream11Points(calcStats as MatchStats)}</span>
                       </div>
                       <Button 
                         className="w-full bg-white text-indigo-600 hover:bg-emerald-500 hover:text-white py-5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all"
                         onClick={applyCalcPoints}
                       >
                         Apply to Grid
                       </Button>
                    </CardContent>
                 </Card>
              )}

              <Card className="bg-white border-slate-200 rounded-[2rem] shadow-xl p-6 space-y-6">
                 <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                       <Activity size={12} className="text-blue-500" />
                       Season Directives
                    </h4>
                    <div className="space-y-4">
                       <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 italic">
                          <div className="text-[8px] font-black uppercase text-slate-400 mb-1">C/VC Allocation</div>
                          <div className="text-xl font-black text-slate-800">{4 - cvcChangesUsed} <span className="text-xs opacity-40 font-bold">Left</span></div>
                          <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-tight">Limit your changes to 4 per season.</p>
                       </div>

                       {profile && (
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                             <div className="text-[8px] font-black uppercase text-slate-400 mb-3 block">Match Booster</div>
                             <div className="grid grid-cols-3 gap-2">
                                {['B1', 'B2', 'B3'].map(b => {
                                   const isSelected = allNominations.find(n => n.team_id === profile.id)?.booster_id === b;
                                   return (
                                      <button 
                                        key={b}
                                        onClick={() => updateBooster(isSelected ? "" : b)}
                                        className={cn(
                                          "h-10 rounded-xl font-black text-xs transition-all border",
                                          isSelected ? "bg-slate-900 border-slate-900 text-white shadow-lg" : "bg-white border-slate-200 text-slate-400 hover:border-slate-400"
                                        )}
                                      >
                                         {b}
                                      </button>
                                   );
                                })}
                             </div>
                             <p className="text-[9px] font-bold text-slate-400 mt-2 text-center uppercase">Choose one per match</p>
                          </div>
                       )}
                       
                       <ul className="space-y-3 px-1">
                          <li className="flex gap-3 items-start">
                             <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1 shrink-0" />
                             <p className="text-[10px] font-bold text-slate-500 leading-tight">Shared Sheet: View all teammates' points in one view.</p>
                          </li>
                          <li className="flex gap-3 items-start">
                             <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1 shrink-0" />
                             <p className="text-[10px] font-bold text-slate-500 leading-tight">Sync Status: Ensure you hit 'Sync My Points' after entry.</p>
                          </li>
                       </ul>
                    </div>
                 </div>
              </Card>

              <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-5 font-black text-4xl transform translate-x-1/4 -translate-y-1/4 italic">BETA</div>
                 <h4 className="text-lg font-black uppercase italic tracking-tighter mb-2">Protocol 2.0</h4>
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6 leading-relaxed">Integrated Fantasy Operations Console</p>
                 <Button className="w-full bg-white/10 hover:bg-white/20 text-white rounded-xl py-4 font-black uppercase tracking-widest text-[9px] border border-white/5 transition-all">Download Season Summary</Button>
              </div>
           </div>

        </div>
      </div>
    </div>
  );
}

import React from "react"; // For Fragments
