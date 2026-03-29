"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart as BarChartRecharts, Bar, PieChart, Pie, Cell, Legend
} from "recharts";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger 
} from "@/components/ui/dialog";
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
// Removed syncMatchScores import since lib/cricapi was deleted
import { useAuth } from "@/components/auth/AuthProvider";
import React from "react";
import ScorecardViewer from "@/components/scoreboard/ScorecardViewer";

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
  scorecard: any | null;
}

function getTodayIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().split("T")[0];
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(dateTimeGMT: string): string {
  if (!dateTimeGMT) return "";
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
  const [pendingEdits, setPendingEdits] = useState<Record<string, { player_id: string, match_id: string, points: number }>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"sheets" | "standings" | "fixtures">("sheets");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [analyticsTeamId, setAnalyticsTeamId] = useState<string | null>(null);
  const [standings, setStandings] = useState<any[]>([]);
  const [allMatchPoints, setAllMatchPoints] = useState<any[]>([]);
  const [expandedScorecardId, setExpandedScorecardId] = useState<string | null>(null);
  const [expandedPointsId, setExpandedPointsId] = useState<string | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  const [scorecardMatch, setScorecardMatch] = useState<Fixture | null>(null);

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
    if (activeTab === "standings") fetchStandingsData();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "sheets" && selectedTeamId) fetchTeamData(selectedTeamId);
  }, [activeTab, selectedTeamId]);

  // Fetch fixtures from DB when tab is activated
  useEffect(() => {
    if (activeTab === "fixtures") {
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
      if (authProfile) setProfile(authProfile);

      // Lightweight initial load
      const [teamsRes, matchesRes] = await Promise.all([
        supabase.from("profiles").select("*").neq("role", "Viewer").order("team_name", { ascending: true }),
        supabase.from("matches").select("*").order("match_no", { ascending: true })
      ]);
      
      const teamsData = teamsRes.data || [];
      setFranchises(teamsData);

      if (authProfile) setSelectedTeamId(authProfile.id);
      else if (teamsData.length > 0) setSelectedTeamId(teamsData[0].id);

      if (matchesRes.data) {
        setAllMatches(matchesRes.data);
        const nextMatch = matchesRes.data.find(m => m.status === 'live' || m.status === 'scheduled') || matchesRes.data[0];
        if (nextMatch) setSelectedMatchId(nextMatch.id);
      }

      dataLoadedRef.current = true;
    } catch (error) {
      console.error("Error fetching initial scoreboard data:", error);
    } finally {
      // Ensure loading is ALWAYS set to false to prevent infinite loops
      setTimeout(() => setLoading(false), 300); 
    }
  };

  const fetchTeamData = async (teamId: string) => {
    if (!teamId) return;
    try {
      setSubLoading(true);
      // Only fetch players for THIS team
      const { data: teamPlayers } = await supabase
        .from("players")
        .select("*")
        .eq("sold_to_id", teamId)
        .order("player_name", { ascending: true });
      
      setAllPlayers(teamPlayers || []);
      
      // Fetch points for these players across all matches
      const playerIds = teamPlayers?.map(p => p.id) || [];
      if (playerIds.length > 0) {
        /* 
        COMMENTED OUT: We are calculating points on the UI only for now
        const { data: pts } = await supabase
          .from("match_points")
          .select("*")
          .in("player_id", playerIds);
        setAllMatchPoints(pts || []);
        */
        setAllMatchPoints([]);
      }
    } catch (error) {
      console.error("Error loading team data:", error);
    } finally {
      setSubLoading(false);
    }
  };

  const fetchStandingsData = async () => {
    try {
      setTabLoading(true);
      // For standings we need ALL points, but we can aggregate later
      /* 
      COMMENTED OUT: We are calculating points on the UI only for now
      const { data: allPts } = await supabase.from("match_points").select("player_id, match_id, points");
      setAllMatchPoints(allPts || []);
      */
      setAllMatchPoints([]);
      
      // We also need all sold players to map them to teams
      const { data: soldPlayers } = await supabase.from("players").select("id, sold_to_id, team_name").eq("auction_status", "sold");
      setAllPlayers(soldPlayers || []);
      
      calculateStandings(soldPlayers || [], []);
    } catch (err) {
      console.error("Standings error:", err);
    } finally {
      setTabLoading(false);
    }
  };

  const fetchMatchSpecificData = async (matchId: string) => {
    try {
      /*
      COMMENTED OUT: We are calculating points on the UI only for now
      const { data: ptsData } = await supabase
        .from("match_points")
        .select("*")
        .eq("match_id", matchId);
      
      const pointsMap: Record<string, number> = {};
      ptsData?.forEach(p => { pointsMap[p.player_id] = p.points; });
      setMatchPoints(pointsMap);
      setDetailedMatchPoints(ptsData || []);
      */
      setMatchPoints({});
      setDetailedMatchPoints([]);

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

    // Track pending edit
    setPendingEdits(prev => ({
      ...prev,
      [`${playerId}_${match.id}`]: { player_id: playerId, match_id: match.id, points }
    }));

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

  const handleBulkSave = async () => {
    const edits = Object.values(pendingEdits);
    if (edits.length === 0) return;
    
    setSaving(true);
    const { error } = await supabase
      .from("match_points")
      .upsert(edits, { onConflict: "player_id,match_id" });
      
    if (error) {
      console.error("Error bulk saving points:", error);
      alert("Failed to save some points.");
    } else {
      setPendingEdits({});
    }
    setSaving(false);
  };

  const calculateStandings = (playersSource?: any[], pointsSource?: any[]) => {
    const players = playersSource || allPlayers;
    const points = pointsSource || allMatchPoints;
    
    const standingsData = franchises.map(team => {
      let totalPoints = 0;
      let matchesPlayed = 0;
      let bestMatch = 0;
      let worstMatch = Infinity;
      const matchScores: number[] = [];
      const teamPlayers = players.filter(p => p.sold_to_id === team.id || p.sold_to === team.team_name);
      
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
    alert("CricAPI sync is disabled. Use the Python sync engine to update scores from ESPN.");
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
  const selectedMatch = allMatches.find(m => m.id === selectedMatchId);
  const completedFixturesCount = fixtures.filter(f => f.match_ended || f.match_date < today).length;
  const todayFixtures = fixtures.filter(f => f.match_date === today);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
       <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-slate-900 animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Booting Analytics...</p>
       </div>
    </div>
  );

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

             {/* ── Table View  ── */}
             <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden relative">
                {subLoading && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-40 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                       <Loader2 className="h-10 w-10 text-slate-900 animate-spin" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Squad...</span>
                    </div>
                  </div>
                )}
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
                             const filteredPlayers = allPlayers
                               .filter(p => (p.sold_to_id === team.id || p.sold_to === team.team_name) && p.player_name.toLowerCase().includes(searchQuery.toLowerCase()))
                               .sort((a, b) => (a.team || "").localeCompare(b.team || ""));
                             
                             if (filteredPlayers.length === 0 && !subLoading) return (
                               <tr key="empty"><td colSpan={19} className="py-20 text-center text-slate-300 font-bold uppercase tracking-widest">No Players Found</td></tr>
                             );
                             
                             const colTotals = Array(17).fill(0);

                           return (
                              <React.Fragment key={team.id}>
                                 {filteredPlayers.map(player => {
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
                                                <div className="h-9 w-9 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-100 italic flex items-center justify-center">
                                                   {player.image_url ? (
                                                      <img src={getPlayerImage(player.image_url)!} className="w-full h-full object-cover object-top" />
                                                   ) : <User size={16} className="text-slate-200" />}
                                                </div>
                                                <div className="min-w-0">
                                                   <div className="font-bold text-slate-900 truncate text-xs">{player.player_name}</div>
                                                   <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{player.role}</div>
                                                </div>
                                             </div>
                                          </td>
                                          {playerScores.map((score, idx) => {
                                             const matchObj = allMatches.find(m => m.match_no === idx + 1);
                                             const isDirty = matchObj && pendingEdits[`${player.id}_${matchObj.id}`] !== undefined;
                                             
                                             return (
                                               <td key={idx} className="px-2 py-4 text-center">
                                                  {isMyTeam ? (
                                                     <Input 
                                                       type="number" step="0.5" value={score || ""} 
                                                       onChange={(e) => updateSeasonPoint(player.id, idx + 1, e.target.value)} 
                                                       className={cn(
                                                         "h-8 w-16 mx-auto text-center font-black text-[10px] border-none rounded-lg focus:ring-1 focus:ring-slate-900 transition-colors",
                                                         isDirty ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300 shadow-inner" : "bg-slate-50 focus:bg-white"
                                                       )} 
                                                       placeholder="0"
                                                     />
                                                  ) : (
                                                     <span className={cn("font-black text-[10px]", score > 0 ? "text-slate-900" : "text-slate-200")}>{String(score || 0)}</span>
                                                  )}
                                               </td>
                                             );
                                          })}
                                          <td className="px-8 py-4 text-right font-black italic text-sm text-slate-900 sticky right-0 bg-white group-hover:bg-slate-50 border-l border-slate-100 z-10">
                                             <div className="text-sm font-black italic text-slate-900 leading-none">{String(rowTotal % 1 === 0 ? rowTotal : rowTotal.toFixed(1))}</div>
                                             <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Points</div>
                                          </td>
                                       </tr>
                                     );
                                  })}
                                  <tr className="bg-slate-900 text-white">
                                     <td className="px-8 py-4 sticky left-0 bg-slate-900 z-10 font-black text-[10px] uppercase tracking-widest opacity-60">Squad Total</td>
                                     {colTotals.map((t, i) => <td key={i} className="px-4 py-4 text-center font-black text-[11px] underline underline-offset-4 decoration-white/20">{String(t)}</td>)}
                                     <td className="px-8 py-4 text-right font-black italic text-xl sticky right-0 bg-slate-900 z-10">{String(colTotals.reduce((a, b) => a + b, 0))}</td>
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
             <Card className="bg-white border-slate-200 shadow-2xl rounded-2xl sm:rounded-[2.5rem] overflow-hidden relative">
                {tabLoading && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-40 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                       <Loader2 className="h-10 w-10 text-slate-900 animate-spin" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recalculating Standings...</span>
                    </div>
                  </div>
                )}
                <CardHeader className="p-4 sm:p-8 border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="text-lg sm:text-2xl font-black uppercase italic tracking-tighter text-slate-900">Season Championship</CardTitle>
                  <CardDescription className="text-slate-400 font-bold uppercase text-[8px] sm:text-[9px] tracking-widest mt-1">Overall standings with deep analytics</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead className="bg-slate-50">
                        <tr>
                           <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Rank</th>
                           <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Franchise</th>
                           <th className="px-6 py-5 text-center text-[10px] font-black uppercase text-slate-400">Squad</th>
                           <th className="px-6 py-5 text-center text-[10px] font-black uppercase text-slate-400">Games</th>
                           <th className="px-8 py-5 text-right text-[10px] font-black uppercase text-slate-900">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((team, idx) => (
                           <tr key={team.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="px-8 py-6">
                                 <span className={cn(
                                   "h-10 w-10 flex items-center justify-center rounded-2xl font-black text-sm",
                                   idx === 0 ? "bg-slate-900 text-white shadow-xl" : "bg-slate-100 text-slate-400"
                                 )}>
                                    {idx + 1}
                                 </span>
                              </td>
                              <td className="px-8 py-6">
                                 <div className="font-black italic uppercase text-slate-900 text-base">{team.team_name}</div>
                              </td>
                              <td className="px-6 py-6 text-center font-black text-sm text-slate-500">{String(team.squadSize)}</td>
                              <td className="px-6 py-6 text-center font-black text-sm text-slate-500">{String(team.matchesPlayed)}</td>
                              <td className="px-8 py-6 text-right">
                                 <div className="font-black italic text-3xl text-slate-900 tracking-tighter">{String(Math.floor(team.totalPoints))}</div>
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
        {/* TAB: FIXTURES                                                 */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "fixtures" && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
             {/* Stats & Filters */}
             <div className="bg-white rounded-2xl sm:rounded-[2rem] border border-slate-200 p-4 sm:p-6 shadow-sm">
               <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                 <div>
                   <h2 className="text-base sm:text-xl font-black italic uppercase tracking-tighter">IPL 2026 Schedule</h2>
                   <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                     {completedFixturesCount} of {fixtures.length} completed
                   </p>
                 </div>
                 <div className="flex gap-2">
                   {([
                     { key: "all" as const, label: "All" },
                     { key: "upcoming" as const, label: "Upcoming" },
                     { key: "completed" as const, label: "Done" },
                   ]).map(tab => (
                     <button
                       key={tab.key}
                       onClick={() => setFixtureFilter(tab.key)}
                       className={cn(
                         "px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-xs font-bold transition-all",
                         fixtureFilter === tab.key ? "bg-slate-900 text-white shadow-lg" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                       )}
                     >
                       {tab.label}
                     </button>
                   ))}
                 </div>
               </div>
             </div>

             <div className="space-y-4">
               {groupedFixtures.map(([date, matches]) => (
                  <div key={date} className="space-y-2">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{formatDate(date)}</div>
                    {matches.map(match => (
                       <div key={match.id} className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-sm">
                          <div className="flex items-center justify-between gap-4">
                             <div className="flex items-center gap-4 flex-1">
                                <div className="h-10 w-10 flex items-center justify-center bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
                                   <img src={getPlayerImage(match.team1_img) || ""} className="w-full h-full object-contain p-1" />
                                </div>
                                <div className="font-black uppercase text-slate-900 text-sm">{cleanShort(match.team1_short)}</div>
                             </div>
                             <div className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase italic">VS</div>
                             <div className="flex items-center gap-4 flex-1 justify-end text-right">
                                <div className="font-black uppercase text-slate-900 text-sm">{cleanShort(match.team2_short)}</div>
                                <div className="h-10 w-10 flex items-center justify-center bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
                                   <img src={getPlayerImage(match.team2_img) || ""} className="w-full h-full object-contain p-1" />
                                </div>
                             </div>
                          </div>

                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
                             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatTime(match.date_time_gmt)} • {match.venue?.split(',')[0]}</div>
                             
                             {match.match_ended ? (
                               <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setExpandedScorecardId(expandedScorecardId === match.api_match_id ? null : match.api_match_id)}
                                    className="h-8 text-[9px] font-black uppercase tracking-widest"
                                  >
                                    View Scorecard
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setExpandedPointsId(expandedPointsId === match.api_match_id ? null : match.api_match_id)}
                                    className="h-8 text-[9px] font-black uppercase tracking-widest border-amber-200 text-amber-600"
                                  >
                                    View Points
                                  </Button>
                               </div>
                             ) : (
                               <div className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-md uppercase">Scores Pending</div>
                             )}
                          </div>

                          {/* Scorecard Modal */}
                          <Dialog open={expandedScorecardId === match.api_match_id} onOpenChange={(open) => setExpandedScorecardId(open ? match.api_match_id : null)}>
                             <DialogContent className="max-w-4xl bg-[#F8FAFC] border-0 shadow-2xl p-0 rounded-[2rem] overflow-hidden">
                               <DialogHeader className="bg-slate-900 p-6 sm:p-8 text-white">
                                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                   <div className="flex items-center gap-3">
                                     <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                                       <Shield size={20} className="text-white" />
                                     </div>
                                     <div>
                                        <DialogTitle className="text-xl sm:text-2xl font-black uppercase tracking-tighter leading-none">Complete Scorecard</DialogTitle>
                                        <DialogDescription className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-1 opacity-80">
                                          {match.title} • {formatDate(match.match_date)}
                                        </DialogDescription>
                                     </div>
                                   </div>
                                 </div>
                               </DialogHeader>
                               <div className="p-4 sm:p-8 max-h-[75vh] overflow-y-auto no-scrollbar">
                                 <ScorecardViewer scorecard={match.scorecard as any} />
                               </div>
                             </DialogContent>
                          </Dialog>

                          {/* Match Points Modal (ON-THE-FLY CALCULATIONS) */}
                          <Dialog open={expandedPointsId === match.api_match_id} onOpenChange={(open) => setExpandedPointsId(open ? match.api_match_id : null)}>
                               <DialogContent className="max-w-2xl bg-white border-0 shadow-2xl p-0 rounded-[2rem] overflow-hidden">
                                 <DialogHeader className="bg-amber-600 p-6 sm:p-8 text-white">
                                   <div className="flex items-center gap-3 mb-2">
                                     <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                                       <Trophy size={20} className="text-white" />
                                     </div>
                                     <div>
                                        <DialogTitle className="text-xl sm:text-2xl font-black uppercase tracking-tighter leading-none">Match Analytics</DialogTitle>
                                        <DialogDescription className="text-amber-100 font-bold uppercase text-[9px] tracking-widest mt-1 opacity-80">
                                          Fantasy Point Summary • {match.team1_short} vs {match.team2_short}
                                        </DialogDescription>
                                     </div>
                                   </div>
                                 </DialogHeader>
                                 <div className="p-4 sm:p-8 max-h-[60vh] overflow-y-auto no-scrollbar">
                                   <div className="overflow-hidden border border-slate-100 rounded-2xl bg-white shadow-sm">
                                      <table className="w-full text-left border-collapse">
                                         <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                               <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Player</th>
                                               <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase text-center">R</th>
                                               <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase text-center">W</th>
                                               <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase text-center">F</th>
                                               <th className="px-4 py-3 text-[11px] font-black text-slate-900 uppercase text-right">Points</th>
                                            </tr>
                                         </thead>
                                         <tbody className="divide-y divide-slate-50">
                                            {(() => {
                                               if (!match.scorecard || !match.scorecard.innings) {
                                                 return <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-bold italic uppercase text-[10px]">No scorecard available</td></tr>;
                                               }
                                               
                                               const playersStats: Record<string, any> = {};
                                               const sc = match.scorecard as any;
                                               
                                               sc.innings.forEach((inn: any) => {
                                                  // Batting Aggregation
                                                  (inn.batting || []).forEach((b: any) => {
                                                     if (!b.player || b.player === "BATTING") return;
                                                     const name = b.player.replace(/[†(c)]/g, "").trim();
                                                     if (!playersStats[name]) {
                                                        playersStats[name] = { player_name: name, runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, catches: 0, stumpings: 0, maidens: 0, sr: 0, econ: 0, overs: 0, is_duck: false, role: 'Batter' };
                                                     }
                                                     playersStats[name].runs += (Number(b.R) || 0);
                                                     playersStats[name].balls += (Number(b.B) || 0);
                                                     playersStats[name].fours += (Number(b['4s']) || 0);
                                                     playersStats[name].sixes += (Number(b['6s']) || 0);
                                                     playersStats[name].sr = (Number(b.SR) || 0);
                                                     if ((Number(b.R) || 0) === 0 && !(b.dismissal || "").toLowerCase().includes("not out")) playersStats[name].is_duck = true;
                                                     if (b.player.includes('†')) playersStats[name].role = 'WK';
                                                  });
                                                  // Bowling Aggregation
                                                  (inn.bowling || []).forEach((bw: any) => {
                                                     if (!bw.bowler || bw.bowler === "BOWLING") return;
                                                     const name = bw.bowler.replace(/[†(c)]/g, "").trim();
                                                     if (!playersStats[name]) {
                                                        playersStats[name] = { player_name: name, runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, catches: 0, stumpings: 0, maidens: 0, sr: 0, econ: 0, overs: 0, is_duck: false, role: 'Bowler' };
                                                     }
                                                     playersStats[name].wickets += (Number(bw.W) || 0);
                                                     playersStats[name].maidens += (Number(bw.M) || 0);
                                                     playersStats[name].overs += (Number(bw.O) || 0);
                                                     playersStats[name].econ = (Number(bw.ECON) || 0);
                                                     if (playersStats[name].role === 'Batter') playersStats[name].role = 'All-Rounder';
                                                  });
                                               });
                                               
                                               // Fielding Aggregation from ALL innings dismissals
                                               sc.innings.forEach((innD: any) => {
                                                  (innD.batting || []).forEach((bD: any) => {
                                                     const dText = (bD.dismissal || "").toLowerCase();
                                                     Object.keys(playersStats).forEach(n => {
                                                        if (dText.includes(`c ${n.toLowerCase()}`) || dText.includes(`c †${n.toLowerCase()}`)) playersStats[n].catches++;
                                                        if (dText.includes(`st †${n.toLowerCase()}`)) playersStats[n].stumpings++;
                                                     });
                                                  });
                                               });
                                               
                                               // Final Calculation
                                               const pointsArr = Object.values(playersStats).map(p => {
                                                  const d11 = {
                                                     runs: p.runs, balls: p.balls, fours: p.fours, sixes: p.sixes,
                                                     wickets: p.wickets, lbwBowled: 0, maidens: p.maidens, dotBalls: 0,
                                                     catches: p.catches, stumpings: p.stumpings, runOutDirect: 0, runOutIndirect: 0,
                                                     economyRate: p.econ, strikeRate: p.sr, oversMoved: p.overs,
                                                     isDuck: p.is_duck, isAnnounced: true, role: p.role as any
                                                  };
                                                  const totalPoints = calculateDream11Points(d11);
                                                  return { ...p, points: totalPoints };
                                               }).sort((a,b) => b.points - a.points);
                                               
                                               return pointsArr.map((p, idx) => (
                                                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                     <td className="px-4 py-3">
                                                        <div className="text-xs font-black text-slate-900 uppercase leading-none">{p.player_name}</div>
                                                        <div className="text-[9px] font-bold text-slate-400 uppercase mt-1">{p.role}</div>
                                                     </td>
                                                     <td className="px-3 py-3 text-xs font-black text-slate-600 text-center">{String(p.runs)}</td>
                                                     <td className="px-3 py-3 text-xs font-black text-slate-600 text-center">{String(p.wickets)}</td>
                                                     <td className="px-3 py-3 text-xs font-black text-slate-600 text-center">{String(p.catches + p.stumpings)}</td>
                                                     <td className="px-4 py-3 text-sm font-black text-amber-600 text-right">{String(Math.round(p.points))}</td>
                                                  </tr>
                                               ));
                                            })()}
                                         </tbody>
                                      </table>
                                   </div>
                                 </div>
                               </DialogContent>
                          </Dialog>
                       </div>
                    ))}
                  </div>
               ))}
             </div>
          </div>
        )}

      </div>
    </div>
  );
}
