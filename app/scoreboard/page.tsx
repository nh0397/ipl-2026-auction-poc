"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart as BarChartRecharts, Bar
} from "recharts";
import { Input } from "@/components/ui/input";
import { 
  Trophy, Medal, Shield, Zap, Star, Activity, 
  ChevronRight, Lock, History, AlertCircle, TrendingUp,
  Calculator, Save, RefreshCw, ChevronLeft, Search, Clock,
  Users, User, Download, LayoutGrid, ListChecks, Calendar,
  MapPin, BarChart3, Target, Loader2, ArrowUpDown
} from "lucide-react";
import { cn, getPlayerImage, iplColors } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { calculateDream11Points, MatchStats } from "@/lib/scoring";
import { syncMatchScores } from "@/lib/cricapi";
import { useAuth } from "@/components/auth/AuthProvider";
import React from "react";

// ─── Fixture helpers ────────────────────────────────────────────────
interface Fixture {
  id: string;
  api_match_id: string;
  match_no: number;
  title: string;
  venue: string | null;
  match_date: string;
  date_time_gmt: string;
  team1_name: string | null;
  team1_short: string | null;
  team1_img: string | null;
  team2_name: string | null;
  team2_short: string | null;
  team2_img: string | null;
  status: string;
  match_started: boolean;
  match_ended: boolean;
}

function getTodayIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().split("T")[0];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(dateTimeGMT: string): string {
  const d = new Date(dateTimeGMT);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}

// CricAPI appends "W" for women's teams (e.g. RCBW → RCB). Strip it.
function cleanShort(short: string | null): string {
  if (!short) return "";
  return short.endsWith("W") && short.length > 2 ? short.slice(0, -1) : short;
}

