"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Trophy, Medal, Shield, Zap, Star, Activity, 
  ChevronRight, Lock, History, AlertCircle, TrendingUp,
  Calculator, Save, RefreshCw, ChevronLeft, Search, Clock,
  Users, User, Download, LayoutGrid, ListChecks
} from "lucide-react";
import { cn, getPlayerImage, iplColors } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { calculateDream11Points, MatchStats } from "@/lib/scoring";
import { syncMatchScores } from "@/lib/cricapi";
import { useAuth } from "@/components/auth/AuthProvider";
import React from "react";

export default function ScoreboardPage() {
  const { user, profile: authProfile } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [allMatches, setAllMatches] = useState<any[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [matchPoints, setMatchPoints] = useState<Record<string, number>>({});
  const [detailedMatchPoints, setDetailedMatchPoints] = useState<any[]>([]);
  const [allNominations, setAllNominations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cvcChangesUsed, setCvcChangesUsed] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"sheets" | "points" | "standings" | "fixtures">("sheets");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [standings, setStandings] = useState<any[]>([]);
  const [allMatchPoints, setAllMatchPoints] = useState<any[]>([]);

  // Calculator State
  const [calcStats, setCalcStats] = useState<Partial<MatchStats>>({
    runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, catches: 0, 
    stumpings: 0, lbwBowled: 0, maidens: 0, isDuck: false, role: 'Batter'
  });
  const [calcActivePlayerId, setCalcActivePlayerId] = useState<string | null>(null);
  const [showBreakdownId, setShowBreakdownId] = useState<string | null>(null);

  // Ref to track if data has loaded (prevents re-running standings on every render)
  const dataLoadedRef = useRef(false);

  const router = useRouter();

  // Sync auth profile into local state (runs once when authProfile arrives)
  useEffect(() => {
    if (authProfile) {
      setProfile(authProfile);
      setCvcChangesUsed(authProfile.cvc_changes_used || 0);
    }
  }, [authProfile]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedMatchId) {
      fetchMatchSpecificData(selectedMatchId);
    }
  }, [selectedMatchId]);

  // Only recalculate standings when the user switches to the standings tab
  useEffect(() => {
    if (activeTab === "standings" && dataLoadedRef.current) {
      calculateStandings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      // 1. Profile — from AuthProvider (no getSession needed)
      let currentProfile = authProfile;
      if (currentProfile) {
        setProfile(currentProfile);
        setCvcChangesUsed(currentProfile.cvc_changes_used || 0);
      }

      // 2. All Franchises
      const { data: teamsDataRaw } = await supabase
        .from("profiles")
        .select("*")
        .neq("role", "Viewer")
        .order("team_name", { ascending: true });
      
      const teamsData = teamsDataRaw || [];
      setFranchises(teamsData);

      // Default selected team to the logged-in user's team, or the first one
      if (currentProfile) {
        setSelectedTeamId(currentProfile.id);
      } else if (teamsData.length > 0) {
        setSelectedTeamId(teamsData[0].id);
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
        const nextMatch = matchesData.find(m => m.status === 'live' || m.status === 'scheduled') || matchesData[0];
        if (nextMatch) setSelectedMatchId(nextMatch.id);
      }

      // 5. All Match Points for Season
      const { data: allPts } = await supabase
        .from("match_points")
        .select("*");
      setAllMatchPoints(allPts || []);

      // Mark data as loaded so standings can be calculated
      dataLoadedRef.current = true;
    } catch (error) {
      console.error("Error fetching scoreboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchSpecificData = async (matchId: string) => {
    try {
      const { data: ptsData } = await supabase
        .from("match_points")
        .select("*")
        .eq("match_id", matchId);
      
      const pointsMap: Record<string, number> = {};
      ptsData?.forEach(p => {
        pointsMap[p.player_id] = p.points;
      });
      setMatchPoints(pointsMap);
      setDetailedMatchPoints(ptsData || []);

      const { data: nomsData } = await supabase
        .from("nominations")
        .select("*")
        .eq("match_id", matchId);
      setAllNominations(nomsData || []);

    } catch (error) {
      console.error("Error fetching match data:", error);
    }
  };

  const updateSeasonPoint = async (playerId: string, matchNo: number, value: string) => {
    const points = parseFloat(value) || 0;
    const match = allMatches.find(m => m.match_no === matchNo);
    if (!match) return;

    // Update local state for immediate feedback
    setAllMatchPoints(prev => {
      const existingIdx = prev.findIndex(p => p.player_id === playerId && p.match_id === match.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], points };
        return updated;
      }
      return [...prev, { player_id: playerId, match_id: match.id, points }];
    });
  };

  const saveSeasonPoints = async (playerId: string, matchNo: number, value: string) => {
    const points = parseFloat(value) || 0;
    const match = allMatches.find(m => m.match_no === matchNo);
    if (!match) return;

    setSaving(true);
    const { error } = await supabase
      .from("match_points")
      .upsert({
        player_id: playerId,
        match_id: match.id,
        points: points
      }, { onConflict: "player_id,match_id" });

    if (error) console.error("Error saving point:", error);
    setSaving(false);
  };

  const calculateStandings = () => {
    const standingsData = franchises.map(team => {
      let totalPoints = 0;
      let matchesPlayed = 0;
      const teamPlayers = allPlayers.filter(p => p.sold_to_id === team.id || p.sold_to === team.team_name);
      
      allMatches.forEach(m => {
        const nom = allNominations?.find(n => n.team_id === team.id && n.match_id === m.id);
        let matchHasPoints = false;

        teamPlayers.forEach(player => {
          const ptRecord = allMatchPoints?.find(p => p.player_id === player.id && p.match_id === m.id);
            if (ptRecord) {
              matchHasPoints = true;
              totalPoints += ptRecord.points;
            }
        });

        if (matchHasPoints) matchesPlayed++;
      });

      return {
        ...team,
        totalPoints,
        matchesPlayed: Math.min(matchesPlayed, 17)
      };
    });

    standingsData.sort((a, b) => b.totalPoints - a.totalPoints);
    setStandings(standingsData);
  };

  const handleSyncScores = async () => {
    const match = allMatches.find(m => m.id === selectedMatchId);
    if (!match?.api_match_id) {
      alert("This match is not linked to CricAPI.");
      return;
    }

    setSaving(true);
    const result = await syncMatchScores(match.id, match.api_match_id);
    if (result.success) {
      alert(`Successfully synced ${result.count} player scores!`);
      // Refresh all points to update the grid
      const { data: allPts } = await supabase.from("match_points").select("*");
      setAllMatchPoints(allPts || []);
      fetchMatchSpecificData(selectedMatchId);
    } else {
      alert("Sync failed: " + result.error);
    }
    setSaving(false);
  };

  const downloadSquadCSV = (targetTeamId: string) => {
    const team = franchises.find(t => t.id === targetTeamId);
    if (!team) return;

    const teamPlayers = allPlayers.filter(p => p.sold_to_id === targetTeamId || p.sold_to === team.team_name);
    
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

  const applyCalcPoints = async () => {
    if (!calcActivePlayerId || !selectedMatchId) return;
    setSaving(true);
    const finalPoints = calculateDream11Points(calcStats as MatchStats);
    
    const { error } = await supabase
      .from("match_points")
      .upsert({
        match_id: selectedMatchId,
        player_id: calcActivePlayerId,
        points: finalPoints,
        runs: calcStats.runs,
        balls: calcStats.balls,
        fours: calcStats.fours,
        sixes: calcStats.sixes,
        wickets: calcStats.wickets,
        catches: calcStats.catches,
        stumpings: calcStats.stumpings,
        lbw_bowled: calcStats.lbwBowled,
        maidens: calcStats.maidens,
        is_duck: calcStats.isDuck,
        strike_rate: calcStats.strikeRate,
        economy_rate: calcStats.economyRate
      }, { onConflict: "player_id,match_id" });

    if (error) alert(error.message);
    else {
      const { data: allPts } = await supabase.from("match_points").select("*");
      setAllMatchPoints(allPts || []);
      await fetchMatchSpecificData(selectedMatchId);
      setCalcActivePlayerId(null);
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
       <div className="text-white font-black italic uppercase tracking-tighter text-4xl animate-pulse">Loading Scoreboard Hub...</div>
    </div>
  );

  const selectedMatch = allMatches.find(m => m.id === selectedMatchId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xl">
           <div className="h-12 w-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <Trophy size={24} />
           </div>
           <div>
              <h1 className="text-2xl font-black italic uppercase tracking-tighter leading-none">Scoreboard Console</h1>
              <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-1">Season Progress & Match Analytics</p>
           </div>
        </div>

        {/* Primary Tabs */}
        <div className="flex bg-white/50 backdrop-blur-md p-1.5 rounded-[1.5rem] border border-slate-200 w-full md:w-fit overflow-x-auto no-scrollbar">
           <button 
             onClick={() => setActiveTab("sheets")} 
             className={cn(
               "flex items-center gap-2 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", 
               activeTab === "sheets" ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-900"
             )}
           >
              <LayoutGrid size={14} /> Score Sheets
           </button>
           <button 
             onClick={() => setActiveTab("points")} 
             className={cn(
               "flex items-center gap-2 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", 
               activeTab === "points" ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-900"
             )}
           >
              <Zap size={14} /> Points
           </button>
           <button 
             onClick={() => setActiveTab("standings")} 
             className={cn(
               "flex items-center gap-2 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", 
               activeTab === "standings" ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-900"
             )}
           >
              <Medal size={14} /> Standings
           </button>
           <button 
             onClick={() => setActiveTab("fixtures")} 
             className={cn(
               "flex items-center gap-2 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", 
               activeTab === "fixtures" ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-900"
             )}
           >
              <History size={14} /> Fixtures
           </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
           <div className="lg:col-span-9 space-y-6">
              
              {activeTab === "sheets" && (
                 <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                    {/* Team Sub-Tabs */}
                    <div className="flex gap-2 p-1 bg-white rounded-[1.5rem] border border-slate-200 overflow-x-auto no-scrollbar shadow-sm">
                       {franchises.map(team => (
                          <button 
                            key={team.id} 
                            onClick={() => setSelectedTeamId(team.id)} 
                            className={cn(
                              "flex-none px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap", 
                              selectedTeamId === team.id ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600"
                            )}
                          >
                             {team.team_name} {team.id === profile?.id && "(Yours)"}
                          </button>
                       ))}
                    </div>

                    {/* Search & Meta */}
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                       <div className="relative w-full md:w-80">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <Input 
                            placeholder="Search player..." 
                            className="pl-11 h-11 bg-white border-slate-200 rounded-xl font-bold text-sm shadow-sm" 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)} 
                          />
                       </div>
                       <Button 
                         variant="outline" 
                         onClick={() => downloadSquadCSV(selectedTeamId!)} 
                         className="h-[52px] border-slate-200 rounded-2xl font-black uppercase tracking-widest flex gap-2 text-slate-600 px-6 shadow-sm"
                       >
                          <Download size={16} /> Squad CSV
                       </Button>
                    </div>

                    {/* 17-Game Grid */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
                       <div className="overflow-x-auto no-scrollbar">
                          <table className="w-full text-left border-collapse min-w-[1200px]">
                             <thead className="bg-slate-50 sticky top-0 z-20">
                                <tr>
                                   <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 sticky left-0 bg-slate-50 z-30 min-w-[240px]">Player Detail</th>
                                   {[...Array(17)].map((_, i) => <th key={i} className="px-4 py-5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">G{i+1}</th>)}
                                   <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-900 font-black sticky right-0 bg-slate-50 z-30">Total</th>
                                </tr>
                             </thead>
                             <tbody className="text-sm">
                                 {franchises.filter(f => f.id === selectedTeamId).map(team => {
                                    const isMyTeam = team.id === profile?.id;
                                    const teamPlayers = allPlayers
                                      .filter(p => (p.sold_to_id === team.id || p.sold_to === team.team_name) && p.player_name.toLowerCase().includes(searchQuery.toLowerCase()))
                                      .sort((a, b) => (a.team || "").localeCompare(b.team || ""));
                                    const colTotals = Array(17).fill(0);

                                   return (
                                      <React.Fragment key={team.id}>
                                         {teamPlayers.map(player => {
                                            const playerScores = Array(17).fill(0);
                                            allMatchPoints.filter(pt => pt.player_id === player.id).forEach(pt => {
                                               const m = allMatches.find(match => match.id === pt.match_id);
                                               if (m?.match_no && m.match_no <= 17) {
                                                  playerScores[m.match_no - 1] = pt.points;
                                                  colTotals[m.match_no - 1] += pt.points;
                                               }
                                            });
                                            const rowTotal = playerScores.reduce((a, b) => a + b, 0);

                                             return (
                                                <tr key={player.id} className={cn("group border-b border-slate-50 transition-colors", iplColors[player.team]?.bg || "hover:bg-slate-50")}>
                                                   <td className={cn("px-8 py-4 sticky left-0 border-r border-slate-100 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.01)]", iplColors[player.team]?.bg || "bg-white group-hover:bg-slate-50")}>
                                                     <div className="flex items-center gap-4">
                                                        <div className="h-9 w-9 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                                                           <img src={getPlayerImage(player.image_url)!} className="w-full h-full object-cover object-top" />
                                                        </div>
                                                        <div className="min-w-0">
                                                           <div className="font-bold text-slate-900 truncate text-xs">{player.player_name}</div>
                                                           <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{player.role}</div>
                                                        </div>
                                                     </div>
                                                  </td>
                                                  {playerScores.map((score, idx) => (
                                                     <td key={idx} className="px-2 py-4 text-center">
                                                        {isMyTeam ? (
                                                           <Input 
                                                             type="number" 
                                                             step="0.5" 
                                                             value={score || ""} 
                                                             onChange={(e) => updateSeasonPoint(player.id, idx + 1, e.target.value)} 
                                                             onBlur={(e) => saveSeasonPoints(player.id, idx + 1, e.target.value)}
                                                             className="h-8 w-16 mx-auto text-center font-black text-[10px] bg-slate-50 border-none rounded-lg focus:ring-1 focus:ring-slate-900" 
                                                             placeholder="0"
                                                           />
                                                        ) : (
                                                           <span className={cn("font-black text-[10px]", score > 0 ? "text-slate-900" : "text-slate-200")}>{score || 0}</span>
                                                        )}
                                                     </td>
                                                  ))}
                                                  <td className="px-8 py-4 text-right font-black italic text-sm text-slate-900 sticky right-0 bg-white group-hover:bg-slate-50 border-l border-slate-100 z-10">{rowTotal}</td>
                                               </tr>
                                             );
                                          })}
                                          <tr className="bg-slate-900 text-white">
                                             <td className="px-8 py-4 sticky left-0 bg-slate-900 z-10 font-black text-[10px] uppercase tracking-widest opacity-60">Squad Performance</td>
                                             {colTotals.map((t, i) => <td key={i} className="px-4 py-4 text-center font-black text-[11px] underline underline-offset-4 decoration-white/20">{t}</td>)}
                                             <td className="px-8 py-4 text-right font-black italic text-xl sticky right-0 bg-slate-900 z-10">{colTotals.reduce((a, b) => a + b, 0)}</td>
                                          </tr>
                                       </React.Fragment>
                                    );
                                 })}
                             </tbody>
                          </table>
                       </div>
                    </div>
                 </div>
              )}

              {activeTab === "points" && (
                 <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    {/* Match Selection Bar */}
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xl">
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
                             {allMatches.map(m => <option key={m.id} value={m.id}>{m.title} (G{m.match_no})</option>)}
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

                       {profile?.role === 'Admin' && (
                          <Button 
                            onClick={handleSyncScores} 
                            disabled={saving || !selectedMatch?.api_match_id} 
                            className="bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] px-8 h-[52px] shadow-lg flex gap-3 transition-all active:scale-95"
                          >
                             {saving ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} className="text-yellow-400" />}
                             Sync Match Stats
                          </Button>
                       )}
                    </div>

                    {/* Match Leaderboard */}
                    <Card className="bg-white border-slate-200 shadow-xl rounded-[2.5rem] overflow-hidden">
                       <CardHeader className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
                          <div>
                             <CardTitle className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Match Leaderboard</CardTitle>
                             <CardDescription className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-1">Live performance for {selectedMatch?.title}</CardDescription>
                          </div>
                          <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                             <TrendingUp size={24} />
                          </div>
                       </CardHeader>
                       <CardContent className="p-0">
                          <table className="w-full text-left border-collapse">
                             <thead className="bg-slate-50">
                                <tr>
                                   <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Rank</th>
                                   <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Player</th>
                                   <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Franchise</th>
                                   <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Match Pts</th>
                                </tr>
                             </thead>
                             <tbody>
                                 {allPlayers
                                   .map(p => {
                                      const matchPt = allMatchPoints.find(pt => pt.player_id === p.id && pt.match_id === selectedMatchId);
                                      return { ...p, ...matchPt, points: matchPt?.points || 0 };
                                   })
                                   .filter(p => p.points > 0 || searchQuery === "")
                                   .sort((a, b) => b.points - a.points)
                                   .map((player, idx) => {
                                      const pTeam = franchises.find(f => f.id === player.sold_to_id || f.team_name === player.sold_to);
                                      return (
                                         <React.Fragment key={player.id}>
                                            <tr 
                                              className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors cursor-pointer"
                                              onClick={() => setShowBreakdownId(showBreakdownId === player.id ? null : player.id)}
                                            >
                                               <td className="px-8 py-5">
                                                  <span className={cn(
                                                    "h-7 w-7 flex items-center justify-center rounded-lg font-black text-xs", 
                                                    idx === 0 ? "bg-amber-500 text-white shadow-md shadow-amber-200" : "bg-slate-100 text-slate-400"
                                                  )}>
                                                     {idx + 1}
                                                  </span>
                                               </td>
                                               <td className="px-8 py-5">
                                                  <div className="flex items-center gap-4">
                                                     <div className="h-9 w-9 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                                                        <img src={getPlayerImage(player.image_url)!} className="w-full h-full object-cover object-top" />
                                                     </div>
                                                     <div>
                                                        <span className="font-bold text-slate-900 block leading-tight">{player.player_name}</span>
                                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider font-mono">{player.team}</span>
                                                     </div>
                                                  </div>
                                               </td>
                                               <td className="px-8 py-5">
                                                  <span className="text-[10px] font-black uppercase tracking-tight text-slate-500 px-3 py-1 bg-slate-100 rounded-full">{pTeam?.team_name || 'Unsold'}</span>
                                               </td>
                                               <td className="px-8 py-5 text-right font-black italic text-xl text-slate-900">{player.points?.toFixed(1)}</td>
                                            </tr>
                                            {showBreakdownId === player.id && (
                                               <tr className="bg-slate-900 text-white/90">
                                                  <td colSpan={4} className="p-8">
                                                     <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                                                        <div className="space-y-4">
                                                           <h5 className="text-[10px] font-black uppercase tracking-widest text-white/30">Batting Performance</h5>
                                                           <div className="grid grid-cols-2 gap-4">
                                                              <div>
                                                                 <div className="text-[9px] font-bold text-white/40 uppercase">Runs/Balls</div>
                                                                 <div className="text-xl font-black italic">{player.runs || 0}<span className="text-xs opacity-30 font-medium ml-1">({player.balls || 0})</span></div>
                                                              </div>
                                                              <div>
                                                                 <div className="text-[9px] font-bold text-white/40 uppercase">Boundaries</div>
                                                                 <div className="text-xl font-black italic">{player.fours || 0}<span className="text-xs opacity-30 font-medium ml-1">4s</span> {player.sixes || 0}<span className="text-xs opacity-30 font-medium ml-1">6s</span></div>
                                                              </div>
                                                           </div>
                                                        </div>
                                                        <div className="space-y-4">
                                                           <h5 className="text-[10px] font-black uppercase tracking-widest text-white/30">Bowling Performance</h5>
                                                           <div className="grid grid-cols-2 gap-4">
                                                              <div>
                                                                 <div className="text-[9px] font-bold text-white/40 uppercase">Wickets/Dots</div>
                                                                 <div className="text-xl font-black italic">{player.wickets || 0}<span className="text-xs opacity-30 font-medium ml-1">W</span> {player.dot_balls || 0}<span className="text-xs opacity-30 font-medium ml-1">.</span></div>
                                                              </div>
                                                              <div>
                                                                 <div className="text-[9px] font-bold text-white/40 uppercase">LBW/Maiden</div>
                                                                 <div className="text-xl font-black italic">{player.lbw_bowled || 0}<span className="text-xs opacity-30 font-medium ml-1">L/B</span> {player.maidens || 0}<span className="text-xs opacity-30 font-medium ml-1">M</span></div>
                                                              </div>
                                                           </div>
                                                        </div>
                                                        <div className="space-y-4">
                                                           <h5 className="text-[10px] font-black uppercase tracking-widest text-white/30">Fielding/Misc</h5>
                                                           <div className="grid grid-cols-2 gap-4">
                                                              <div>
                                                                 <div className="text-[9px] font-bold text-white/40 uppercase">Catches/Stump</div>
                                                                 <div className="text-xl font-black italic">{player.catches || 0}<span className="text-xs opacity-30 font-medium ml-1">C</span> {player.stumpings || 0}<span className="text-xs opacity-30 font-medium ml-1">ST</span></div>
                                                              </div>
                                                              <div>
                                                                 <div className="text-[9px] font-bold text-white/40 uppercase">Run Out</div>
                                                                 <div className="text-xl font-black italic">{player.run_out_direct || 0}<span className="text-xs opacity-30 font-medium ml-1">Dir</span> {player.run_out_indirect || 0}<span className="text-xs opacity-30 font-medium ml-1">Ind</span></div>
                                                              </div>
                                                           </div>
                                                        </div>
                                                        <div className="space-y-4">
                                                           <h5 className="text-[10px] font-black uppercase tracking-widest text-white/30">Calculated Index</h5>
                                                           <div className="flex items-center gap-4">
                                                              <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center text-white shrink-0">
                                                                 <Zap size={24} className="text-yellow-400" />
                                                              </div>
                                                              <div className="text-3xl font-black italic text-white">{player.points?.toFixed(1)}</div>
                                                           </div>
                                                        </div>
                                                     </div>
                                                  </td>
                                               </tr>
                                            )}
                                         </React.Fragment>
                                      );
                                   })}
                             </tbody>
                          </table>
                       </CardContent>
                    </Card>
                 </div>
              )}

              {activeTab === "standings" && (
                 <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <Card className="bg-white border-slate-200 shadow-2xl rounded-[2.5rem] overflow-hidden">
                       <CardHeader className="p-8 border-b border-slate-100 bg-slate-50/50">
                          <CardTitle className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Season Championship</CardTitle>
                          <CardDescription className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-1">Overall team standings based on aggregate player points</CardDescription>
                       </CardHeader>
                       <CardContent className="p-0">
                          <table className="w-full text-left border-collapse">
                             <thead className="bg-slate-50">
                                <tr>
                                   <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Rank</th>
                                   <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Franchise</th>
                                   <th className="px-8 py-5 text-right text-[10px] font-black uppercase text-slate-400">Total Score</th>
                                </tr>
                             </thead>
                             <tbody>
                                {standings.map((team, idx) => (
                                   <tr key={team.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                      <td className="px-8 py-8">
                                         <span className={cn(
                                           "h-10 w-10 flex items-center justify-center rounded-2xl font-black text-sm transition-all", 
                                           idx === 0 ? "bg-slate-900 text-white rotate-3 shadow-xl" : "bg-slate-100 text-slate-400"
                                         )}>
                                            {idx + 1}
                                         </span>
                                      </td>
                                      <td className="px-8 py-8">
                                         <div className="flex items-center gap-5">
                                            <div className="h-12 w-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-lg">
                                               {team.team_name?.charAt(0)}
                                            </div>
                                            <div>
                                               <div className="font-black italic uppercase text-slate-900 text-xl leading-none">{team.team_name}</div>
                                               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{team.full_name}</div>
                                            </div>
                                         </div>
                                      </td>
                                      <td className="px-8 py-8 text-right">
                                         <div className="font-black italic text-4xl text-slate-900 tracking-tighter">{Math.floor(team.totalPoints)}</div>
                                         <div className="text-[10px] font-black text-indigo-500 uppercase mt-1.5 tracking-widest">{team.matchesPlayed} GAMES TRACKED</div>
                                      </td>
                                   </tr>
                                ))}
                             </tbody>
                          </table>
                       </CardContent>
                    </Card>
                 </div>
              )}

              {activeTab === "fixtures" && (
                 <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="flex justify-between items-center mb-4 bg-white p-8 rounded-[2rem] border border-slate-200">
                       <div>
                          <h2 className="text-xl font-black italic uppercase tracking-tighter">Season Fixtures</h2>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Found {allMatches.length} Matches Schedule</p>
                       </div>
                       {profile?.role === 'Admin' && (
                          <div className="flex gap-2">
                             <Button 
                               onClick={async () => {
                                 setSaving(true);
                                 try {
                                   const { syncFixtures } = await import("@/lib/cricapi");
                                   const result = await syncFixtures("87c62aac-bc3c-4738-ab93-19da0690488f");
                                   if (result.success) {
                                      alert(`Successfully synced ${result.count} fixtures!`);
                                      window.location.reload();
                                   } else alert(result.error);
                                 } catch (e: any) { alert(e.message); }
                                 setSaving(false);
                               }}
                               className="bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] px-6 h-12 shadow-lg flex gap-3 transition-all"
                             >
                                <RefreshCw className={cn(saving && "animate-spin")} size={14} /> Sync All Fixtures
                             </Button>
                          </div>
                       )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       {allMatches.map((m) => {
                          const isCompleted = m.status === 'completed';
                          const isLive = m.status === 'live';
                          
                          return (
                            <div 
                              key={m.id} 
                              className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl group hover:border-slate-900 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
                            >
                               {isLive && <div className="absolute top-0 right-0 p-4 animate-pulse"><Zap className="text-red-500" size={16} /></div>}
                               
                               <div className="flex justify-between items-start mb-6">
                                  <div className="flex items-center gap-2">
                                     <div className="h-2 w-2 rounded-full bg-slate-900" />
                                     <span className="font-black text-[10px] uppercase tracking-widest text-slate-400">Match {m.match_no}</span>
                                  </div>
                                  <span className={cn(
                                     "text-[8px] font-black uppercase px-4 py-1.5 rounded-full tracking-widest shadow-sm",
                                     isCompleted ? "bg-emerald-500 text-white" :
                                     isLive ? "bg-red-500 text-white" :
                                     "bg-slate-100 text-slate-500"
                                  )}>
                                     {m.status || 'scheduled'}
                                  </span>
                               </div>
                               
                               <h3 className="font-black italic uppercase text-lg text-slate-900 leading-none mb-6 group-hover:text-indigo-600 transition-colors">{m.title}</h3>
                               
                               <div className="flex flex-col gap-3">
                                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl">
                                     <div className="h-8 w-8 bg-white rounded-xl flex items-center justify-center text-slate-900 shadow-sm">
                                        <Clock size={14} />
                                     </div>
                                     <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-400 uppercase leading-none tracking-tight">Kickoff</span>
                                        <span className="text-[11px] font-black text-slate-900 uppercase italic">
                                          {new Date(m.date_time).toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                     </div>
                                  </div>
                               </div>
                            </div>
                          );
                       })}
                    </div>
                 </div>
              )}
           </div>

           {/* Sidebar */}
           <div className="lg:col-span-3 space-y-6">
              {calcActivePlayerId && (activeTab === "sheets" || activeTab === "points") && (
                 <Card className="bg-indigo-600 border-none rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                    <CardHeader className="p-6">
                       <CardTitle className="text-lg font-black text-white flex items-center gap-2">
                          <Calculator size={18} className="text-indigo-300" /> Points Engine
                       </CardTitle>
                       <CardDescription className="text-indigo-200 font-bold text-[9px] uppercase tracking-widest mt-1">
                          {allPlayers.find(p => p.id === calcActivePlayerId)?.player_name || "Calculator"}
                       </CardDescription>
                    </CardHeader>
                    <CardContent className="px-6 pb-6 space-y-4">
                       <div className="grid grid-cols-2 gap-2">
                          <Input type="number" className="h-9 bg-indigo-700 border-indigo-500 text-white placeholder:text-indigo-400/50" value={calcStats.runs} onChange={(e) => setCalcStats(prev => ({...prev, runs: parseInt(e.target.value) || 0}))} placeholder="Runs" />
                          <Input type="number" className="h-9 bg-indigo-700 border-indigo-500 text-white placeholder:text-indigo-400/50" value={calcStats.balls} onChange={(e) => setCalcStats(prev => ({...prev, balls: parseInt(e.target.value) || 0}))} placeholder="Balls" />
                       </div>
                       <Button className="w-full bg-white text-indigo-600 hover:bg-emerald-500 hover:text-white font-black uppercase text-[10px] rounded-xl transition-all" onClick={applyCalcPoints}>Apply to Grid</Button>
                    </CardContent>
                 </Card>
              )}
              
              <Card className="bg-white border-slate-200 rounded-[2rem] shadow-xl p-8 space-y-8">
                 <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 flex items-center gap-2 tracking-widest"><Activity size={14} className="text-blue-500" /> Control Deck</h4>
                    <div className="space-y-4">
                       <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <div className="text-[8px] font-black uppercase text-slate-400 mb-1 tracking-wider">C/VC Balance</div>
                          <div className="text-2xl font-black text-slate-900 tracking-tighter">{4 - cvcChangesUsed} <span className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Left</span></div>
                       </div>

                       <div className="bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-3 opacity-10 font-black text-2xl rotate-12">BETA</div>
                          <h5 className="text-[9px] font-black uppercase tracking-widest text-white/50 mb-1">Grid Ops</h5>
                          <p className="text-[10px] font-bold text-white/70 leading-relaxed uppercase">Enter points directly into the G columns for your squad.</p>
                       </div>
                    </div>
                 </div>
              </Card>

              {activeTab === "sheets" && !calcActivePlayerId && (
                 <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-indigo-400 flex items-center gap-2"><ListChecks size={14} /> Quick Tips</h4>
                    <ul className="space-y-3">
                       <li className="flex gap-3 text-[10px] font-bold text-indigo-600 leading-tight">
                          <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1 shrink-0" />
                          <span>Hover over names to see player stats</span>
                       </li>
                       <li className="flex gap-3 text-[10px] font-bold text-indigo-600 leading-tight">
                          <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1 shrink-0" />
                          <span>Rows with G indicators are editable by you</span>
                       </li>
                    </ul>
                 </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
