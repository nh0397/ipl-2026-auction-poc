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
import { useAuth } from "@/components/auth/AuthProvider";
import React from "react";
import ScorecardViewer from "@/components/scoreboard/ScorecardViewer";
import { ScoringRulesLegend } from "@/components/rules/ScoringRulesLegend";

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

function cleanShort(short: string | null): string {
  if (!short) return "";
  return short.endsWith("W") && short.length > 2 ? short.slice(0, -1) : short;
}

// ─── Constants ───
const TEAM_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#ef4444", "#06b6d4", "#f97316"];

// ─── Main page ──────────────────────────────────────────────────────
export default function ScoreboardPage() {
  const { user, profile: authProfile, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);

  // Auth Guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  const [allMatches, setAllMatches] = useState<any[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
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
  const [showBreakdownId, setShowBreakdownId] = useState<string | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);

  const [showRules, setShowRules] = useState(false);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [fixtureFilter, setFixtureFilter] = useState<"all" | "upcoming" | "completed">("all");
  const today = useMemo(() => getTodayIST(), []);

  useEffect(() => { if (authProfile) setProfile(authProfile); }, [authProfile]);
  useEffect(() => { fetchInitialData(); }, []);
  useEffect(() => { if (selectedMatchId) fetchMatchSpecificData(selectedMatchId); }, [selectedMatchId]);
  useEffect(() => { if (activeTab === "standings") fetchStandingsData(); }, [activeTab]);
  useEffect(() => { if (activeTab === "sheets" && selectedTeamId) fetchTeamData(selectedTeamId); }, [activeTab, selectedTeamId]);
  useEffect(() => { if (activeTab === "fixtures") fetchFixtures(); }, [activeTab]);

  const fetchFixtures = async () => {
    const { data } = await supabase.from("fixtures").select("*").order("match_no", { ascending: true });
    if (data) setFixtures(data);
  };

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [teamsRes, matchesRes] = await Promise.all([
        supabase.from("profiles").select("*").neq("role", "Viewer").order("team_name", { ascending: true }),
        supabase.from("matches").select("*").order("match_no", { ascending: true })
      ]);
      const teamsData = teamsRes.data || [];
      setFranchises(teamsData);
      if (authProfile) setSelectedTeamId(authProfile.id); else if (teamsData.length > 0) setSelectedTeamId(teamsData[0].id);
      if (matchesRes.data) {
        setAllMatches(matchesRes.data);
        const nextMatch = matchesRes.data.find(m => m.status === 'live' || m.status === 'scheduled') || matchesRes.data[0];
        if (nextMatch) setSelectedMatchId(nextMatch.id);
      }
    } finally { setTimeout(() => setLoading(false), 300); }
  };

  const fetchTeamData = async (teamId: string) => {
    if (!teamId) return;
    setSubLoading(true);
    const { data: teamPlayers } = await supabase.from("players").select("*").eq("sold_to_id", teamId);
    setAllPlayers(teamPlayers || []);
    setAllMatchPoints([]);
    setSubLoading(false);
  };

  const fetchStandingsData = async () => {
    setTabLoading(true);
    const { data: soldPlayers } = await supabase.from("players").select("id, sold_to_id, team_name, player_name, role").eq("auction_status", "sold");
    setAllPlayers(soldPlayers || []);
    
    // Restoration of persistent fetch
    const { data: pts } = await supabase.from("match_points").select("*");
    setAllMatchPoints(pts || []);
    
    calculateStandings(soldPlayers || [], pts || []);
    setTabLoading(false);
  };

  const calculateStandings = (players: any[], points: any[]) => {
    const standingsData = franchises.map(team => {
      let totalPoints = 0;
      let matchesPlayed = 0;
      let bestMatch = 0;
      let worstMatch = Infinity;
      const matchScores: number[] = [];
      const teamPlayers = players.filter(p => p.sold_to_id === team.id || p.sold_to === team.team_name);
      
      allMatches.forEach(m => {
        let matchTotal = 0; let matchHasPoints = false;
        teamPlayers.forEach(player => {
          const ptRecord = points?.find(p => p.player_id === player.id && p.match_id === m.id);
          if (ptRecord) { matchHasPoints = true; matchTotal += ptRecord.points; }
        });
        if (matchHasPoints) {
          matchesPlayed++; totalPoints += matchTotal; matchScores.push(matchTotal);
          if (matchTotal > bestMatch) bestMatch = matchTotal; if (matchTotal < worstMatch) worstMatch = matchTotal;
        }
      });
      return {
        ...team, totalPoints, matchesPlayed: Math.min(matchesPlayed, 17),
        bestMatch: matchesPlayed > 0 ? bestMatch : 0, worstMatch: worstMatch === Infinity ? 0 : worstMatch,
        avgPerMatch: matchesPlayed > 0 ? Math.round((totalPoints / matchesPlayed) * 10) / 10 : 0, squadSize: teamPlayers.length,
      };
    }).sort((a,b) => b.totalPoints - a.totalPoints);
    setStandings(standingsData);
  };

  const fetchMatchSpecificData = async (matchId: string) => {
    const { data } = await supabase.from("nominations").select("*").eq("match_id", matchId);
    setAllNominations(data || []);
  };

  const updateSeasonPoint = async (pId: string, mNo: number, val: string) => {
    const pts = parseFloat(val) || 0;
    const match = allMatches.find(m => m.match_no === mNo);
    if (!match) return;
    setPendingEdits(prev => ({ ...prev, [`${pId}_${match.id}`]: { player_id: pId, match_id: match.id, points: pts } }));
  };

  const handleBulkSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("match_points").upsert(Object.values(pendingEdits), { onConflict: "player_id,match_id" });
    if (!error) setPendingEdits({});
    setSaving(false);
  };

  const filteredFixtures = useMemo(() => {
    if (fixtureFilter === "upcoming") return fixtures.filter(f => f.match_date >= today);
    if (fixtureFilter === "completed") return fixtures.filter(f => f.match_ended || f.match_date < today);
    return fixtures;
  }, [fixtures, fixtureFilter, today]);

  const groupedFixtures = useMemo(() => {
    const map = new Map<string, Fixture[]>();
    filteredFixtures.forEach(f => { if (!map.has(f.match_date)) map.set(f.match_date, []); map.get(f.match_date)!.push(f); });
    return Array.from(map.entries());
  }, [filteredFixtures]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
       <Loader2 className="h-10 w-10 text-slate-900 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-3 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xl">
           <div className="h-12 w-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0"><Trophy size={20} /></div>
           <div>
              <h1 className="text-2xl font-black italic uppercase tracking-tighter leading-none">Scoreboard</h1>
              <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-1">Analytics Intelligence</p>
           </div>
        </div>

        {/* Rules Accordion */}
        <div className="space-y-4">
          <button 
            onClick={() => setShowRules(!showRules)} 
            className="w-full flex items-center justify-between bg-white/40 hover:bg-white/60 p-5 rounded-[1.5rem] border border-slate-200/50 backdrop-blur-md transition-all group"
          >
            <div className="flex items-center gap-4">
               <div className="h-8 w-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100"><Calculator size={14} /></div>
               <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900 text-left leading-none">Scoring Rules & Points Guide</h3>
                  <p className="text-[8px] font-black uppercase text-slate-400 mt-1 leading-none">Standard Dream11 • IPL 2025 Protocol</p>
               </div>
            </div>
            <ChevronRight size={16} className={cn("text-slate-400 transition-transform duration-300", showRules ? "rotate-90" : "rotate-0")} />
          </button>

          {showRules && <ScoringRulesLegend />}
        </div>

        {/* Tabs */}
        <div className="flex bg-white/50 backdrop-blur-md p-1.5 rounded-[1.5rem] border border-slate-200 overflow-x-auto no-scrollbar">
           {["sheets", "standings", "fixtures"].map(tab => (
             <button key={tab} onClick={() => setActiveTab(tab as any)} className={cn("px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-1", activeTab === tab ? "bg-slate-900 text-white shadow-lg" : "text-slate-400")}>{tab}</button>
           ))}
        </div>

        {/* ─── TAB: STANDINGS ─── */}
        {activeTab === "standings" && (
          <div className="space-y-6 animate-in fade-in duration-500">
             {(() => {
                const maxGames = Math.max(...standings.map(s => s.matchesPlayed), 0);
                const gameLabels = Array.from({ length: maxGames }, (_, i) => `G${i+1}`);
                const cumulativeData = gameLabels.map((gl, gIdx) => {
                  const data: any = { game: gl };
                  standings.forEach(team => {
                    const teamPlayers = allPlayers.filter(p => p.sold_to_id === team.id || p.sold_to === team.team_name);
                    const matchObj = allMatches.find(m => m.match_no === gIdx + 1);
                    if (matchObj) {
                       let sum = 0;
                       teamPlayers.forEach(tp => { sum += allMatchPoints.find(p => p.player_id === tp.id && p.match_id === matchObj.id)?.points || 0; });
                       data[team.team_name] = (gIdx > 0 ? (cumulativeData[gIdx - 1] as any)[team.team_name] : 0) + sum;
                    }
                  });
                  return data;
                });

                const currentAnalyticsTeam = analyticsTeamId ? franchises.find(f => f.id === analyticsTeamId) : standings[0];
                const playerPointsList = allPlayers.filter(p => p.sold_to_id === currentAnalyticsTeam?.id || p.sold_to === currentAnalyticsTeam?.team_name).map(p => ({
                   name: p.player_name, points: allMatchPoints.filter(pt => pt.player_id === p.id).reduce((a, b) => a + b.points, 0), role: p.role
                })).sort((a,b) => b.points - a.points);

                const contributorData = playerPointsList.slice(0, 5).map(p => ({ name: p.name.split(' ')[0], value: Math.round(p.points) }));
                const roleData = ["Batter", "Bowler", "All-Rounder", "WK"].map(r => ({ name: r, value: Math.round(playerPointsList.filter(p => p.role === r).reduce((a,b) => a + b.points, 0)) })).filter(d => d.value > 0);

                return (
                  <>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-[2rem] p-6 border shadow-sm h-80">
                           <h3 className="text-sm font-black uppercase italic mb-4">Points Progression</h3>
                           <ResponsiveContainer width="100%" height="90%"><AreaChart data={cumulativeData}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="game" tick={{fontSize:10, fontWeight:700}} /><YAxis tick={{fontSize:10, fontWeight:700}} /><Tooltip contentStyle={{borderRadius:12, border:"none", boxShadow:"0 5px 15px rgba(0,0,0,0.1)"}} />{standings.map((t, i) => <Area key={t.id} type="monotone" dataKey={t.team_name} stroke={TEAM_COLORS[i % TEAM_COLORS.length]} fill="none" strokeWidth={3} />)}</AreaChart></ResponsiveContainer>
                        </div>
                        <div className="bg-slate-900 rounded-[2rem] p-6 shadow-xl h-80">
                           <div className="flex justify-between mb-4">
                              <h3 className="text-sm font-black uppercase italic text-white text-[10px]">{currentAnalyticsTeam?.team_name} Split</h3>
                            <div className="flex gap-1 overflow-x-auto no-scrollbar">
                               {franchises.slice(0, 5).map(f => (
                                 <button 
                                   key={f.id} 
                                   onClick={() => setAnalyticsTeamId(f.id)} 
                                   className={cn(
                                     "text-[7px] font-black uppercase px-1.5 py-1 rounded whitespace-nowrap", 
                                     analyticsTeamId === f.id || (!analyticsTeamId && standings[0]?.id === f.id) 
                                       ? "bg-white text-slate-900" 
                                       : "bg-white/10 text-white/40"
                                   )}
                                 >
                                   {f.team_name.split(' ')[0]}
                                 </button>
                               ))}
                            </div>
                         </div>
                         <div className="grid grid-cols-2 h-full pb-8">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie 
                                  data={contributorData} 
                                  cx="50%" cy="50%" 
                                  innerRadius="40%" outerRadius="70%" 
                                  dataKey="value" stroke="none"
                                >
                                  {contributorData?.map((_, i) => <Cell key={i} fill={TEAM_COLORS[i % TEAM_COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                                <Legend wrapperStyle={{fontSize:7}} />
                              </PieChart>
                            </ResponsiveContainer>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie 
                                  data={roleData} 
                                  cx="50%" cy="50%" 
                                  outerRadius="70%" 
                                  dataKey="value" stroke="none"
                                >
                                  {roleData?.map((_, i) => <Cell key={i} fill={["#3b82f6", "#ef4444", "#10b981", "#f59e0b"][i]} />)}
                                </Pie>
                                <Tooltip />
                                <Legend wrapperStyle={{fontSize:7}} />
                              </PieChart>
                            </ResponsiveContainer>
                           </div>
                        </div>
                     </div>
                     <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-2xl relative">
                        {tabLoading && <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-50 flex items-center justify-center"><Loader2 className="animate-spin text-slate-900" /></div>}
                        <CardHeader className="bg-slate-50/50 p-8 border-b"><CardTitle className="text-xl font-black uppercase italic text-slate-900">Season Standings</CardTitle></CardHeader>
                        <CardContent className="p-0 overflow-x-auto"><table className="w-full text-left min-w-[800px]"><thead className="bg-slate-50"><tr><th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Rank</th><th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Franchise</th><th className="px-6 py-5 text-center text-[10px] font-black text-slate-400">Squad</th><th className="px-6 py-5 text-center text-[10px] font-black text-slate-400">Games</th><th className="px-8 py-5 text-right text-[10px] font-black text-slate-900">Total Points</th></tr></thead><tbody>{standings.map((t, idx) => (<tr key={t.id} className="border-b hover:bg-slate-50 transition-colors"><td className="px-8 py-6"><span className={cn("h-10 w-10 flex items-center justify-center rounded-2xl font-black", idx === 0 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400")}>{idx + 1}</span></td><td className="px-8 py-6"><div className="font-black italic uppercase text-slate-900">{t.team_name}</div></td><td className="px-6 py-6 text-center font-black text-slate-500">{t.squadSize}</td><td className="px-6 py-6 text-center font-black text-slate-500">{t.matchesPlayed}</td><td className="px-8 py-6 text-right font-black italic text-2xl text-slate-900">{Math.floor(t.totalPoints)}</td></tr>))}</tbody></table></CardContent>
                     </Card>
                  </>
                );
             })()}
          </div>
        )}

        {/* ─── TAB: FIXTURES ─── */}
        {activeTab === "fixtures" && (
          <div className="space-y-6 animate-in fade-in duration-500">
             {groupedFixtures.map(([date, matches]) => (
                <div key={date} className="space-y-3">
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{formatDate(date)}</div>
                   {matches.map(match => {
                      const isToday = match.match_date === today;
                      return (
                      <div key={match.id} className={cn("bg-white rounded-[2rem] border p-6 shadow-sm transition-all", isToday ? "border-indigo-500 ring-2 ring-indigo-50/50" : "border-slate-100")}>
                         <div className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-4 flex-1">
                               <img src={getPlayerImage(match.team1_img) || ""} className="h-10 w-10 object-contain rounded-xl bg-slate-50 border p-1" />
                               <span className="font-black uppercase text-slate-900 text-sm">{cleanShort(match.team1_short)}</span>
                            </div>
                            <div className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black italic">VS</div>
                            <div className="flex items-center gap-4 flex-1 justify-end text-right">
                               <span className="font-black uppercase text-slate-900 text-sm">{cleanShort(match.team2_short)}</span>
                               <img src={getPlayerImage(match.team2_img) || ""} className="h-10 w-10 object-contain rounded-xl bg-slate-50 border p-1" />
                            </div>
                         </div>
                         <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
                            <div className="text-[10px] font-bold text-slate-400 uppercase">{formatTime(match.date_time_gmt)}IST • {match.venue?.split(',')[0]}</div>
                            {match.match_ended ? (
                              <div className="flex gap-2">
                                 <Button variant="outline" size="sm" onClick={() => setExpandedScorecardId(match.api_match_id)} className="h-8 text-[9px] font-black uppercase shadow-none border-slate-200">Scorecard</Button>
                                 <Button variant="outline" size="sm" onClick={() => setExpandedPointsId(match.api_match_id)} className="h-8 text-[9px] font-black uppercase border-amber-200 text-amber-600 bg-amber-50/50 shadow-none">Breakdown</Button>
                              </div>
                            ) : <span className="text-[9px] font-black text-amber-500 bg-amber-50 px-2 py-1 rounded uppercase">Live Soon</span>}
                         </div>

                         {/* Scorecard Modal */}
                         <Dialog open={expandedScorecardId === match.api_match_id} onOpenChange={(o) => setExpandedScorecardId(o ? match.api_match_id : null)}>
                            <DialogContent className="max-w-[95vw] sm:max-w-4xl bg-[#F8FAFC] border-0 p-0 rounded-[2rem] overflow-hidden">
                               <div className="bg-slate-900 p-8 text-white"><DialogTitle className="text-2xl font-black uppercase italic">Match Statistics</DialogTitle></div>
                               <div className="p-4 sm:p-8 max-h-[75vh] overflow-y-auto no-scrollbar"><ScorecardViewer scorecard={match.scorecard} /></div>
                            </DialogContent>
                         </Dialog>

                         {/* Points Modal - Team-Aware Calculation */}
                         <Dialog open={expandedPointsId === match.api_match_id} onOpenChange={(o) => { setExpandedPointsId(o ? match.api_match_id : null); setShowBreakdownId(null); }}>
                            <DialogContent className="max-w-[95vw] sm:max-w-3xl bg-white border-0 p-0 rounded-[2rem] overflow-hidden">
                               <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 text-white">
                                  <DialogTitle className="text-2xl font-black uppercase tracking-tight leading-none">Scoring Intelligence</DialogTitle>
                                  <p className="text-[9px] font-black uppercase opacity-90 mt-1.5 leading-none">{match.team1_short} vs {match.team2_short} • 100% Team-Aware Coverage</p>
                               </div>
                               <div className="p-2 sm:p-8 max-h-[75vh] overflow-y-auto no-scrollbar">
                                  <table className="w-full text-left">
                                     <thead className="bg-slate-50 border-b">
                                        <tr><th className="px-4 py-4 text-[9px] font-black uppercase opacity-30">Selection</th><th className="px-3 py-4 text-[9px] font-black opacity-30 text-center uppercase">Contribution</th><th className="px-4 py-4 text-[11px] font-black text-right uppercase">Final Points</th></tr>
                                     </thead>
                                     <tbody className="divide-y divide-slate-100">
                                        {(() => {
                                            const sc = match.scorecard as any; if (!sc?.innings) return null;
                                            const stats: Record<string, any> = {};
                                            const team1 = match.team1_short || "";
                                            const team2 = match.team2_short || "";
                                            
                                            // 1. Master Discovery: Use the top-level 'playing_squad' to initialize the registry
                                            const masterSquad = (sc.playing_squad || []) as string[];
                                            masterSquad.forEach(name => {
                                               const n = name.replace(/[†(c)]/g, "").trim();
                                               // Find which team they belong to by checking innings squad manifests
                                               const playerInning = sc.innings.find((inn: any) => (inn.squad || []).includes(name));
                                               const playerTeam = playerInning?.team || "Unknown";
                                               const key = `${n}_${playerTeam}`;
                                               if (!stats[key]) stats[key] = { n, team: playerTeam, r:0, b:0, f:0, s:0, w:0, m:0, o:0, r_conc:0, c:0, st:0, dots:0, lbwB:0, ro:0, isDuck: false, role: 'Fielder' };
                                            });

                                            // Universal Mapping: Resolve short names against the Master Squad
                                            const findMappedKey = (name: string, team: string) => {
                                               const n = name.replace(/[†(c)]/g, "").trim();
                                               const exact = `${n}_${team}`;
                                               if (stats[exact]) return exact;
                                               
                                               // Fuzzy match within the SAME team first
                                               const matchedKey = Object.keys(stats).find(k => k.endsWith(`_${team}`) && k.split('_')[0].includes(n));
                                               if (matchedKey) return matchedKey;

                                               // Search across the WHOLE master squad if team-specific fails (e.g. name only match)
                                               const wholeMatchKey = Object.keys(stats).find(k => k.split('_')[0].includes(n));
                                               return wholeMatchKey || exact;
                                            };

                                            // 2. Data Accumulation
                                            sc.innings.forEach((inn: any) => {
                                               const currentTeam = inn.team; 
                                               const opposingTeam = sc.innings.find((i: any) => i.team !== currentTeam)?.team || "Opponent";

                                               // Process Batting
                                               (inn.batting || []).forEach((b: any) => { 
                                                  if (!b.player && !b.batsman) return;
                                                  const rawN = b.player || b.batsman?.name || "";
                                                  if (!rawN || rawN === "BATTING") return;
                                                  const key = findMappedKey(rawN, currentTeam);
                                                  const dStr = (b.dismissal || b["dismissal-text"] || "").toLowerCase();

                                                  if (!stats[key]) stats[key] = { n: key.split('_')[0], team: currentTeam, r:0, b:0, f:0, s:0, w:0, m:0, o:0, r_conc:0, c:0, st:0, dots:0, lbwB:0, ro:0, isDuck: false, role: 'Batter' }; 
                                                  stats[key].r += Number(b.R || b.r) || 0; 
                                                  stats[key].b += Number(b.B || b.b) || 0; 
                                                  stats[key].f += Number(b['4s']) || 0; 
                                                  stats[key].s += Number(b['6s']) || 0;
                                                  if (rawN.includes('†')) stats[key].role = 'WK';
                                                  else if (stats[key].role === 'Fielder') stats[key].role = 'Batter';

                                                  if (stats[key].r === 0 && dStr !== "not out" && dStr !== "") stats[key].isDuck = true;
                                               });

                                               // Process Bowling
                                               (inn.bowling || []).forEach((bw: any) => { 
                                                  if (!bw.bowler) return;
                                                  const rawN = typeof bw.bowler === 'string' ? bw.bowler : bw.bowler.name;
                                                  if (!rawN || rawN === "BOWLING") return;
                                                  const key = findMappedKey(rawN, currentTeam);

                                                  if (!stats[key]) stats[key] = { n: key.split('_')[0], team: currentTeam, r:0, b:0, f:0, s:0, r_conc:0, w:0, m:0, o:0, c:0, st:0, dots:0, lbwB:0, ro:0, isDuck:false, role: 'Bowler' }; 
                                                  stats[key].w += Number(bw.W || bw.w) || 0; 
                                                  stats[key].m += Number(bw.M || bw.m) || 0; 
                                                  stats[key].r_conc += Number(bw.R || bw.r) || 0;
                                                  stats[key].o += Number(bw.O || bw.o) || 0;
                                                  stats[key].dots += Number(bw['0s'] || 0);

                                                  if (stats[key].role === 'Batter' || stats[key].role === 'WK') stats[key].role = stats[key].role === 'WK' ? 'WK/Bowler' : 'All-Rounder';
                                                  else if (stats[key].role === 'Fielder') stats[key].role = 'Bowler';
                                               });

                                               // Process Fielding (Catches/Run-outs)
                                               (inn.catching || []).forEach((c: any) => {
                                                  const rawN = typeof c.catcher === 'string' ? c.catcher : c.catcher?.name;
                                                  if (!rawN) return;
                                                  const key = findMappedKey(rawN, opposingTeam);
                                                  if (stats[key]) {
                                                     stats[key].c += Number(c.catch || 0);
                                                     stats[key].st += Number(c.stumped || 0);
                                                  }
                                               });

                                               (inn.batting || []).forEach((b: any) => { 
                                                  const d = (b.dismissal || b["dismissal-text"] || "").toLowerCase(); 
                                                  if (d.startsWith("c ") || d.startsWith("st ")) {
                                                     const parts = d.split(" b ");
                                                     let nRaw = parts[0].replace(/^(?:c|st)\s+(?:†)?/, "").trim();
                                                     if (nRaw && !["sub", "batting", "retired"].includes(nRaw)) {
                                                        const key = findMappedKey(nRaw, opposingTeam);
                                                        if (stats[key]) {
                                                           if (d.startsWith("c ")) stats[key].c++;
                                                           if (d.startsWith("st ")) stats[key].st++;
                                                        }
                                                     }
                                                  }
                                                  if (d.includes("run out")) {
                                                     const roMatch = d.match(/\(([^)]+)\)/);
                                                     if (roMatch?.[1]) {
                                                        const n = roMatch[1].trim();
                                                        const key = findMappedKey(n, opposingTeam);
                                                        if (stats[key]) stats[key].ro++;
                                                     }
                                                  }
                                               });
                                            });

                                            return Object.values(stats).sort((a: any, b: any) => (b.r + b.w*30) - (a.r + a.w*30)).map((p: any) => {
                                               let base = 4; // Playing XI
                                               
                                               // Batting Logic (Official)
                                               let b_pts = p.r + (p.f * 1) + (p.s * 2);
                                               if (p.r >= 100) b_pts += 16; else if (p.r >= 75) b_pts += 12; else if (p.r >= 50) b_pts += 8; else if (p.r >= 25) b_pts += 4;
                                               if (p.isDuck && p.role !== 'Bowler') b_pts -= 2;
                                               // Strike Rate (Min 10 balls OR 20 runs)
                                               let sr_pts = 0;
                                               if (p.r >= 20 || p.b >= 10) {
                                                  const sr = (p.r / p.b) * 100;
                                                  if (sr >= 170) sr_pts = 6; else if (sr >= 150) sr_pts = 4; else if (sr >= 130) sr_pts = 2;
                                                  else if (sr < 50) sr_pts = -6; else if (sr < 60) sr_pts = -4; else if (sr < 70) sr_pts = -2;
                                               }
                                               b_pts += sr_pts;
                                               
                                               // Bowling Logic (Official)
                                               let bw_pts = (p.w * 30) + (p.lbwB * 8) + (p.m * 12) + (p.dots * 1);
                                               if (p.w >= 5) bw_pts += 12; else if (p.w >= 4) bw_pts += 8; else if (p.w >= 3) bw_pts += 4;
                                               // Economy Rate (Min 2 overs)
                                               let eco_pts = 0;
                                               if (p.o >= 2) {
                                                  const eco = p.r_conc / p.o;
                                                  if (eco < 5) eco_pts = 6; else if (eco < 6) eco_pts = 4; else if (eco < 7) eco_pts = 2;
                                                  else if (eco >= 12) eco_pts = -6; else if (eco >= 11) eco_pts = -4; else if (eco >= 10) eco_pts = -2;
                                               }
                                               bw_pts += eco_pts;
                                               
                                               // Fielding Logic (Official)
                                               let f_pts = (p.c * 8) + (p.st * 12) + (p.ro * 12);
                                               if (p.c >= 3) f_pts += 4;
                                               
                                               const total = base + b_pts + bw_pts + f_pts;

                                               return (
                                                  <React.Fragment key={`${p.n}_${p.team}`}>
                                                     <tr onClick={() => setShowBreakdownId(showBreakdownId === `${p.n}_${p.team}` ? null : `${p.n}_${p.team}`)} className={cn("hover:bg-slate-50 cursor-pointer transition-all", showBreakdownId === `${p.n}_${p.team}` ? "bg-slate-50" : "")}>
                                                        <td className="px-4 py-4"><div className="flex items-center gap-1.5"><span className="text-xs font-black uppercase text-slate-800 leading-none">{p.n}</span><ChevronRight size={10} className={cn("text-indigo-500", showBreakdownId === `${p.n}_${p.team}` ? "rotate-90" : "")} /></div><p className="text-[7px] font-black uppercase text-slate-400 mt-1">{p.team} • {p.role}</p></td>
                                                        <td className="px-3 py-4 text-center"><div className="text-[9px] font-black text-slate-900 leading-none">{p.r}R • {p.w}W • {p.c}C</div></td>
                                                        <td className="px-4 py-4 text-right"><div className="text-sm font-black text-slate-900">{Math.round(total)}</div></td>
                                                     </tr>
                                                     {showBreakdownId === `${p.n}_${p.team}` && (
                                                        <tr className="bg-slate-50/50 border-none"><td colSpan={3} className="px-4 pb-6 pt-2 border-none">
                                                           <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-inner grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in slide-in-from-top-2">
                                                              <div className="space-y-2">
                                                                 <h4 className="text-[8px] font-black uppercase text-indigo-600 tracking-widest border-b pb-1">Official Breakdown ({p.team})</h4>
                                                                 <div className="space-y-2.5">
                                                                    <div className="flex flex-col gap-0.5">
                                                                       <div className="flex justify-between text-[10px]"><span className="text-slate-400 font-bold uppercase tracking-tight">Playing XI Base</span><span className="font-black text-slate-900">+4.0</span></div>
                                                                       <p className="text-[7px] font-black text-slate-300 uppercase leading-none">Automatic Entry Bonus</p>
                                                                    </div>
                                                                    <div className="flex flex-col gap-0.5">
                                                                       <div className="flex justify-between text-[10px]"><span className="text-slate-400 font-bold uppercase tracking-tight">Batting (Official)</span><span className="font-black text-slate-900">+{b_pts.toFixed(1)}</span></div>
                                                                       <p className="text-[7px] font-black text-indigo-400 uppercase leading-none italic">{p.r}R + ({p.f}*1) + ({p.s}*2) + SR({sr_pts}) + MS</p>
                                                                    </div>
                                                                    <div className="flex flex-col gap-0.5">
                                                                       <div className="flex justify-between text-[10px]"><span className="text-slate-400 font-bold uppercase tracking-tight">Bowling (Official)</span><span className="font-black text-slate-900">+{bw_pts.toFixed(1)}</span></div>
                                                                       <p className="text-[7px] font-black text-indigo-400 uppercase leading-none italic">({p.w}*30) + ({p.lbwB}*8) + ({p.m}*12) + {p.dots}D + ECO({eco_pts}) + MS</p>
                                                                    </div>
                                                                    <div className="flex flex-col gap-0.5">
                                                                       <div className="flex justify-between text-[10px]"><span className="text-slate-400 font-bold uppercase tracking-tight">Fielding (Official)</span><span className="font-black text-slate-900">+{f_pts.toFixed(1)}</span></div>
                                                                       <p className="text-[7px] font-black text-indigo-400 uppercase leading-none italic">({p.c}*8) + ({p.st}*12) + ({p.ro}*12)</p>
                                                                    </div>
                                                                    <div className="border-t pt-1.5 flex justify-between text-[11px] font-black uppercase"><span className="text-slate-900">FINAL TOTAL</span><span className="text-slate-900">{total.toFixed(1)}</span></div>
                                                                 </div>
                                                              </div>
                                                           </div>
                                                        </td></tr>
                                                     )}
                                                  </React.Fragment>
                                               );
                                            });
                                         })()}
                                     </tbody>
                                  </table>
                               </div>
                            </DialogContent>
                         </Dialog>
                      </div>
                   )})}
                </div>
             ))}
          </div>
        )}

        {/* ─── TAB: SCORE SHEETS ─── */}
        {activeTab === "sheets" && (
           <div className="space-y-6 animate-in fade-in duration-500">
              {/* Search & Download Header */}
              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
                 <div className="relative w-full sm:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <Input 
                      placeholder="Find player..." 
                      className="pl-11 h-11 bg-white border-slate-200 rounded-xl font-bold text-sm shadow-sm" 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)} 
                    />
                 </div>
                 <Button 
                   variant="outline" 
                   onClick={() => {
                     const team = franchises.find(t => t.id === selectedTeamId);
                     if (!team) return;
                     const teamPlayers = allPlayers.filter(p => p.sold_to_id === team.id || p.sold_to === team.team_name);
                     let csv = "Player,Team,Role,Price\n";
                     teamPlayers.forEach(p => { csv += `"${p.player_name}","${p.team}","${p.role}","${p.sold_price || p.price}"\n`; });
                     const link = document.createElement("a");
                     link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + csv));
                     link.setAttribute("download", `${team.team_name}_Squad.csv`);
                     link.click();
                   }} 
                   className="h-11 border-slate-200 rounded-xl font-black uppercase tracking-widest flex gap-2 text-slate-600 px-6 shadow-sm text-[10px]"
                 >
                    <Download size={16} /> Export CSV
                 </Button>
              </div>

              <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-xl relative">
                {subLoading && <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-50 flex items-center justify-center"><Loader2 className="animate-spin text-slate-900" /></div>}
                <div className="overflow-x-auto">
                   <table className="w-full text-left min-w-[1200px]">
                      <thead className="bg-slate-50">
                         <tr>
                            <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 sticky left-0 bg-slate-50 z-10">Squad Player</th>
                            {[...Array(17)].map((_, i) => <th key={i} className="px-3 py-5 text-center text-[10px] font-black text-slate-400">G{i+1}</th>)}
                            <th className="px-8 py-5 text-right text-[10px] font-black text-slate-900 sticky right-0 bg-slate-50 z-10">Total</th>
                         </tr>
                      </thead>
                      <tbody>
                         {allPlayers.filter(p => p.player_name.toLowerCase().includes(searchQuery.toLowerCase())).map(p => {
                            const pts = Array(17).fill(0);
                            allMatchPoints.filter(pt => pt.player_id === p.id).forEach(pt => {
                               const m = allMatches.find(match => match.id === pt.match_id);
                               if (m?.match_no && m.match_no <= 17) pts[m.match_no-1] = pt.points;
                            });
                            const total = pts.reduce((a,b) => a+b, 0);

                            return (
                               <tr key={p.id} className="border-b transition-colors group hover:bg-slate-50">
                                  <td className="px-8 py-4 sticky left-0 bg-white group-hover:bg-slate-50 z-10">
                                     <div className="flex items-center gap-4">
                                        <div className="h-9 w-9 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-100 italic flex items-center justify-center">
                                           {p.image_url ? (
                                              <img src={getPlayerImage(p.image_url)!} className="w-full h-full object-cover object-top" />
                                           ) : <User size={16} className="text-slate-200" />}
                                        </div>
                                        <div className="min-w-0">
                                           <div className="font-bold text-slate-900 text-xs">{p.player_name}</div>
                                           <div className="text-[8px] font-black text-slate-400 uppercase mt-0.5">{p.role}</div>
                                        </div>
                                     </div>
                                  </td>
                                  {pts.map((score, i) => {
                                     const mObj = allMatches.find(m => m.match_no === i+1);
                                     const isDirty = mObj && pendingEdits[`${p.id}_${mObj.id}`] !== undefined;
                                     return (
                                        <td key={i} className="px-3 py-4 text-center">
                                           <Input 
                                             type="number" step="0.5" 
                                             defaultValue={score || ""}
                                             onChange={(e) => updateSeasonPoint(p.id, i+1, e.target.value)} 
                                             className={cn("h-8 w-14 mx-auto text-[10px] font-black text-center border-none rounded-lg", isDirty ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300" : "bg-slate-50")} 
                                             placeholder="0" 
                                           />
                                        </td>
                                     );
                                  })}
                                  <td className="px-8 py-4 text-right font-black italic bg-white group-hover:bg-slate-50 sticky right-0 z-10 text-sm">
                                     {String(total % 1 === 0 ? total : total.toFixed(1))}
                                  </td>
                                </tr>
                            );
                         })}
                      </tbody>
                   </table>
                </div>
              </div>
           </div>
        )}

      </div>

      {Object.keys(pendingEdits).length > 0 && (
         <div className="fixed bottom-6 right-6 z-50"><Button onClick={handleBulkSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-8 py-7 shadow-2xl flex gap-3 items-center font-black uppercase text-xs">{saving ? <Loader2 className="animate-spin" /> : <Save />} Save Changes ({Object.keys(pendingEdits).length})</Button></div>
      )}
    </div>
  );
}
