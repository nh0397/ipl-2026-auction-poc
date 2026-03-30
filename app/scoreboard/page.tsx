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
import { calculateDream11Points, calculateDetailedPoints, MatchStats } from "@/lib/scoring";
import { useAuth } from "@/components/auth/AuthProvider";
import React from "react";
import ScorecardViewer from "@/components/scoreboard/ScorecardViewer";

// ─── Fixture helpers ────────────────────────────────────────────────
interface Fixture {
  id: string; api_match_id: string; match_no: number; title: string; venue: string | null;
  match_date: string; date_time_gmt: string; team1_name: string | null; team1_short: string | null;
  team1_img: string | null; team2_name: string | null; team2_short: string | null;
  team2_img: string | null; status: string; match_started: boolean; match_ended: boolean;
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

const TEAM_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#ef4444", "#06b6d4", "#f97316"];

export default function ScoreboardPage() {
  const { user, profile: authProfile } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
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
    const { data: pts } = await supabase.from("match_points").select("*");
    setAllMatchPoints(pts || []);
    calculateStandings(soldPlayers || [], pts || []);
    setTabLoading(false);
  };

  const fetchMatchSpecificData = async (matchId: string) => {
    const { data } = await supabase.from("nominations").select("*").eq("match_id", matchId);
    setAllNominations(data || []);
  };

