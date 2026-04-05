"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MatchStats } from "@/lib/scoring";
import { supabase } from "@/lib/supabase";
import { Loader2, Zap, Trophy, User, ShieldCheck, ChevronDown, ChevronUp, Star, Activity, Target, Fingerprint, AlertCircle, RefreshCw, Save, Database, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface PointItem {
  label: string;
  points: number;
  value?: string | number;
}

interface DetailedBreakdown {
  batting: PointItem[];
  bowling: PointItem[];
  fielding: PointItem[];
  others: PointItem[];
  total: number;
}

export default function ScorecardAuditPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const matchId = (params?.id as string) || searchParams?.get('id');
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerRoles, setPlayerRoles] = useState<Record<string, string>>({});
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [source, setSource] = useState<'database' | 'live' | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    console.log("🔍 Audit Page Load | Match ID:", matchId);
    if (matchId) {
      initialFetch(matchId);
    } else {
      setLoading(false);
      setError("No Match ID provided in URL");
    }
  }, [matchId]);

  const initialFetch = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("💾 Checking Local Database Cache...");
      const { data: fixture } = await supabase
        // Old source (ESPN-driven): .from("fixtures")
        .from("fixtures_cricapi")
        .select("scorecard, status")
        .eq("api_match_id", id)
        .maybeSingle();
      
      if (fixture?.scorecard && (fixture.scorecard as any).scorecard) {
        console.log("✅ Found in DB Cache");
        setSource('database');
        const scData = (fixture.scorecard as any).data || fixture.scorecard;
        setData(scData);
        fetchRoles(scData);
        setLoading(false);
      } else {
        console.log("ℹ️ Not in DB or incomplete. Falling back to Live Scrape...");
        fetchLiveScorecard(id);
      }
    } catch (err: any) {
      console.log("⚠️ DB Fetch failed, trying Live Scrape:", err.message);
      fetchLiveScorecard(id);
    }
  };

  const fetchLiveScorecard = async (id: string) => {
    try {
      console.log(`🌐 Live Scraper Fetch: http://127.0.0.1:5000/scorecard?id=${id}`);
      const res = await fetch(`http://127.0.0.1:5000/scorecard?id=${id}`);
      if (!res.ok) throw new Error(`Scraper Error: HTTP ${res.status}`);
      
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      if (!json.data) throw new Error("No data returned from scraper");
      
      setSource('live');
      setData(json.data);
      fetchRoles(json.data);
    } catch (err: any) {
      console.error("❌ Scrape Error:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const syncToDatabase = async () => {
    if (!data || !matchId) return;
    try {
      setSyncing(true);
      const { error: syncError } = await supabase
        // Old source (ESPN-driven): .from("fixtures")
        .from("fixtures_cricapi")
        .update({ 
            scorecard: { data }, 
            status: data.status || "Match Ended",
            match_started: true,
            match_ended: (data.status || "").toLowerCase().includes("won") || (data.status || "").toLowerCase().includes("tied")
        })
        .eq("api_match_id", matchId);
      
      if (syncError) throw syncError;
      
      setSource('database');
      alert("✅ Successfully synced Match Audit data to official Database!");
    } catch (err: any) {
      alert("❌ Sync failed: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const fetchRoles = async (matchData: any) => {
    try {
      const playerNames = new Set<string>();
      matchData.scorecard.forEach((inning: any) => {
        inning.batting.forEach((b: any) => playerNames.add(b.batsman.name));
        inning.bowling.forEach((bw: any) => playerNames.add(bw.bowler.name));
      });

      const { data: dbPlayers } = await supabase
        .from("players")
        .select("player_name, role")
        .in("player_name", Array.from(playerNames));

      const roleMap: Record<string, string> = {};
      dbPlayers?.forEach(p => {
        roleMap[p.player_name] = p.role;
      });
      setPlayerRoles(roleMap);
    } catch (err: any) {
      console.error("Error fetching roles:", err.message);
    }
  };

  const mapRole = (role: string): 'Batter' | 'Bowler' | 'All-Rounder' | 'WK' => {
    const r = (role || "").toLowerCase();
    if (r.includes("wk") || r.includes("keeper")) return "WK";
    if (r.includes("all")) return "All-Rounder";
    if (r.includes("bowl")) return "Bowler";
    return "Batter";
  };

  const getDetailedBreakdown = (stats: MatchStats): DetailedBreakdown => {
     const batting: PointItem[] = [];
     const bowling: PointItem[] = [];
     const fielding: PointItem[] = [];
     const others: PointItem[] = [];

     if (stats.runs > 0) batting.push({ label: 'Base Runs', points: stats.runs, value: stats.runs });
     if (stats.fours > 0) batting.push({ label: 'Boundary Bonus (4s)', points: stats.fours * 1, value: stats.fours });
     if (stats.sixes > 0) batting.push({ label: 'Six Bonus (6s)', points: stats.sixes * 2, value: stats.sixes });
     
     if (stats.runs >= 100) batting.push({ label: 'Century Bonus', points: 16 });
     else if (stats.runs >= 50) batting.push({ label: 'Half-Century Bonus', points: 8 });

     if (stats.isDuck) batting.push({ label: 'Duck Penalty', points: -2 });

     if (stats.wickets > 0) bowling.push({ label: 'Wickets', points: stats.wickets * 25, value: stats.wickets });
     if (stats.maidens > 0) bowling.push({ label: 'Maiden Over Bonus', points: stats.maidens * 12, value: stats.maidens });
     if (stats.dotBalls > 0) bowling.push({ label: 'Dot Ball Bonus', points: stats.dotBalls, value: stats.dotBalls });

     if (stats.catches > 0) fielding.push({ label: 'Catches', points: stats.catches * 8, value: stats.catches });
     if (stats.stumpings > 0) fielding.push({ label: 'Stumpings', points: stats.stumpings * 12, value: stats.stumpings });

     if (stats.isAnnounced) others.push({ label: 'Announced Player Bonus', points: 4 });

     const sum = (arr: PointItem[]) => arr.reduce((acc, it) => acc + it.points, 0);
     const total = sum(batting) + sum(bowling) + sum(fielding) + sum(others);
     return { batting, bowling, fielding, others, total };
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 space-y-4">
          <div className="h-5 w-64 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-9 w-96 bg-slate-200 rounded-2xl animate-pulse" />
          <div className="h-3 w-2/3 bg-slate-200 rounded-md animate-pulse" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-3">
              <div className="h-4 w-32 bg-slate-200 rounded-md animate-pulse" />
              <div className="h-24 w-full bg-slate-200 rounded-2xl animate-pulse" />
              <div className="h-3 w-2/3 bg-slate-200 rounded-md animate-pulse" />
            </div>
          ))}
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="h-4 w-48 bg-slate-200 rounded-md animate-pulse" />
          </div>
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="h-4 w-64 bg-slate-200 rounded-md animate-pulse" />
                <div className="h-4 w-24 bg-slate-200 rounded-md animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
       <Card className="max-w-md w-full border-none shadow-2xl rounded-[2rem] overflow-hidden bg-white text-center p-12">
          <AlertCircle size={60} className="mx-auto text-rose-500 mb-6" />
          <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 mb-4">Audit Failed</h2>
          <Badge variant="outline" className="text-rose-400 border-rose-100 bg-rose-50 px-4 py-2 mb-6">ERROR: {error || 'No Data Found'}</Badge>
          <Button onClick={() => fetchLiveScorecard(matchId)} className="w-full rounded-full bg-slate-900 text-white font-black uppercase py-6">
             <RefreshCw size={16} className="mr-2" /> Retry Scraper
          </Button>
       </Card>
    </div>
  );

  const players: Record<string, any> = {};
  data.scorecard.forEach((inning: any) => {
    inning.batting.forEach((b: any) => {
      const pId = b.batsman.name;
      const roleStr = playerRoles[pId] || "";
      if (!players[pId]) players[pId] = { id: pId, name: b.batsman.name, stats: { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, lbwBowled: 0, maidens: 0, catches: 0, stumpings: 0, runOutDirect: 0, runOutIndirect: 0, dotBalls: 0, isDuck: false, isAnnounced: true, role: mapRole(roleStr) } };
      players[pId].stats.runs = b.r;
      players[pId].stats.balls = b.b;
      players[pId].stats.fours = b['4s'];
      players[pId].stats.sixes = b['6s'];
      players[pId].stats.strikeRate = b.sr;
      players[pId].stats.isDuck = b.r === 0 && !b['dismissal-text']?.includes("not out");
    });
    inning.bowling.forEach((bw: any) => {
      const pId = bw.bowler.name;
      const roleStr = playerRoles[pId] || "";
      if (!players[pId]) players[pId] = { id: pId, name: bw.bowler.name, stats: { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, lbwBowled: 0, maidens: 0, catches: 0, stumpings: 0, runOutDirect: 0, runOutIndirect: 0, dotBalls: 0, isDuck: false, isAnnounced: true, role: mapRole(roleStr) } };
      players[pId].stats.wickets = bw.w;
      players[pId].stats.maidens = bw.m;
      players[pId].stats.runsConceded = bw.r;
      players[pId].stats.economyRate = bw.eco;
      players[pId].stats.oversMoved = bw.o;
      players[pId].stats.dotBalls =
        Number(bw["0s"] ?? bw.dot_balls ?? bw.dots ?? 0) || 0;
    });
    if (inning.catching) {
        inning.catching.forEach((c: any) => {
            const pId = c.catcher.name;
            const roleStr = playerRoles[pId] || "";
            if (!players[pId]) players[pId] = { id: pId, name: c.catcher.name, stats: { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, lbwBowled: 0, maidens: 0, catches: 0, stumpings: 0, runOutDirect: 0, runOutIndirect: 0, dotBalls: 0, isDuck: false, isAnnounced: true, role: mapRole(roleStr) } };
            players[pId].stats.catches = (players[pId].stats.catches || 0) + (c.catch || 0);
            players[pId].stats.stumpings = (players[pId].stats.stumpings || 0) + (c.stumped || 0);
        });
    }
  });

  const leaderboard = Object.values(players).map((p: any) => ({
    ...p,
    breakdown: getDetailedBreakdown(p.stats as MatchStats)
  })).sort((a, b) => b.breakdown.total - a.breakdown.total);

  return (
    <div className="min-h-screen bg-[#f1f5f9] py-12 px-4 md:px-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="flex flex-col md:flex-row justify-between gap-8">
          <div>
            <h1 className="text-7xl font-black italic uppercase tracking-tighter text-slate-900 leading-[0.8]">MATCH <span className="text-blue-600">AUDIT</span></h1>
            <div className="flex gap-3 mt-4">
               <Badge className="bg-slate-900 px-4 h-8">{data.name}</Badge>
               <Badge variant="outline" className={cn("px-4 h-8 gap-2", source === 'live' ? "border-amber-200 text-amber-600 bg-amber-50" : "border-emerald-200 text-emerald-600 bg-emerald-50")}>
                  {source === 'live' ? <Globe size={12} /> : <Database size={12} />}
                  {source === 'live' ? "LIVE SCRAPE" : "DB CACHED"}
               </Badge>
            </div>
            <div className="flex gap-4 mt-6">
                <Button onClick={() => fetchLiveScorecard(matchId)} variant="outline" className="rounded-full bg-white h-10 px-6 text-[10px] font-black uppercase tracking-widest gap-2">
                    <RefreshCw size={14} /> Refresh Live
                </Button>
                {source === 'live' && (
                    <Button onClick={syncToDatabase} disabled={syncing} className="rounded-full bg-blue-600 text-white h-10 px-6 text-[10px] font-black uppercase tracking-widest gap-2">
                        {syncing ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Sync to DB
                    </Button>
                )}
            </div>
          </div>
          <Card className="p-8 min-w-[300px] rounded-[2rem] border-none shadow-xl">
             <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Total Points Distributed</div>
             <div className="text-6xl font-black italic text-slate-950 tracking-tighter">
                {Math.floor(leaderboard.reduce((acc, p) => acc + p.breakdown.total, 0))}
             </div>
          </Card>
        </div>

        {data.scorecard.map((inning: any, i: number) => (
          <div key={i} className="space-y-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-lg flex items-center gap-6">
               <div className="h-12 w-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xl">{i + 1}</div>
               <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">{inning.inning}</h2>
            </div>
            <div className="grid lg:grid-cols-2 gap-8">
               <Card className="rounded-[2.5rem] overflow-hidden bg-white border-none shadow-xl">
                  <Table><TableBody>{inning.batting.map((b: any, j: number) => (
                    <TableRow key={j} className="h-20"><TableCell className="px-8 font-black text-slate-900">{b.batsman.name}</TableCell><TableCell className="text-center font-black text-lg">{b.r} ({b.b})</TableCell><TableCell className="text-right px-8 font-black italic text-blue-600">{b.sr}</TableCell></TableRow>
                  ))}</TableBody></Table>
               </Card>
               <Card className="rounded-[2.5rem] overflow-hidden bg-white border-none shadow-xl">
                  <Table><TableBody>{inning.bowling.map((bw: any, j: number) => (
                    <TableRow key={j} className="h-20"><TableCell className="px-8 font-black text-slate-900">{bw.bowler.name}</TableCell><TableCell className="text-center font-black text-lg">{bw.o}-{bw.m}-{bw.r}-{bw.w}</TableCell><TableCell className="text-right px-8 font-black italic text-indigo-600">{bw.eco}</TableCell></TableRow>
                  ))}</TableBody></Table>
               </Card>
            </div>
          </div>
        ))}

        <div className="grid gap-6">
           {leaderboard.map((p, idx) => (
             <Card key={p.id} className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
                <div className="p-8"><div className="flex items-center justify-between">
                   <div className="flex items-center gap-8">
                      <div className="h-16 w-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-2xl">{idx + 1}</div>
                      <div><h4 className="text-2xl font-black italic uppercase text-slate-950">{p.name}</h4><Badge variant="secondary" className="uppercase text-[8px] font-black">{p.stats.role}</Badge></div>
                   </div>
                   <div className="flex items-center gap-8 text-right">
                      <div><div className="text-[10px] font-black uppercase text-slate-400">Total Points</div><div className="text-5xl font-black italic text-blue-600 tracking-tighter">{p.breakdown.total.toFixed(0)}</div></div>
                      <Button onClick={() => setExpandedPlayer(expandedPlayer === p.id ? null : p.id)} variant="ghost" className="h-14 w-14 rounded-2xl bg-slate-50">{expandedPlayer === p.id ? <ChevronUp /> : <ChevronDown />}</Button>
                   </div>
                </div></div>
                {expandedPlayer === p.id && (
                  <div className="p-8 pt-0 grid md:grid-cols-3 gap-8">
                     <AuditSection title="Batting" items={p.breakdown.batting} icon={<Zap size={14} />} color="bg-amber-50" />
                     <AuditSection title="Bowling" items={p.breakdown.bowling} icon={<Activity size={14} />} color="bg-indigo-50" />
                     <AuditSection title="Fielding" items={[...p.breakdown.fielding, ...p.breakdown.others]} icon={<Target size={14} />} color="bg-emerald-50" />
                  </div>
                )}
             </Card>
           ))}
        </div>
      </div>
    </div>
  );
}

function AuditSection({ title, items, icon, color }: { title: string, items: PointItem[], icon: any, color: string }) {
  const total = items.reduce((acc, it) => acc + it.points, 0);
  return (
    <div className={cn("p-6 rounded-[2rem] space-y-4", color)}>
       <div className="flex items-center justify-between border-b pb-2"><div className="flex items-center gap-2 text-[10px] font-black uppercase">{icon} {title}</div><Badge className="bg-slate-900">{total}</Badge></div>
       <div className="space-y-2">{items.map((it, idx) => (<div key={idx} className="flex justify-between text-[10px] font-bold uppercase text-slate-500"><span>{it.label}</span><span className="text-slate-900">{it.points}</span></div>))}</div>
    </div>
  );
}
