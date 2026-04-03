"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MatchStats } from "@/lib/scoring";
import { supabase } from "@/lib/supabase";
import { Loader2, Zap, Trophy, User, ShieldCheck, ChevronDown, ChevronUp, Star, Activity, Target, Fingerprint } from "lucide-react";
import { cn } from "@/lib/utils";

// Import the cached match data to save credits
import testScorecardData from "@/lib/data/test_scorecard.json";

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

export default function TestScorecardPage() {
  const [data] = useState<any>(testScorecardData.data);
  const [playerRoles, setPlayerRoles] = useState<Record<string, string>>({});
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        setLoadingRoles(true);
        const playerIds = new Set<string>();
        data.scorecard.forEach((inning: any) => {
          inning.batting.forEach((b: any) => playerIds.add(b.batsman.id));
          inning.bowling.forEach((bw: any) => playerIds.add(bw.bowler.id));
          inning.catching.forEach((f: any) => playerIds.add(f.catcher.id));
        });

        const { data: dbPlayers } = await supabase
          .from("players")
          .select("api_player_id, role")
          .in("api_player_id", Array.from(playerIds));

        const roleMap: Record<string, string> = {};
        dbPlayers?.forEach(p => {
          roleMap[p.api_player_id] = p.role;
        });
        setPlayerRoles(roleMap);
      } catch (err: any) {
        console.error("Error fetching roles:", err.message);
      } finally {
        setLoadingRoles(false);
      }
    };

    if (data) fetchRoles();
  }, [data]);

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

     // Batting Points
     if (stats.runs > 0) batting.push({ label: 'Base Runs', points: stats.runs, value: stats.runs });
     if (stats.fours > 0) batting.push({ label: 'Boundary Bonus (4s)', points: stats.fours * 4, value: stats.fours });
     if (stats.sixes > 0) batting.push({ label: 'Six Bonus (6s)', points: stats.sixes * 6, value: stats.sixes });
     
     if (stats.runs >= 100) batting.push({ label: 'Century Bonus', points: 16 });
     else if (stats.runs >= 75) batting.push({ label: '75 Run Bonus', points: 12 });
     else if (stats.runs >= 50) batting.push({ label: 'Half-Century Bonus', points: 8 });
     else if (stats.runs >= 25) batting.push({ label: '25 Run Bonus', points: 4 });

     if (stats.isDuck) batting.push({ label: 'Duck Penalty', points: -2 });

     if (stats.balls >= 10 && stats.strikeRate !== undefined && stats.role !== 'Bowler') {
        if (stats.strikeRate > 170) batting.push({ label: 'Strike Rate Bonus (>170)', points: 6, value: stats.strikeRate });
        else if (stats.strikeRate > 150) batting.push({ label: 'Strike Rate Bonus (>150)', points: 4, value: stats.strikeRate });
        else if (stats.strikeRate > 130) batting.push({ label: 'Strike Rate Bonus (>130)', points: 2, value: stats.strikeRate });
        else if (stats.strikeRate < 50) batting.push({ label: 'Strike Rate Penalty (<50)', points: -6, value: stats.strikeRate });
        else if (stats.strikeRate < 60) batting.push({ label: 'Strike Rate Penalty (<60)', points: -4, value: stats.strikeRate });
        else if (stats.strikeRate <= 70) batting.push({ label: 'Strike Rate Penalty (<=70)', points: -2, value: stats.strikeRate });
     }

     // Bowling Points
     if (stats.wickets > 0) bowling.push({ label: 'Wickets', points: stats.wickets * 30, value: stats.wickets });
     if (stats.lbwBowled > 0) bowling.push({ label: 'LBW/Bowled Bonus', points: stats.lbwBowled * 8, value: stats.lbwBowled });
     if (stats.maidens > 0) bowling.push({ label: 'Maiden Over Bonus', points: stats.maidens * 12, value: stats.maidens });
     if (stats.dotBalls > 0) bowling.push({ label: 'Dot Ball Bonus', points: stats.dotBalls, value: stats.dotBalls });

     if (stats.wickets >= 5) bowling.push({ label: '5-Wicket Haul Bonus', points: 12 });
     else if (stats.wickets >= 4) bowling.push({ label: '4-Wicket Haul Bonus', points: 8 });
     else if (stats.wickets >= 3) bowling.push({ label: '3-Wicket Haul Bonus', points: 4 });

     if (stats.oversMoved && stats.oversMoved >= 2 && stats.economyRate !== undefined) {
        if (stats.economyRate < 5) bowling.push({ label: 'Economy Bonus (<5)', points: 6, value: stats.economyRate });
        else if (stats.economyRate < 6) bowling.push({ label: 'Economy Bonus (<6)', points: 4, value: stats.economyRate });
        else if (stats.economyRate <= 7) bowling.push({ label: 'Economy Bonus (<=7)', points: 2, value: stats.economyRate });
        else if (stats.economyRate > 12) bowling.push({ label: 'Economy Penalty (>12)', points: -6, value: stats.economyRate });
        else if (stats.economyRate > 11) bowling.push({ label: 'Economy Penalty (>11)', points: -4, value: stats.economyRate });
        else if (stats.economyRate >= 10) bowling.push({ label: 'Economy Penalty (>=10)', points: -2, value: stats.economyRate });
     }

     // Fielding Points
     if (stats.catches > 0) fielding.push({ label: 'Catches', points: stats.catches * 8, value: stats.catches });
     if (stats.catches >= 3) fielding.push({ label: '3-Catch Bonus', points: 4 });
     if (stats.stumpings > 0) fielding.push({ label: 'Stumpings', points: stats.stumpings * 12, value: stats.stumpings });
     if (stats.runOutDirect > 0) fielding.push({ label: 'Run-Out (Direct)', points: stats.runOutDirect * 12, value: stats.runOutDirect });
     if (stats.runOutIndirect > 0) fielding.push({ label: 'Run-Out (Indirect)', points: stats.runOutIndirect * 6, value: stats.runOutIndirect });

     // Others
     if (stats.isAnnounced) others.push({ label: 'Announced Player Bonus', points: 4 });

     const sum = (arr: PointItem[]) => arr.reduce((acc, it) => acc + it.points, 0);
     const total = sum(batting) + sum(bowling) + sum(fielding) + sum(others);
     return { batting, bowling, fielding, others, total };
  };

  // Process leaderboard points
  const players: Record<string, any> = {};
  data.scorecard.forEach((inning: any) => {
    inning.batting.forEach((b: any) => {
      const pId = b.batsman.id;
      const name = b.batsman.name;
      if (!players[pId]) players[pId] = { id: pId, name, stats: { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, lbwBowled: 0, maidens: 0, catches: 0, stumpings: 0, runOutDirect: 0, runOutIndirect: 0, dotBalls: 0, isDuck: false, isAnnounced: true, role: mapRole(playerRoles[pId]) } };
      players[pId].stats.runs = b.r;
      players[pId].stats.balls = b.b;
      players[pId].stats.fours = b['4s'];
      players[pId].stats.sixes = b['6s'];
      players[pId].stats.strikeRate = b.sr;
      players[pId].stats.isDuck = b.r === 0 && !b['dismissal-text']?.includes("not out");
    });
    inning.bowling.forEach((bw: any) => {
      const pId = bw.bowler.id;
      const name = bw.bowler.name;
      if (!players[pId]) players[pId] = { id: pId, name, stats: { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, lbwBowled: 0, maidens: 0, catches: 0, stumpings: 0, runOutDirect: 0, runOutIndirect: 0, dotBalls: 0, isDuck: false, isAnnounced: true, role: mapRole(playerRoles[pId]) } };
      players[pId].stats.wickets = bw.w;
      players[pId].stats.maidens = bw.m;
      players[pId].stats.runsConceded = bw.r;
      players[pId].stats.economyRate = bw.eco;
      players[pId].stats.oversMoved = bw.o;
    });
    inning.catching.forEach((f: any) => {
      const pId = f.catcher.id;
      const name = f.catcher.name;
      if (pId && !players[pId]) players[pId] = { id: pId, name, stats: { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, lbwBowled: 0, maidens: 0, catches: 0, stumpings: 0, runOutDirect: 0, runOutIndirect: 0, dotBalls: 0, isDuck: false, isAnnounced: true, role: mapRole(playerRoles[pId]) } };
      if (pId) {
        players[pId].stats.catches += (f.catch || 0);
        players[pId].stats.stumpings += (f.stumped || 0);
        players[pId].stats.runOutDirect += (f.runout || 0);
        players[pId].stats.lbwBowled += ((f.lbw || 0) + (f.bowled || 0));
      }
    });
  });

  const leaderboard = Object.values(players).map((p: any) => ({
    ...p,
    breakdown: getDetailedBreakdown(p.stats as MatchStats)
  })).sort((a, b) => b.breakdown.total - a.breakdown.total);

  return (
    <div className="min-h-screen bg-[#f1f5f9] py-12 px-4 md:px-12 font-sans selection:bg-blue-200">
      <div className="max-w-7xl mx-auto space-y-16">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter text-slate-900 leading-[0.8]">
              MATCH <span className="text-blue-600">VERIFIER</span>
            </h1>
            <div className="flex flex-wrap items-center gap-3">
               <Badge className="bg-slate-950 px-5 h-8 rounded-full text-[10px] tracking-widest uppercase border-none">IPL 2025 FINALS</Badge>
               <Badge variant="outline" className="border-blue-200 text-blue-600 bg-blue-50/50 px-5 h-8 rounded-full text-[10px] font-black uppercase tracking-widest">
                  <Fingerprint size={12} className="mr-2" /> AUDIT MODE ACTIVE
               </Badge>
            </div>
          </div>
          
          <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl shadow-blue-500/5 border border-slate-100 min-w-[320px] relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl group-hover:bg-blue-600/10 transition-all duration-700" />
             <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                   <Trophy size={14} className="text-amber-500" /> Total Fantasy Pool
                </span>
                <div className="flex items-center gap-2">
                   <div className="h-2 w-2 bg-emerald-500 rounded-full animate-ping" />
                   <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Live Engine</span>
                </div>
             </div>
             <div className="text-5xl font-black italic text-slate-950 tracking-tighter">
                {Math.floor(leaderboard.reduce((acc, p) => acc + p.breakdown.total, 0))} <span className="text-sm not-italic text-slate-300 font-bold ml-1 uppercase">Points Distributed</span>
             </div>
          </div>
        </div>

        {/* 📚 QUICK-REFERENCE RULEBOOK */}
        <Card className="border-none shadow-2xl shadow-blue-500/10 rounded-[3rem] overflow-hidden bg-white border border-blue-100/50">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-10 py-6 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white">
                   <Target size={20} />
                </div>
                <div>
                   <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">Point Calculation Rulebook</h3>
                   <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest opacity-80">Manual Verification Guide</p>
                </div>
             </div>
             <Badge className="bg-white text-blue-700 hover:bg-white border-none px-4 py-1.5 text-[10px] font-black uppercase tracking-widest">
                v1.2.0 Active
             </Badge>
          </div>
          <CardContent className="p-10 grid md:grid-cols-3 gap-12">
             <div className="space-y-6">
                <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3">
                   <Zap size={14} className="text-amber-500" /> Batting Standard
                </div>
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                   <RuleRow label="Run" val="+1" />
                   <RuleRow label="Boundary (4)" val="+4" />
                   <RuleRow label="Six (6)" val="+6" />
                   <RuleRow label="Duck" val="-2" />
                   <RuleRow label="25 Runs" val="+4" />
                   <RuleRow label="50 Runs" val="+8" />
                   <RuleRow label="75 Runs" val="+12" />
                   <RuleRow label="100 Runs" val="+16" />
                </div>
             </div>
             
             <div className="space-y-6">
                <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3">
                   <Activity size={14} className="text-indigo-600" /> Bowling Standard
                </div>
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                   <RuleRow label="Wicket" val="+30" />
                   <RuleRow label="Dot Ball" val="+1" />
                   <RuleRow label="LBW/Bowled" val="+8" />
                   <RuleRow label="Maiden" val="+12" />
                   <RuleRow label="3 Wkts" val="+4" />
                   <RuleRow label="4 Wkts" val="+8" />
                   <RuleRow label="5 Wkts" val="+12" />
                   <RuleRow label="ER < 5" val="+6" />
                </div>
             </div>

             <div className="space-y-6">
                <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3">
                   <ShieldCheck size={14} className="text-emerald-500" /> Special & SR
                </div>
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                   <RuleRow label="Playing 11" val="+4" />
                   <RuleRow label="Catch" val="+8" />
                   <RuleRow label="Stumping" val="+12" />
                   <RuleRow label="SR > 170" val="+6" />
                   <RuleRow label="SR 150-170" val="+4" />
                   <RuleRow label="SR 130-150" val="+2" />
                   <RuleRow label="SR < 50" val="-6" />
                   <RuleRow label="SR 50-60" val="-4" />
                </div>
             </div>
          </CardContent>
        </Card>

        {/* Dynamic Scorecards for Each Inning */}
        {data.scorecard.map((inning: any, i: number) => (
          <div key={i} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: `${i * 200}ms` }}>
            <div className="flex flex-col md:flex-row md:items-center gap-8 bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 relative group overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-full bg-slate-50 border-l border-slate-100 skew-x-[-20deg] translate-x-16 group-hover:translate-x-12 transition-transform duration-500" />
               <div className="h-16 w-16 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center font-black text-3xl shadow-lg relative z-10">
                  {i + 1}
               </div>
               <div className="flex-1 relative z-10">
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 mb-1">{inning.inning}</h2>
                  <div className="flex items-center gap-4">
                     <span className="text-amber-500 font-black italic text-xl">{data.score[i].r}/{data.score[i].w}</span>
                     <span className="h-1 w-1 bg-slate-300 rounded-full" />
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{data.score[i].o} OVERS COMPLETED</span>
                  </div>
               </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
               {/* 🏏 BATTING CARD */}
               <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white">
                  <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-6 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg text-white"><Zap size={14} /></div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 italic">Batting Unit</h3>
                     </div>
                     <Badge variant="outline" className="text-[9px] font-black opacity-40 border-slate-300 uppercase">Verification Ready</Badge>
                  </div>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-100 hover:bg-transparent">
                          <TableHead className="px-8 h-12 text-[9px] font-black uppercase tracking-widest text-slate-400">Batsman</TableHead>
                          <TableHead className="text-center h-12 text-[9px] font-black uppercase tracking-widest text-slate-400">R (4/6)</TableHead>
                          <TableHead className="text-right px-8 h-12 text-[9px] font-black uppercase tracking-widest text-slate-400">SR</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inning.batting.map((b: any, j: number) => (
                          <TableRow key={j} className="h-20 hover:bg-slate-50 transition-colors border-slate-100">
                            <TableCell className="px-8">
                               <div className="font-black text-slate-900 text-sm">{b.batsman.name}</div>
                               <div className="text-[10px] font-bold text-slate-400 truncate max-w-[150px]">{b['dismissal-text']}</div>
                            </TableCell>
                            <TableCell className="text-center">
                               <div className="font-black text-lg text-slate-950 leading-none">{b.r}</div>
                               <div className="text-[10px] font-bold text-blue-500 mt-1 uppercase tracking-tighter">
                                  {b['4s']} fours <span className="mx-0.5">•</span> {b['6s']} sixes
                               </div>
                            </TableCell>
                            <TableCell className="text-right px-8">
                               <div className="text-xs font-black italic text-slate-900 mb-0.5">{b.sr}</div>
                               <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{b.b} BALLS</div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
               </Card>

               {/* 🎳 BOWLING CARD */}
               <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white">
                  <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-6 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-lg text-white"><Activity size={14} /></div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 italic">Bowling Unit</h3>
                     </div>
                     <Badge variant="outline" className="text-[9px] font-black opacity-40 border-slate-300 uppercase">Verification Ready</Badge>
                  </div>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-100 hover:bg-transparent">
                          <TableHead className="px-8 h-12 text-[9px] font-black uppercase tracking-widest text-slate-400">Bowler</TableHead>
                          <TableHead className="text-center h-12 text-[9px] font-black uppercase tracking-widest text-slate-400">O-M-R-W</TableHead>
                          <TableHead className="text-right px-8 h-12 text-[9px] font-black uppercase tracking-widest text-slate-400">ECO</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inning.bowling.map((bw: any, j: number) => (
                          <TableRow key={j} className="h-20 hover:bg-slate-50 transition-colors border-slate-100">
                            <TableCell className="px-8">
                               <div className="font-black text-slate-900 text-sm">{bw.bowler.name}</div>
                               <div className="flex items-center gap-2 mt-1">
                                  {bw.w > 0 && <Badge className="bg-rose-500 text-white border-none h-4 text-[8px] font-black">{bw.w} WICKETS</Badge>}
                                  {bw.m > 0 && <Badge className="bg-amber-500 text-white border-none h-4 text-[8px] font-black">{bw.m} MAIDEN</Badge>}
                               </div>
                            </TableCell>
                            <TableCell className="text-center">
                               <div className="font-black text-lg text-slate-950 tracking-tighter">
                                  {bw.o}-{bw.m}-{bw.r}-<span className="text-rose-600">{bw.w}</span>
                               </div>
                            </TableCell>
                            <TableCell className="text-right px-8 font-black italic text-indigo-600 text-sm">
                               {bw.eco}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
               </Card>
            </div>
          </div>
        ))}

        {/* 📊 POINT REGISTRY (THE VERIFICATION ENGINE) */}
        <div className="space-y-12">
           <div className="text-center space-y-4">
              <h2 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter text-slate-900/5 leading-none select-none">FANTASY REGISTRY</h2>
              <div className="flex items-center justify-center gap-4">
                 <div className="h-0.5 w-12 bg-blue-600 rounded-full" />
                 <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Points Audit Log</h3>
                 <div className="h-0.5 w-12 bg-blue-600 rounded-full" />
              </div>
           </div>

           <div className="grid gap-6">
              {leaderboard.map((p, idx) => (
                <Card key={p.id} className="border-none shadow-xl hover:shadow-2xl shadow-slate-200/30 rounded-[2.5rem] overflow-hidden transition-all duration-300 group bg-white border border-transparent hover:border-blue-100">
                   <div className="p-8 md:p-10">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                         <div className="flex items-center gap-8">
                            <div className={cn(
                              "h-16 w-16 rounded-[1.25rem] flex items-center justify-center font-black text-2xl shadow-xl transition-all group-hover:rotate-12",
                              idx === 0 ? "bg-amber-400 text-white shadow-amber-400/20" : "bg-slate-900 text-white"
                            )}>
                               {idx + 1}
                            </div>
                            <div>
                               <h4 className="text-2xl font-black italic uppercase tracking-tighter text-slate-950 flex items-center gap-3">
                                  {p.name}
                                  {p.breakdown.total > 100 && <Star size={16} className="text-amber-500 fill-amber-500" />}
                               </h4>
                               <div className="flex items-center gap-3 mt-2">
                                  <Badge variant="secondary" className="bg-slate-100 text-slate-500 uppercase text-[8px] font-black tracking-widest px-3 py-0.5 rounded-full">{p.stats.role}</Badge>
                                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">ID: {p.id.split('-')[0]}</span>
                               </div>
                            </div>
                         </div>
                         
                         <div className="flex items-center gap-10">
                            <div className="text-right">
                               <div className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Audit Total</div>
                               <div className="text-5xl font-black italic text-blue-600 tracking-tighter">
                                  {p.breakdown.total.toFixed(0)}
                               </div>
                            </div>
                            <button 
                              onClick={() => setExpandedPlayer(expandedPlayer === p.id ? null : p.id)}
                              className="h-14 w-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 hover:shadow-md transition-all"
                            >
                               {expandedPlayer === p.id ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                            </button>
                         </div>
                      </div>

                      {/* ITEMIZED AUDIT LOG */}
                      {expandedPlayer === p.id && (
                        <div className="mt-10 pt-10 border-t border-slate-100 space-y-10 animate-in slide-in-from-top-4 duration-500">
                           <div className="grid md:grid-cols-3 gap-10">
                              <AuditSection title="Batting Unit" items={p.breakdown.batting} icon={<Zap size={14} className="text-amber-500" />} color="bg-amber-50/50" />
                              <AuditSection title="Bowling Unit" items={p.breakdown.bowling} icon={<Activity size={14} className="text-indigo-600" />} color="bg-indigo-50/50" />
                              <AuditSection title="Fielding & Misc" items={[...p.breakdown.fielding, ...p.breakdown.others]} icon={<Target size={14} className="text-emerald-500" />} color="bg-emerald-50/50" />
                           </div>
                           
                           {/* MANUALLY VERIFIABLE STATS DUMP */}
                           <div className="bg-slate-950 text-white p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group/stats">
                              <div className="absolute top-0 right-0 w-32 h-full bg-blue-600/10 skew-x-[15deg] translate-x-12" />
                              <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-8">
                                 <StatBox label="RUNS" value={p.stats.runs} />
                                 <StatBox label="FOURS" value={p.stats.fours} highlights="+4 bonus" />
                                 <StatBox label="SIXES" value={p.stats.sixes} highlights="+6 bonus" />
                                 <StatBox label="SR" value={p.stats.strikeRate || 'N/A'} />
                                 <StatBox label="WKTS" value={p.stats.wickets} highlights="+30 pts" />
                                 <StatBox label="LBW/B" value={p.stats.lbwBowled} highlights="+8 bonus" />
                                 <StatBox label="ECO" value={p.stats.economyRate || 'N/A'} />
                                 <StatBox label="CATCH" value={p.stats.catches} highlights="+8 pts" />
                              </div>
                           </div>
                        </div>
                      )}
                   </div>
                </Card>
              ))}
           </div>
        </div>

      </div>
    </div>
  );
}

function RuleRow({ label, val }: { label: string, val: string }) {
  return (
    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
       <span className="uppercase tracking-tighter">{label}</span>
       <span className="text-slate-900 font-black italic">{val}</span>
    </div>
  );
}

function AuditSection({ title, items, icon, color }: { title: string, items: PointItem[], icon: any, color: string }) {
  const total = items.reduce((acc, it) => acc + it.points, 0);
  
  return (
    <div className={cn("p-8 rounded-[2rem] space-y-6 border border-slate-100", color)}>
       <div className="flex items-center justify-between border-b border-slate-900/5 pb-4">
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-900">
             {icon} {title}
          </div>
          <Badge className={cn("border-none h-6 px-3 text-[10px] font-black", total >= 0 ? "bg-emerald-500 text-white" : "bg-rose-500 text-white")}>
             {total > 0 ? `+${total}` : total}
          </Badge>
       </div>
       <div className="space-y-4">
          {items.map((it, idx) => (
             <div key={idx} className="flex items-center justify-between group/row">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                   {it.label} {it.value !== undefined && <span className="text-slate-400 font-black ml-1">({it.value})</span>}
                </span>
                <span className={cn("text-xs font-black italic", it.points >= 0 ? "text-slate-900" : "text-rose-500")}>
                   {it.points > 0 ? `+${it.points}` : it.points}
                </span>
             </div>
          ))}
          {items.length === 0 && <div className="text-[10px] font-bold text-slate-300 italic">No events recorded</div>}
       </div>
    </div>
  );
}

function StatBox({ label, value, highlights }: { label: string, value: string | number, highlights?: string }) {
  return (
    <div className="space-y-2">
       <div className="text-[8px] font-black text-white/30 tracking-[0.2em] uppercase">{label}</div>
       <div className="text-2xl font-black italic tracking-tighter text-amber-400 leading-none">{value}</div>
       {highlights && <div className="text-[8px] font-black text-blue-400/80 uppercase tracking-widest">{highlights}</div>}
    </div>
  );
}