  const calculateStandings = (players: any[], points: any[]) => {
    const standingsData = franchises.map(team => {
      let totalPoints = 0; let matchesPlayed = 0; let bestMatch = 0; let worstMatch = Infinity;
      const teamPlayers = players.filter(p => p.sold_to_id === team.id || p.sold_to === team.team_name);
      allMatches.forEach(m => {
        let matchTotal = 0; let matchHasPoints = false;
        teamPlayers.forEach(player => {
          const ptRecord = points?.find(p => p.player_id === player.id && p.match_id === m.id);
          if (ptRecord) { matchHasPoints = true; matchTotal += ptRecord.points; }
        });
        if (matchHasPoints) {
          matchesPlayed++; totalPoints += matchTotal;
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

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="h-10 w-10 text-slate-900 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-3 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xl"><div className="h-12 w-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0"><Trophy size={20} /></div><div><h1 className="text-2xl font-black italic uppercase tracking-tighter leading-none">Scoreboard</h1><p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-1">Analytics Intelligence</p></div></div>
        {/* Tabs */}
        <div className="flex bg-white/50 backdrop-blur-md p-1.5 rounded-[1.5rem] border border-slate-200 overflow-x-auto no-scrollbar">{["sheets", "standings", "fixtures"].map(tab => (<button key={tab} onClick={() => setActiveTab(tab as any)} className={cn("px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-1", activeTab === tab ? "bg-slate-900 text-white shadow-lg" : "text-slate-400")}>{tab}</button>))}</div>

        {activeTab === "fixtures" && (
          <div className="space-y-6 animate-in fade-in duration-500">
             {groupedFixtures.map(([date, matches]) => (
                <div key={date} className="space-y-3">
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{formatDate(date)}</div>
                   {matches.map(match => (
                      <div key={match.id} className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
                         <div className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-4 flex-1"><img src={getPlayerImage(match.team1_img) || ""} className="h-10 w-10 object-contain rounded-xl bg-slate-50 border p-1" /><span className="font-black uppercase text-slate-900 text-sm">{cleanShort(match.team1_short)}</span></div>
                            <div className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black italic">VS</div>
                            <div className="flex items-center gap-4 flex-1 justify-end text-right"><span className="font-black uppercase text-slate-900 text-sm">{cleanShort(match.team2_short)}</span><img src={getPlayerImage(match.team2_img) || ""} className="h-10 w-10 object-contain rounded-xl bg-slate-50 border p-1" /></div>
                         </div>
                         <div className="flex items-center justify-between mt-4">
                            <div className="text-[10px] font-bold text-slate-400 uppercase">{formatDate(match.match_date)} • {match.venue?.split(',')[0]}</div>
                            {match.match_ended ? (
                              <div className="flex gap-2">
                                 <Button variant="outline" size="sm" onClick={() => setExpandedScorecardId(match.api_match_id)} className="h-8 text-[9px] font-black uppercase shadow-none border-slate-200">Scorecard</Button>
                                 <Button variant="outline" size="sm" onClick={() => setExpandedPointsId(match.api_match_id)} className="h-8 text-[9px] font-black uppercase border-amber-200 text-amber-600 bg-amber-50 shadow-none">Breakdown</Button>
                              </div>
                            ) : <span className="text-[9px] font-black text-amber-500 bg-amber-50 px-2 py-1 rounded uppercase">Live Soon</span>}
                         </div>

                         <Dialog open={expandedPointsId === match.api_match_id} onOpenChange={(o) => { setExpandedPointsId(o ? match.api_match_id : null); setShowBreakdownId(null); }}>
                            <DialogContent className="max-w-[95vw] sm:max-w-3xl bg-white border-0 p-0 rounded-[2rem] overflow-hidden">
                               <div className="bg-slate-900 p-8 text-white"><DialogTitle className="text-2xl font-black uppercase tracking-tight">Scoring Intelligence</DialogTitle></div>
                               <div className="p-2 sm:p-8 max-h-[75vh] overflow-y-auto no-scrollbar">
                                 <table className="w-full text-left">
                                   <thead className="bg-slate-50 border-b">
                                     <tr>
                                       <th className="px-4 py-4 text-[9px] font-black uppercase opacity-30">Player</th>
                                       <th className="px-3 py-4 text-[9px] font-black opacity-30 text-center uppercase">Contribution</th>
                                       <th className="px-4 py-4 text-[11px] font-black text-right uppercase">Points</th>
                                     </tr>
                                   </thead>
                                   <tbody>{(() => {
                                      const sc = match.scorecard; if (!sc?.innings) return null;
                                      const registry: Record<string, any> = {};
                                      
                                      const initialize = (name: string, team: string) => {
                                         const n = name.replace(/[†(c)]/g, "").trim();
                                         const key = `${n}_${team}`;
                                         if (!registry[key]) registry[key] = { n: n, team: team, role: 'Fielder', batting: { r: 0, b: 0, f: 0, s: 0, iD: false }, bowling: { w: 0, m: 0, o: 0, rc: 0, dt: 0, lbwB: 0 }, fielding: { c: 0, st: 0, roD: 0, roI: 0 } };
                                         return key;
                                      };

                                      // 1. Discovery Phase: Initialize from Master playing_squad
                                      const masterSquad = sc.playing_squad || [];
                                      masterSquad.forEach((name: string) => {
                                         const inn = sc.innings.find((i: any) => (i.squad || []).some((sN: string) => sN.includes(name) || name.includes(sN)));
                                         initialize(name, inn?.team || "Unknown");
                                      });

                                      // 2. Fuzzy Resolver
                                      const resolvePlayer = (rawName: string, teamHint: string) => {
                                         const target = rawName.replace(/[†(c).]/g, "").trim().toLowerCase(); 
                                         if (!target) return "";
                                         let foundKey = Object.keys(registry).find(k => k.endsWith(`_${teamHint}`) && k.split('_')[0].toLowerCase().includes(target));
                                         if (foundKey) return foundKey;
                                         foundKey = Object.keys(registry).find(k => k.split('_')[0].toLowerCase().includes(target));
                                         return foundKey || initialize(rawName, teamHint);
                                      };

                                      // 3. Processing Phase
                                      sc.innings.forEach((inn: any) => {
                                         const team = inn.team; 
                                         const opponentTeam = sc.innings.find((i: any) => i.team !== team)?.team || "Opponent";
                                         
                                         (inn.batting || []).forEach((b: any) => {
                                            const rawN = b.player || b.batsman?.name || ""; 
                                            if (!rawN || rawN === "BATTING") return;
                                            const dText = (b.dismissal || b["dismissal-text"] || "").toLowerCase().trim();
                                            const bKey = resolvePlayer(rawN, team);

                                            registry[bKey].batting.r += Number(b.R || b.r) || 0; 
                                            registry[bKey].batting.b += Number(b.B || b.b) || 0;
                                            registry[bKey].batting.f += Number(b['4s']) || 0; 
                                            registry[bKey].batting.s += Number(b['6s']) || 0;
                                            if (rawN.includes('†')) registry[bKey].role = 'WK'; 
                                            else if (registry[bKey].role === 'Fielder') registry[bKey].role = 'Batter';
                                            if (registry[bKey].batting.r === 0 && dText !== "not out" && dText !== "") registry[bKey].batting.iD = true;

                                            // Fielding & Bowler Attribution
                                            if (dText && dText !== "not out" && dText !== "absent hurt") {
                                               // Bowler
                                               let bwlName = ""; 
                                               if (dText.includes(" b ")) bwlName = dText.split(" b ").pop()?.trim() || ""; 
                                               else if (dText.startsWith("b ")) bwlName = dText.slice(2).trim(); 
                                               else if (dText.startsWith("c & b ")) bwlName = dText.slice(6).trim();

                                               if (bwlName) { 
                                                  const bwlKey = resolvePlayer(bwlName, opponentTeam); 
                                                  if (dText.startsWith("lbw b ") || dText.startsWith("b ") || dText.startsWith("c & b ")) registry[bwlKey].bowling.lbwB += 1;
                                               }

                                               // Fielder (Catch/Stumping)
                                               if (dText.startsWith("c & b ")) { 
                                                  const fKey = resolvePlayer(dText.slice(6).trim(), opponentTeam); 
                                                  registry[fKey].fielding.c += 1; 
                                               } else if (dText.startsWith("c ") || dText.startsWith("st ")) { 
                                                  const fRaw = dText.split(" b ")[0].replace(/^(?:c|st)\s+(?:†)?/, "").trim(); 
                                                  if (fRaw && !["sub", "batting", "retired"].includes(fRaw)) { 
                                                     const fKey = resolvePlayer(fRaw, opponentTeam); 
                                                     if (dText.startsWith("c ")) registry[fKey].fielding.c += 1; 
                                                     if (dText.startsWith("st ")) registry[fKey].fielding.st += 1; 
                                                  } 
                                               }

                                               // Run Outs
                                               if (dText.includes("run out")) { 
                                                   const roMatch = dText.match(/\(([^)]+)\)/); 
                                                   if (roMatch?.[1]) { 
                                                      const parts = roMatch[1].split(/[/\s,]+/);
                                                      parts.forEach((roName: string) => { 
                                                         const fKey = resolvePlayer(roName.trim(), opponentTeam); 
                                                         if (fKey) {
                                                            if (parts.length === 1) registry[fKey].fielding.roD += 1;
                                                            else registry[fKey].fielding.roI += 1;
                                                         } 
                                                      });
                                                   } 
                                               }
                                            }
                                         });

                                         (inn.bowling || []).forEach((bw: any) => {
                                            const name = typeof bw.bowler === 'string' ? bw.bowler : bw.bowler.name; 
                                            if (!name || name === "BOWLING") return;
                                            const bowKey = resolvePlayer(name, team); 
                                            registry[bowKey].bowling.w += Number(bw.W || bw.w) || 0; 
                                            registry[bowKey].bowling.m += Number(bw.M || bw.m) || 0; 
                                            registry[bowKey].bowling.rc += Number(bw.R || bw.r) || 0; 
                                            registry[bowKey].bowling.o += Number(bw.O || bw.o) || 0; 
                                            registry[bowKey].bowling.dt += Number(bw['0s'] || 0); 
                                            if (registry[bowKey].role === 'Fielder') registry[bowKey].role = 'Bowler';
                                         });
                                      });

                                      // 4. Render
                                      return Object.values(registry)
                                        .sort((a: any, b: any) => {
                                            const aS = calculateDetailedPoints({ 
                                              runs: a.batting.r, balls: a.batting.b, fours: a.batting.f, sixes: a.batting.s, 
                                              wickets: a.bowling.w, lbwBowled: a.bowling.lbwB, maidens: a.bowling.m, 
                                              catches: a.fielding.c, stumpings: a.fielding.st, runOutDirect: a.fielding.roD, 
                                              runOutIndirect: a.fielding.roI, dotBalls: a.bowling.dt, oversMoved: a.bowling.o, 
                                              economyRate: a.bowling.o > 0 ? a.bowling.rc / a.bowling.o : undefined, 
                                              isDuck: a.batting.iD, isAnnounced: true, role: a.role 
                                            });
                                            const bS = calculateDetailedPoints({ 
                                              runs: b.batting.r, balls: b.batting.b, fours: b.batting.f, sixes: b.batting.s, 
                                              wickets: b.bowling.w, lbwBowled: b.bowling.lbwB, maidens: b.bowling.m, 
                                              catches: b.fielding.c, stumpings: b.fielding.st, runOutDirect: b.fielding.roD, 
                                              runOutIndirect: b.fielding.roI, dotBalls: b.bowling.dt, oversMoved: b.bowling.o, 
                                              economyRate: b.bowling.o > 0 ? b.bowling.rc / b.bowling.o : undefined, 
                                              isDuck: b.batting.iD, isAnnounced: true, role: b.role 
                                            });
                                            return bS.total - aS.total;
                                        })
                                        .map((p: any) => {
                                           const mS: MatchStats = { 
                                              runs: p.batting.r, balls: p.batting.b, fours: p.batting.f, sixes: p.batting.s, 
                                              wickets: p.bowling.w, lbwBowled: p.bowling.lbwB, maidens: p.bowling.m, 
                                              catches: p.fielding.c, stumpings: p.fielding.st, runOutDirect: p.fielding.roD, 
                                              runOutIndirect: p.fielding.roI, dotBalls: p.bowling.dt, oversMoved: p.bowling.o, 
                                              economyRate: p.bowling.o >= 2 ? p.bowling.rc / p.bowling.o : undefined, 
                                              isDuck: p.batting.iD, isAnnounced: true, 
                                              strikeRate: p.batting.b > 0 ? (p.batting.r / p.batting.b) * 100 : 0, 
                                              role: p.role 
                                           };
                                           const dt = calculateDetailedPoints(mS);
                                           const pKey = `${p.n}_${p.team}`;

                                           return (
                                              <React.Fragment key={pKey}>
                                                 <tr onClick={() => setShowBreakdownId(showBreakdownId === pKey ? null : pKey)} 
                                                     className={cn("hover:bg-slate-50 cursor-pointer transition-colors", showBreakdownId === pKey ? "bg-slate-50" : "border-b")}>
                                                    <td className="px-4 py-4 text-xs font-black uppercase text-slate-800">
                                                       {p.n}
                                                       <p className="text-[8px] text-slate-400 font-bold">{p.team}</p>
                                                    </td>
                                                    <td className="px-3 py-4 text-center">
                                                       <div className="text-[10px] font-black text-slate-900 leading-none">
                                                          {p.batting.r}R • {p.bowling.w}W • {p.fielding.c + p.fielding.st + p.fielding.roD + p.fielding.roI}F
                                                       </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-right font-black italic text-indigo-600">
                                                       {Math.round(dt.total)}
                                                    </td>
                                                 </tr>
                                                 {showBreakdownId === pKey && (
                                                    <tr className="bg-slate-50/50">
                                                       <td colSpan={3} className="px-4 pb-6 pt-2 border-b">
                                                          <div className="bg-white border-2 border-slate-100 rounded-3xl p-5 shadow-sm grid grid-cols-2 gap-6 animate-in slide-in-from-top-2">
                                                             <div className="space-y-2">
                                                                <h4 className="text-[9px] font-black uppercase text-indigo-600 tracking-wider border-b pb-1">Stats</h4>
                                                                <div className="flex justify-between text-[11px]"><span className="text-slate-400 font-bold">Batting</span><span className="font-black text-slate-900">+{dt.categories.batting.total.toFixed(0)}</span></div>
                                                                <div className="flex justify-between text-[11px]"><span className="text-slate-400 font-bold">Bowling</span><span className="font-black text-slate-900">+{dt.categories.bowling.total.toFixed(0)}</span></div>
                                                                <div className="flex justify-between text-[11px]"><span className="text-slate-400 font-bold">Fielding</span><span className="font-black text-slate-900">+{dt.categories.fielding.total.toFixed(0)}</span></div>
                                                             </div>
                                                             <div className="space-y-2">
                                                                <h4 className="text-[9px] font-black uppercase text-indigo-600 tracking-wider border-b pb-1">Summary</h4>
                                                                <div className="flex justify-between text-[11px]"><span className="text-slate-400 font-bold">Base</span><span className="font-black text-slate-900">+{dt.categories.others.total.toFixed(0)}</span></div>
                                                                <div className="flex justify-between text-[13px] pt-1 font-black uppercase text-indigo-600 border-t">
                                                                   <span>Final</span>
                                                                   <span>{Math.round(dt.total)}</span>
                                                                </div>
                                                             </div>
                                                          </div>
                                                       </td>
                                                    </tr>
                                                 )}
                                              </React.Fragment>
                                           );
                                        });
                                    })()}</tbody>
                                 </table>
                               </div>
                            </DialogContent>
                          </Dialog>
                          </div>
                       ))}
                    </div>
                 ))}
              </div>
           )}

        {activeTab === "sheets" && (<div className="bg-white rounded-[2rem] border overflow-hidden shadow-xl"><div className="overflow-x-auto"><table className="w-full text-left min-w-[1200px]"><thead className="bg-slate-50"><tr><th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Player</th>{[...Array(17)].map((_, i) => <th key={i} className="px-3 py-5 text-center text-[10px] font-black text-slate-400">G{i+1}</th>)}<th className="px-8 py-5 text-right text-[10px] font-black text-slate-900">Total</th></tr></thead><tbody>{allPlayers.filter(p => p.player_name.toLowerCase().includes(searchQuery.toLowerCase())).map(p => { const pts = Array(17).fill(0); allMatchPoints.filter(pt => pt.player_id === p.id).forEach(pt => { const m = allMatches.find(match => match.id === pt.match_id); if (m?.match_no && m.match_no <= 17) pts[m.match_no-1] = pt.points; }); return (<tr key={p.id} className="border-b"><td className="px-8 py-4 font-bold text-xs">{p.player_name}</td>{pts.map((score, i) => (<td key={i} className="px-3 py-4 text-center text-[10px]">{score || 0}</td>))}<td className="px-8 py-4 text-right font-black italic">{pts.reduce((a,b)=>a+b,0).toFixed(1)}</td></tr>); })}</tbody></table></div></div>)}
        {activeTab === "standings" && (<div className="space-y-6"><Card className="rounded-[2rem] overflow-hidden border-none shadow-xl"><CardHeader className="bg-slate-50/50 p-8 border-b"><CardTitle className="text-xl font-black uppercase italic text-slate-900">Season Standings</CardTitle></CardHeader><CardContent className="p-0 overflow-x-auto"><table className="w-full text-left min-w-[800px]"><thead className="bg-slate-50"><tr><th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Rank</th><th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Franchise</th><th className="px-8 py-5 text-right text-[10px] font-black text-slate-900">Total Points</th></tr></thead><tbody>{standings.map((t, idx) => (<tr key={t.id} className="border-b hover:bg-slate-50"><td className="px-8 py-6 font-black text-slate-400">{idx+1}</td><td className="px-8 py-6 font-black italic uppercase text-slate-900">{t.team_name}</td><td className="px-8 py-6 text-right font-black italic text-2xl text-slate-900">{Math.floor(t.totalPoints)}</td></tr>))}</tbody></table></CardContent></Card></div>)}
      </div>
      {Object.keys(pendingEdits).length > 0 && (<div className="fixed bottom-6 right-6 z-50"><Button onClick={handleBulkSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-8 py-7 shadow-2xl flex gap-3 items-center font-black uppercase text-xs">{saving ? <Loader2 className="animate-spin" /> : <Save />} Save Changes ({Object.keys(pendingEdits).length})</Button></div>)}
    </div>
  );
}