// ─── Main page ──────────────────────────────────────────────────────
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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"sheets" | "standings" | "fixtures">("sheets");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [standings, setStandings] = useState<any[]>([]);
  const [allMatchPoints, setAllMatchPoints] = useState<any[]>([]);

  // Fixtures from DB
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [fixtureFilter, setFixtureFilter] = useState<"all" | "upcoming" | "completed">("all");
  const today = useMemo(() => getTodayIST(), []);

  // Calculator State
  const [calcStats, setCalcStats] = useState<Partial<MatchStats>>({
    runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, catches: 0, 
    stumpings: 0, lbwBowled: 0, maidens: 0, isDuck: false, role: 'Batter'
  });
  const [calcActivePlayerId, setCalcActivePlayerId] = useState<string | null>(null);
  const [showBreakdownId, setShowBreakdownId] = useState<string | null>(null);

  const dataLoadedRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (authProfile) {
      setProfile(authProfile);
    }
  }, [authProfile]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedMatchId) fetchMatchSpecificData(selectedMatchId);
  }, [selectedMatchId]);

  useEffect(() => {
    if (activeTab === "standings" && dataLoadedRef.current) calculateStandings();
  }, [activeTab]);

  // Fetch fixtures from DB when tab is activated
  useEffect(() => {
    if (activeTab === "fixtures" && fixtures.length === 0) {
      fetchFixtures();
    }
  }, [activeTab]);

  const fetchFixtures = async () => {
    const { data, error } = await supabase
      .from("fixtures")
      .select("*")
      .order("match_no", { ascending: true });
    if (data) setFixtures(data);
  };

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      let currentProfile = authProfile;
      if (currentProfile) {
        setProfile(currentProfile);
      }

      const { data: teamsDataRaw } = await supabase
        .from("profiles")
        .select("*")
        .neq("role", "Viewer")
        .order("team_name", { ascending: true });
      
      const teamsData = teamsDataRaw || [];
      setFranchises(teamsData);

      if (currentProfile) setSelectedTeamId(currentProfile.id);
      else if (teamsData.length > 0) setSelectedTeamId(teamsData[0].id);

      const { data: playersData } = await supabase
        .from("players")
        .select("*")
        .eq("auction_status", "sold")
        .order("player_name", { ascending: true });
      setAllPlayers(playersData || []);

      const { data: matchesData } = await supabase
        .from("matches")
        .select("*")
        .order("match_no", { ascending: true });
      
      if (matchesData) {
        setAllMatches(matchesData);
        const nextMatch = matchesData.find(m => m.status === 'live' || m.status === 'scheduled') || matchesData[0];
        if (nextMatch) setSelectedMatchId(nextMatch.id);
      }

      const { data: allPts } = await supabase
        .from("match_points")
        .select("*");
      setAllMatchPoints(allPts || []);

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
      ptsData?.forEach(p => { pointsMap[p.player_id] = p.points; });
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
      .upsert({ player_id: playerId, match_id: match.id, points }, { onConflict: "player_id,match_id" });
    if (error) console.error("Error saving point:", error);
    setSaving(false);
  };

  const calculateStandings = () => {
    const standingsData = franchises.map(team => {
      let totalPoints = 0;
      let matchesPlayed = 0;
      let bestMatch = 0;
      let worstMatch = Infinity;
      const matchScores: number[] = [];
      const teamPlayers = allPlayers.filter(p => p.sold_to_id === team.id || p.sold_to === team.team_name);
      
      allMatches.forEach(m => {
        let matchTotal = 0;
        let matchHasPoints = false;
        teamPlayers.forEach(player => {
          const ptRecord = allMatchPoints?.find(p => p.player_id === player.id && p.match_id === m.id);
          if (ptRecord) {
            matchHasPoints = true;
            matchTotal += ptRecord.points;
          }
        });
        if (matchHasPoints) {
          matchesPlayed++;
          totalPoints += matchTotal;
          matchScores.push(matchTotal);
          if (matchTotal > bestMatch) bestMatch = matchTotal;
          if (matchTotal < worstMatch) worstMatch = matchTotal;
        }
      });

      const avgPerMatch = matchesPlayed > 0 ? totalPoints / matchesPlayed : 0;
      const avgPerPlayer = teamPlayers.length > 0 ? totalPoints / teamPlayers.length : 0;
      const consistency = matchScores.length > 1 
        ? Math.sqrt(matchScores.reduce((sum, s) => sum + Math.pow(s - avgPerMatch, 2), 0) / matchScores.length)
        : 0;

      return {
        ...team,
        totalPoints,
        matchesPlayed: Math.min(matchesPlayed, 17),
        bestMatch: matchesPlayed > 0 ? bestMatch : 0,
        worstMatch: matchesPlayed > 0 && worstMatch !== Infinity ? worstMatch : 0,
        avgPerMatch: Math.round(avgPerMatch * 10) / 10,
        avgPerPlayer: Math.round(avgPerPlayer * 10) / 10,
        consistency: Math.round(consistency * 10) / 10,
        squadSize: teamPlayers.length,
      };
    });

    standingsData.sort((a, b) => b.totalPoints - a.totalPoints);
    setStandings(standingsData);
  };

  const handleSyncScores = async () => {
    const match = allMatches.find(m => m.id === selectedMatchId);
    if (!match?.api_match_id) { alert("This match is not linked to CricAPI."); return; }
    setSaving(true);
    const result = await syncMatchScores(match.id, match.api_match_id);
    if (result.success) {
      alert(`Successfully synced ${result.count} player scores!`);
      const { data: allPts } = await supabase.from("match_points").select("*");
      setAllMatchPoints(allPts || []);
      fetchMatchSpecificData(selectedMatchId);
    } else alert("Sync failed: " + result.error);
    setSaving(false);
  };

  const downloadSquadCSV = (targetTeamId: string) => {
    const team = franchises.find(t => t.id === targetTeamId);
    if (!team) return;
    const teamPlayers = allPlayers.filter(p => p.sold_to_id === targetTeamId || p.sold_to === team.team_name);
    let csvContent = "data:text/csv;charset=utf-8,Player Name,Team,Role,Price\n";
    teamPlayers.forEach(p => { csvContent += `"${p.player_name}","${p.team}","${p.role}","${p.sold_price || p.price}"\n`; });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
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
        runs: calcStats.runs, balls: calcStats.balls, fours: calcStats.fours, sixes: calcStats.sixes,
        wickets: calcStats.wickets, catches: calcStats.catches, stumpings: calcStats.stumpings,
        lbw_bowled: calcStats.lbwBowled, maidens: calcStats.maidens, is_duck: calcStats.isDuck,
        strike_rate: calcStats.strikeRate, economy_rate: calcStats.economyRate
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

  // ─── Fixture computed data ────────────────────────────────────────
  const filteredFixtures = useMemo(() => {
    if (fixtureFilter === "upcoming") return fixtures.filter(f => f.match_date >= today);
    if (fixtureFilter === "completed") return fixtures.filter(f => f.match_ended || f.match_date < today);
    return fixtures;
  }, [fixtures, fixtureFilter, today]);

  const groupedFixtures = useMemo(() => {
    const map = new Map<string, Fixture[]>();
    filteredFixtures.forEach(f => {
      if (!map.has(f.match_date)) map.set(f.match_date, []);
      map.get(f.match_date)!.push(f);
    });
    return Array.from(map.entries());
  }, [filteredFixtures]);

  // ─── Loading ──────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
       <Loader2 className="h-8 w-8 text-slate-400 animate-spin" />
    </div>
  );

  const selectedMatch = allMatches.find(m => m.id === selectedMatchId);
  const completedFixtures = fixtures.filter(f => f.match_ended || f.match_date < today).length;
  const todayFixtures = fixtures.filter(f => f.match_date === today);

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-3 sm:p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-3 sm:gap-4 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-slate-200 shadow-xl">
           <div className="h-10 w-10 sm:h-12 sm:w-12 bg-slate-900 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-lg flex-shrink-0">
              <Trophy size={20} />
           </div>
           <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-black italic uppercase tracking-tighter leading-none">Score Manager</h1>
              <p className="text-slate-400 font-bold uppercase text-[8px] sm:text-[9px] tracking-widest mt-1">Season Progress & Match Analytics</p>
           </div>
        </div>

        {/* Primary Tabs — scrollable on mobile */}
        <div className="flex bg-white/50 backdrop-blur-md p-1 sm:p-1.5 rounded-xl sm:rounded-[1.5rem] border border-slate-200 w-full overflow-x-auto no-scrollbar">
           {[
             { key: "sheets" as const, label: "Score Sheets", icon: LayoutGrid },
             { key: "standings" as const, label: "Standings", icon: BarChart3 },
             { key: "fixtures" as const, label: "Fixtures", icon: Calendar },
           ].map(tab => (
             <button 
               key={tab.key}
               onClick={() => setActiveTab(tab.key)} 
               className={cn(
                 "flex items-center gap-1.5 sm:gap-2 px-4 sm:px-8 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-1 sm:flex-none justify-center", 
                 activeTab === tab.key ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-900"
               )}
             >
                <tab.icon size={14} className="hidden sm:block" />
                {tab.label}
             </button>
           ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB: SCORE SHEETS                                             */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "sheets" && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
            {/* Team Sub-Tabs — horizontal scroll on mobile */}
            <div className="flex gap-2 p-1 bg-white rounded-xl sm:rounded-[1.5rem] border border-slate-200 overflow-x-auto no-scrollbar shadow-sm">
               {franchises.map(team => (
                  <button 
                    key={team.id} 
                    onClick={() => setSelectedTeamId(team.id)} 
                    className={cn(
                      "flex-none px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap", 
                      selectedTeamId === team.id ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                     {team.team_name} {team.id === profile?.id && "(You)"}
                  </button>
               ))}
            </div>

            {/* Search & Download */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
               <div className="relative w-full sm:w-80">
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
                 className="h-11 sm:h-[52px] border-slate-200 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest flex gap-2 text-slate-600 px-4 sm:px-6 shadow-sm text-[10px]"
               >
                  <Download size={16} /> Squad CSV
               </Button>
            </div>

            {/* ── Mobile: Card-Based Score View ── */}
            <div className="block sm:hidden space-y-3">
              {franchises.filter(f => f.id === selectedTeamId).map(team => {
                const isMyTeam = team.id === profile?.id;
                const teamPlayers = allPlayers
                  .filter(p => (p.sold_to_id === team.id || p.sold_to === team.team_name) && p.player_name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .sort((a, b) => (a.team || "").localeCompare(b.team || ""));
                
                return teamPlayers.map(player => {
                  const playerScores = Array(17).fill(0);
                  allMatchPoints.filter(pt => pt.player_id === player.id).forEach(pt => {
                    const m = allMatches.find(match => match.id === pt.match_id);
                    if (m?.match_no && m.match_no <= 17) playerScores[m.match_no - 1] = pt.points;
                  });
                  const rowTotal = playerScores.reduce((a, b) => a + b, 0);

                  return (
                    <div key={player.id} className={cn("bg-white rounded-2xl border border-slate-100 p-4 shadow-sm", iplColors[player.team]?.bg)}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                            <img src={getPlayerImage(player.image_url)!} className="w-full h-full object-cover object-top" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{player.player_name}</div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{player.role} • {player.team}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-black italic text-slate-900">{rowTotal}</div>
                          <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total</div>
                        </div>
                      </div>
                      
                      {/* Compact game grid */}
                      <div className="grid grid-cols-9 gap-1">
                        {playerScores.slice(0, 17).map((score, idx) => (
                          <div key={idx} className="text-center">
                            <div className="text-[7px] font-bold text-slate-400 mb-0.5">G{idx + 1}</div>
                            {isMyTeam ? (
                              <input 
                                type="number" step="0.5" value={score || ""} 
                                onChange={(e) => updateSeasonPoint(player.id, idx + 1, e.target.value)} 
                                onBlur={(e) => saveSeasonPoints(player.id, idx + 1, e.target.value)}
                                className="w-full h-7 text-center font-black text-[9px] bg-slate-50 border border-slate-100 rounded-md focus:ring-1 focus:ring-slate-900" 
                                placeholder="0"
                              />
                            ) : (
                              <div className={cn("h-7 flex items-center justify-center font-black text-[9px] bg-slate-50 rounded-md", score > 0 ? "text-slate-900" : "text-slate-200")}>
                                {score || 0}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })}
            </div>

            {/* ── Desktop: Table View ── */}
            <div className="hidden sm:block bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
               <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[1200px]">
                     <thead className="bg-slate-50 sticky top-0 z-20">
                        <tr>
                           <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 sticky left-0 bg-slate-50 z-30 min-w-[240px]">Player Detail</th>
                           {[...Array(17)].map((_, i) => <th key={i} className="px-4 py-5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">G{i+1}</th>)}
                           <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-900 sticky right-0 bg-slate-50 z-30">Total</th>
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
                                                     type="number" step="0.5" value={score || ""} 
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
                                     <td className="px-8 py-4 sticky left-0 bg-slate-900 z-10 font-black text-[10px] uppercase tracking-widest opacity-60">Squad Total</td>
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

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB: STANDINGS (Analytics)                                     */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "standings" && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            
            {/* ── Analytics Charts ── */}
            {(() => {
              // Build per-game data for charts
              const TEAM_COLORS = ["#1e293b", "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];
              const maxGames = Math.max(...standings.map(s => s.matchesPlayed), 0);

              // Per-game scores per team
              const teamGameScores: Record<string, number[]> = {};
              standings.forEach(team => {
                const scores: number[] = [];
                const teamPlayers = allPlayers.filter(p => p.sold_to_id === team.id || p.sold_to === team.team_name);
                allMatches.slice(0, 17).forEach(m => {
                  let matchTotal = 0;
                  let hasData = false;
                  teamPlayers.forEach(player => {
                    const pt = allMatchPoints.find(p => p.player_id === player.id && p.match_id === m.id);
                    if (pt) { matchTotal += pt.points; hasData = true; }
                  });
                  scores.push(hasData ? matchTotal : 0);
                });
                teamGameScores[team.team_name] = scores;
              });

              // Cumulative data for area chart
              const cumulativeData = Array.from({ length: Math.max(maxGames, 1) }, (_, i) => {
                const row: any = { game: `G${i + 1}` };
                standings.forEach(team => {
                  const scores = teamGameScores[team.team_name] || [];
                  let cumulative = 0;
                  for (let j = 0; j <= i; j++) cumulative += (scores[j] || 0);
                  row[team.team_name] = cumulative;
                });
                return row;
              });

              // Per-game bar data
              const perGameData = Array.from({ length: Math.max(maxGames, 1) }, (_, i) => {
                const row: any = { game: `G${i + 1}` };
                standings.forEach(team => {
                  row[team.team_name] = (teamGameScores[team.team_name] || [])[i] || 0;
                });
                return row;
              });

              // Predicted final score (linear regression extrapolation to 17 games)
              const predictions = standings.map(team => {
                const scores = (teamGameScores[team.team_name] || []).filter(s => s !== 0);
                if (scores.length < 1) return { ...team, predicted: 0, trend: "neutral" as const };
                const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                // Simple trend: compare second half to first half
                const mid = Math.floor(scores.length / 2) || 1;
                const firstHalf = scores.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
                const secondHalf = scores.slice(mid).reduce((a, b) => a + b, 0) / (scores.length - mid);
                const trendFactor = firstHalf > 0 ? secondHalf / firstHalf : 1;
                const predicted = Math.round(avg * trendFactor * 17);
                const trend = trendFactor > 1.05 ? "up" as const : trendFactor < 0.95 ? "down" as const : "neutral" as const;
                return { ...team, predicted, trend };
              }).sort((a, b) => b.predicted - a.predicted);

              const maxPredicted = Math.max(...predictions.map(p => p.predicted), 1);

              return (
                <>
                  {/* Cumulative Points Chart */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm sm:text-base font-black uppercase italic tracking-tight text-slate-900">Points Progression</h3>
                        <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Cumulative score across games</p>
                      </div>
                      <TrendingUp className="h-5 w-5 text-blue-500" />
                    </div>
                    {maxGames > 0 ? (
                      <div className="w-full h-48 sm:h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={cumulativeData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                            <defs>
                              {standings.map((team, i) => (
                                <linearGradient key={team.id} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={TEAM_COLORS[i % TEAM_COLORS.length]} stopOpacity={0.3} />
                                  <stop offset="95%" stopColor={TEAM_COLORS[i % TEAM_COLORS.length]} stopOpacity={0} />
                                </linearGradient>
                              ))}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="game" tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} />
                            <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700 }} />
                            {standings.map((team, i) => (
                              <Area
                                key={team.id}
                                type="monotone"
                                dataKey={team.team_name}
                                stroke={TEAM_COLORS[i % TEAM_COLORS.length]}
                                fill={`url(#grad-${i})`}
                                strokeWidth={2.5}
                                dot={false}
                              />
                            ))}
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-48 flex items-center justify-center text-slate-300 font-bold text-sm">No game data yet</div>
                    )}
                    {/* Legend */}
                    <div className="flex flex-wrap gap-3 mt-3">
                      {standings.map((team, i) => (
                        <div key={team.id} className="flex items-center gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TEAM_COLORS[i % TEAM_COLORS.length] }} />
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{team.team_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Per-Game Bar Chart */}
                  {maxGames > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-sm sm:text-base font-black uppercase italic tracking-tight text-slate-900">Head-to-Head</h3>
                          <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Per-game comparison</p>
                        </div>
                        <BarChart3 className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div className="w-full h-48 sm:h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChartRecharts data={perGameData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="game" tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} />
                            <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700 }} />
                            {standings.map((team, i) => (
                              <Bar
                                key={team.id}
                                dataKey={team.team_name}
                                fill={TEAM_COLORS[i % TEAM_COLORS.length]}
                                radius={[4, 4, 0, 0]}
                                barSize={maxGames <= 3 ? 20 : undefined}
                              />
                            ))}
                          </BarChartRecharts>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Predicted Final Scores */}
                  <div className="bg-slate-900 rounded-2xl p-4 sm:p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h3 className="text-sm sm:text-base font-black uppercase italic tracking-tight text-white">Predicted Final</h3>
                        <p className="text-[8px] sm:text-[9px] font-bold text-white/40 uppercase tracking-widest mt-0.5">
                          Extrapolated to 17 games based on current trend
                        </p>
                      </div>
                      <Target className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div className="space-y-3">
                      {predictions.map((team, idx) => (
                        <div key={team.id} className="flex items-center gap-3">
                          <span className={cn(
                            "h-6 w-6 flex items-center justify-center rounded-lg font-black text-[10px] flex-shrink-0",
                            idx === 0 ? "bg-yellow-400 text-slate-900" : "bg-white/10 text-white/50"
                          )}>
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-black text-white uppercase truncate">{team.team_name}</span>
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-[9px] font-black uppercase",
                                  team.trend === "up" ? "text-emerald-400" : team.trend === "down" ? "text-red-400" : "text-white/30"
                                )}>
                                  {team.trend === "up" ? "↑ Trending Up" : team.trend === "down" ? "↓ Declining" : "→ Steady"}
                                </span>
                                <span className="text-sm font-black text-white">{team.predicted}</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-700",
                                  idx === 0 ? "bg-yellow-400" : idx <= 1 ? "bg-blue-400" : "bg-white/20"
                                )}
                                style={{ width: `${maxPredicted > 0 ? (team.predicted / maxPredicted) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {maxGames === 0 && (
                      <p className="text-white/30 text-xs font-bold text-center mt-4">No data yet — predictions appear after the first game</p>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Standings Table */}
            <Card className="bg-white border-slate-200 shadow-2xl rounded-2xl sm:rounded-[2.5rem] overflow-hidden">
               <CardHeader className="p-4 sm:p-8 border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="text-lg sm:text-2xl font-black uppercase italic tracking-tighter text-slate-900">Season Championship</CardTitle>
                  <CardDescription className="text-slate-400 font-bold uppercase text-[8px] sm:text-[9px] tracking-widest mt-1">Overall standings with deep analytics</CardDescription>
               </CardHeader>
               <CardContent className="p-0">
                  
                  {/* Mobile: Card view */}
                  <div className="block sm:hidden divide-y divide-slate-50">
                    {standings.map((team, idx) => (
                      <div key={team.id} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "h-8 w-8 flex items-center justify-center rounded-xl font-black text-xs",
                              idx === 0 ? "bg-slate-900 text-white shadow-lg" : idx <= 2 ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"
                            )}>
                              {idx + 1}
                            </span>
                            <div>
                              <div className="font-black italic uppercase text-sm text-slate-900">{team.team_name}</div>
                              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{team.squadSize} players • {team.matchesPlayed} games</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-black italic text-slate-900">{Math.floor(team.totalPoints)}</div>
                            <div className="text-[8px] font-black text-blue-500 uppercase">pts</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div className="bg-slate-50 rounded-lg p-2 text-center">
                            <div className="text-[7px] font-black text-slate-400 uppercase">Avg/Game</div>
                            <div className="text-xs font-black text-slate-900">{team.avgPerMatch}</div>
                          </div>
                          <div className="bg-emerald-50 rounded-lg p-2 text-center">
                            <div className="text-[7px] font-black text-emerald-500 uppercase">Best</div>
                            <div className="text-xs font-black text-emerald-700">{team.bestMatch}</div>
                          </div>
                          <div className="bg-red-50 rounded-lg p-2 text-center">
                            <div className="text-[7px] font-black text-red-400 uppercase">Worst</div>
                            <div className="text-xs font-black text-red-600">{team.worstMatch}</div>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-2 text-center">
                            <div className="text-[7px] font-black text-blue-400 uppercase">σ Dev</div>
                            <div className="text-xs font-black text-blue-700">{team.consistency}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: Full table */}
                  <table className="w-full text-left border-collapse hidden sm:table">
                     <thead className="bg-slate-50">
                        <tr>
                           <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Rank</th>
                           <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Franchise</th>
                           <th className="px-6 py-5 text-center text-[10px] font-black uppercase text-slate-400">Squad</th>
                           <th className="px-6 py-5 text-center text-[10px] font-black uppercase text-slate-400">Games</th>
                           <th className="px-6 py-5 text-center text-[10px] font-black uppercase text-slate-400">Avg/Game</th>
                           <th className="px-6 py-5 text-center text-[10px] font-black uppercase text-emerald-500">Best</th>
                           <th className="px-6 py-5 text-center text-[10px] font-black uppercase text-red-400">Worst</th>
                           <th className="px-6 py-5 text-center text-[10px] font-black uppercase text-blue-500">σ Dev</th>
                           <th className="px-8 py-5 text-right text-[10px] font-black uppercase text-slate-900">Total</th>
                        </tr>
                     </thead>
                     <tbody>
                        {standings.map((team, idx) => (
                           <tr key={team.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="px-8 py-6">
                                 <span className={cn(
                                   "h-10 w-10 flex items-center justify-center rounded-2xl font-black text-sm",
                                   idx === 0 ? "bg-slate-900 text-white rotate-3 shadow-xl" : idx <= 2 ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"
                                 )}>
                                    {idx + 1}
                                 </span>
                              </td>
                              <td className="px-8 py-6">
                                 <div className="flex items-center gap-4">
                                    <div className="h-11 w-11 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-lg">
                                       {team.team_name?.charAt(0)}
                                    </div>
                                    <div>
                                       <div className="font-black italic uppercase text-slate-900 text-base leading-none">{team.team_name}</div>
                                       <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{team.full_name}</div>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-6 py-6 text-center font-black text-sm text-slate-500">{team.squadSize}</td>
                              <td className="px-6 py-6 text-center font-black text-sm text-slate-500">{team.matchesPlayed}</td>
                              <td className="px-6 py-6 text-center font-black text-sm text-blue-600">{team.avgPerMatch}</td>
                              <td className="px-6 py-6 text-center font-black text-sm text-emerald-600">{team.bestMatch}</td>
                              <td className="px-6 py-6 text-center font-black text-sm text-red-500">{team.worstMatch}</td>
                              <td className="px-6 py-6 text-center font-black text-sm text-blue-500">{team.consistency}</td>
                              <td className="px-8 py-6 text-right">
                                 <div className="font-black italic text-3xl text-slate-900 tracking-tighter">{Math.floor(team.totalPoints)}</div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </CardContent>
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB: FIXTURES (from DB)                                       */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "fixtures" && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            
            {/* Stats & Filters */}
            <div className="bg-white rounded-2xl sm:rounded-[2rem] border border-slate-200 p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base sm:text-xl font-black italic uppercase tracking-tighter">IPL 2026 Schedule</h2>
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    {completedFixtures} of {fixtures.length} completed
                  </p>
                  {/* Progress bar */}
                  <div className="w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all" 
                      style={{ width: `${fixtures.length > 0 ? (completedFixtures / fixtures.length) * 100 : 0}%` }} 
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {([
                    { key: "all" as const, label: "All", count: fixtures.length },
                    { key: "upcoming" as const, label: "Upcoming", count: fixtures.length - completedFixtures },
                    { key: "completed" as const, label: "Done", count: completedFixtures },
                  ]).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setFixtureFilter(tab.key)}
                      className={cn(
                        "px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-xs font-bold transition-all",
                        fixtureFilter === tab.key
                          ? "bg-slate-900 text-white shadow-lg"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      )}
                    >
                      {tab.label} <span className="ml-1 opacity-60">{tab.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Today's Match Highlight */}
              {todayFixtures.length > 0 && fixtureFilter !== "completed" && (
                <div className="mt-4 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-xl sm:rounded-2xl">
                  <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2">🏏 Today's Match{todayFixtures.length > 1 ? "es" : ""}</div>
                  {todayFixtures.map(m => (
                    <div key={m.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3">
                        {m.team1_img && <img src={m.team1_img} alt="" className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg object-contain bg-white p-0.5 border" />}
                        <span className="font-black text-sm sm:text-base text-slate-900">{cleanShort(m.team1_short)}</span>
                        <span className="text-xs font-bold text-blue-400 mx-1">vs</span>
                        <span className="font-black text-sm sm:text-base text-slate-900">{cleanShort(m.team2_short)}</span>
                        {m.team2_img && <img src={m.team2_img} alt="" className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg object-contain bg-white p-0.5 border" />}
                      </div>
                      <div className="text-[10px] font-bold text-blue-500">{formatTime(m.date_time_gmt)} IST</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fixture List — Grouped by Date */}
            <div className="space-y-4 sm:space-y-6">
              {groupedFixtures.map(([date, matches]) => {
                const isToday = date === today;
                const isPast = date < today;

                return (
                  <div key={date}>
                    {/* Date divider */}
                    <div className="flex items-center gap-3 mb-2 sm:mb-3 px-1">
                      <div className={cn(
                        "text-[9px] sm:text-xs font-black uppercase tracking-widest px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg",
                        isToday ? "bg-blue-600 text-white shadow-md shadow-blue-200" : isPast ? "bg-slate-200 text-slate-500" : "bg-slate-100 text-slate-600"
                      )}>
                        {isToday ? "🏏 Today" : formatDate(date)}
                      </div>
                      {isToday && <span className="text-xs font-bold text-blue-600 animate-pulse">{formatDate(date)}</span>}
                      <div className="flex-1 border-t border-dashed border-slate-200" />
                    </div>

                    {/* Match cards */}
                    <div className="space-y-2 sm:space-y-3">
                      {matches.map(match => {
                        const isMatchToday = match.match_date === today;
                        const isCompleted = match.match_ended || match.match_date < today;

                        return (
                          <div
                            key={match.id}
                            className={cn(
                              "relative bg-white rounded-xl sm:rounded-2xl border overflow-hidden transition-all",
                              isMatchToday && !isCompleted
                                ? "border-blue-200 shadow-lg shadow-blue-100 ring-2 ring-blue-100"
                                : isCompleted
                                  ? "border-slate-100 opacity-70"
                                  : "border-slate-100 shadow-sm hover:shadow-md"
                            )}
                          >
                            <div className="p-3 sm:p-5">
                              {/* Match no + status */}
                              <div className="flex items-center justify-between mb-2 sm:mb-3">
                                <div className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  Match {match.match_no}
                                </div>
                                {isCompleted && (
                                  <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase">
                                    <Trophy className="h-3 w-3" /> Done
                                  </div>
                                )}
                              </div>

                              {/* Teams */}
                              <div className="flex items-center justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {match.team1_img && (
                                    <img src={match.team1_img} alt="" className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl object-contain bg-slate-50 border p-0.5 flex-shrink-0" />
                                  )}
                                  <span className="text-sm sm:text-base font-black uppercase text-slate-900 truncate">{cleanShort(match.team1_short) || match.team1_name}</span>
                                </div>

                                <div className={cn(
                                  "text-[10px] sm:text-xs font-black uppercase px-2.5 sm:px-3 py-1 rounded-lg sm:rounded-xl flex-shrink-0",
                                  isMatchToday && !isCompleted ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-400"
                                )}>
                                  VS
                                </div>

                                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                                  <span className="text-sm sm:text-base font-black uppercase text-slate-900 truncate">{cleanShort(match.team2_short) || match.team2_name}</span>
                                  {match.team2_img && (
                                    <img src={match.team2_img} alt="" className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl object-contain bg-slate-50 border p-0.5 flex-shrink-0" />
                                  )}
                                </div>
                              </div>

                              {/* Meta & Actions */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-50">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] sm:text-[10px] font-bold text-slate-400">
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatTime(match.date_time_gmt)} IST
                                  </div>
                                  {match.venue && (
                                    <div className="flex items-center gap-1 truncate">
                                      <MapPin className="h-3 w-3 flex-shrink-0" />
                                      <span className="truncate">{match.venue.split(",")[0]}</span>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Scorecard Action */}
                                {(() => {
                                  const matchDate = new Date(match.date_time_gmt);
                                  const expectedEndTime = new Date(matchDate.getTime() + 4 * 60 * 60 * 1000); // Start + 4 hours
                                  const now = new Date();
                                  const hasEndedPassed = now > expectedEndTime || match.match_ended;

                                  if (hasEndedPassed && match.api_match_id) {
                                    return (
                                      <a
                                        href={`/test-scorecard?id=${match.api_match_id}`}
                                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] sm:text-xs font-black uppercase rounded-lg transition-colors"
                                      >
                                        <Trophy className="h-3 w-3 text-yellow-500" /> Player Points
                                      </a>
                                    );
                                  }

                                  const expectedTimeStr = expectedEndTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
                                  return (
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 text-[9px] sm:text-[10px] font-black uppercase rounded-lg">
                                      <Clock className="h-3 w-3" /> Points update near {expectedTimeStr}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {filteredFixtures.length === 0 && (
                <div className="text-center py-16">
                  <Calendar className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-lg font-black text-slate-300 uppercase tracking-tight">No matches found</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
