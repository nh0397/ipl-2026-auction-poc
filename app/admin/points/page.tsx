"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Trophy, Save, RefreshCw, ArrowLeft, ChevronLeft, ChevronRight, Calculator,
  Search, User, Zap, Activity
} from "lucide-react";
import Link from "next/link";
import { cn, getPlayerImage } from "@/lib/utils";
import { calculateDream11Points, MatchStats } from "@/lib/scoring";

export default function AdminPointsEditor() {
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [players, setPlayers] = useState<any[]>([]);
  const [matchPoints, setMatchPoints] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");

  // Calculator State
  const [calcStats, setCalcStats] = useState<Partial<MatchStats>>({
    runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, catches: 0, 
    stumpings: 0, lbwBowled: 0, maidens: 0, isDuck: false, role: 'Batter'
  });
  const [calcActivePlayerId, setCalcActivePlayerId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedMatchId) {
      fetchMatchPoints(selectedMatchId);
    }
  }, [selectedMatchId]);

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Matches
    const { data: matchesData } = await supabase
      .from("matches")
      .select("*")
      .order("match_no", { ascending: true });
    
    if (matchesData) {
      setMatches(matchesData);
      if (matchesData.length > 0) setSelectedMatchId(matchesData[0].id);
    }

    // 2. All sold players
    const { data: playersData } = await supabase
      .from("players")
      .select("*")
      .eq("auction_status", "sold")
      .order("player_name", { ascending: true });
    
    if (playersData) setPlayers(playersData);
    
    setLoading(false);
  };

  const fetchMatchPoints = async (matchId: string) => {
    const { data } = await supabase
      .from("match_points")
      .select("*")
      .eq("match_id", matchId);
    
    const pointsMap: Record<string, number> = {};
    data?.forEach(p => {
      pointsMap[p.player_id] = p.points;
    });
    setMatchPoints(pointsMap);
  };

  const updatePoint = (playerId: string, val: string) => {
    const num = parseFloat(val) || 0;
    setMatchPoints(prev => ({ ...prev, [playerId]: num }));
  };

  const saveAllPoints = async () => {
    if (!selectedMatchId) return;
    setSaving(true);

    const updates = Object.entries(matchPoints).map(([playerId, points]) => ({
      match_id: selectedMatchId,
      player_id: playerId,
      points: points
    }));

    const { error } = await supabase
      .from("match_points")
      .upsert(updates, { onConflict: "player_id,match_id" });

    if (error) {
      alert("Error saving points: " + error.message);
    } else {
      alert("Successfully saved points for the match!");
    }
    setSaving(false);
  };

  const selectedMatch = matches.find(m => m.id === selectedMatchId);
  const filteredPlayers = players.filter(p => 
    p.player_name.toLowerCase().includes(playerSearch.toLowerCase()) ||
    p.sold_to?.toLowerCase().includes(playerSearch.toLowerCase())
  );

  const updateCalcField = (field: keyof MatchStats, value: any) => {
    setCalcStats(prev => ({ ...prev, [field]: value }));
  };

  const applyCalcPoints = () => {
    if (!calcActivePlayerId) return;
    const finalPoints = calculateDream11Points(calcStats as MatchStats);
    setMatchPoints(prev => ({ ...prev, [calcActivePlayerId]: finalPoints }));
    // No closing automatically - user might want to adjust
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header content ... (keeping existing) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link 
              href="/admin" 
              className="h-10 w-10 border border-slate-200 rounded-full flex items-center justify-center hover:bg-white transition-all shadow-sm"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                <Trophy className="text-amber-500" />
                Scoreboard Editor
              </h1>
              <p className="text-sm text-slate-500 font-medium">Bulk update Dream11 points for Match Days</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                const idx = matches.findIndex(m => m.id === selectedMatchId);
                if (idx > 0) setSelectedMatchId(matches[idx-1].id);
              }}
              disabled={matches.findIndex(m => m.id === selectedMatchId) === 0}
            >
              <ChevronLeft size={20} />
            </Button>
            <span className="px-4 font-black uppercase text-xs tracking-widest text-slate-600">
               Game {selectedMatch?.match_no || "?"}
            </span>
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                   const idx = matches.findIndex(m => m.id === selectedMatchId);
                   if (idx < matches.length - 1) setSelectedMatchId(matches[idx+1].id);
                }}
                disabled={matches.findIndex(m => m.id === selectedMatchId) === matches.length - 1}
            >
              <ChevronRight size={20} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Main Table */}
          <Card className="lg:col-span-3 border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
             <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="font-black italic uppercase tracking-tighter text-3xl">
                      {selectedMatch?.title || "Match Scorecard"}
                    </CardTitle>
                    <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                      Editing points for Game {selectedMatch?.match_no}
                    </CardDescription>
                  </div>
                  
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <Input 
                      placeholder="Search player or team..."
                      value={playerSearch}
                      onChange={(e) => setPlayerSearch(e.target.value)}
                      className="pl-11 h-11 bg-white border-slate-100 rounded-xl font-bold text-sm focus-visible:ring-amber-500"
                    />
                  </div>
                </div>
             </CardHeader>
             
             <CardContent className="p-0">
               <div className="max-h-[600px] overflow-y-auto">
                 <Table>
                   <TableHeader className="bg-slate-50 sticky top-0 z-10">
                     <TableRow className="border-none">
                       <TableHead className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Player</TableHead>
                       <TableHead className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Franchise</TableHead>
                       <TableHead className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Match Points</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {loading ? (
                       <TableRow>
                          <TableCell colSpan={3} className="h-64 text-center font-black uppercase tracking-widest text-slate-300 animate-pulse">Initializing Data...</TableCell>
                       </TableRow>
                     ) : filteredPlayers.length === 0 ? (
                       <TableRow>
                          <TableCell colSpan={3} className="h-64 text-center font-black uppercase tracking-widest text-slate-300">No sold players found</TableCell>
                       </TableRow>
                     ) : filteredPlayers.map(player => (
                       <TableRow key={player.id} className={cn("hover:bg-slate-50/50 transition-colors border-slate-50", calcActivePlayerId === player.id && "bg-amber-50/30")}>
                          <TableCell className="px-8 py-4">
                             <div className="flex items-center gap-4">
                               <div className="h-10 w-10 rounded-xl bg-slate-100 overflow-hidden border border-slate-200">
                                 {player.image_url ? <img src={getPlayerImage(player.image_url)!} className="w-full h-full object-cover object-top" alt="" /> : <User size={20} className="m-auto mt-2 opacity-20" />}
                               </div>
                               <div>
                                 <div className="font-bold text-slate-900">{player.player_name}</div>
                                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{player.role}</div>
                               </div>
                             </div>
                          </TableCell>
                          <TableCell className="px-4 py-4">
                             <span className="text-xs font-black uppercase tracking-widest text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                               {player.sold_to}
                             </span>
                          </TableCell>
                          <TableCell className="px-8 py-4">
                             <div className="flex items-center justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className={cn("h-8 w-8 transition-all", calcActivePlayerId === player.id ? "text-amber-600 bg-amber-100" : "text-slate-300 hover:text-amber-500 hover:bg-amber-50")}
                                  onClick={() => {
                                    setCalcActivePlayerId(player.id);
                                    // Reset calc stats for this player type if needed
                                    const role = player.role?.toLowerCase();
                                    setCalcStats(prev => ({
                                      ...prev,
                                      role: role?.includes('bowl') ? 'Bowler' : role?.includes('wk') ? 'WK' : role?.includes('all') ? 'All-Rounder' : 'Batter'
                                    }));
                                  }}
                                >
                                  <Calculator size={14} />
                                </Button>
                                <Input 
                                  type="number"
                                  step="0.5"
                                  className="w-24 h-10 text-right font-black text-slate-900 bg-slate-50 border-slate-100 rounded-xl focus-visible:ring-amber-500"
                                  value={matchPoints[player.id] || 0}
                                  onChange={(e) => updatePoint(player.id, e.target.value)}
                                />
                             </div>
                          </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               </div>
             </CardContent>
             
             <div className="p-8 border-t border-slate-50 bg-slate-50/30 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400">Total {filteredPlayers.length} players eligible for scoring</p>
                <Button 
                  onClick={saveAllPoints} 
                  disabled={saving}
                  className="bg-slate-900 hover:bg-black text-white px-10 py-6 rounded-2xl font-black uppercase tracking-widest flex gap-2 shadow-xl hover:scale-105 transition-all active:scale-95"
                >
                  {saving ? <RefreshCw className="animate-spin" /> : <Save size={18} />}
                  Save All Changes
                </Button>
             </div>
          </Card>

          {/* Sidebar - Calculator */}
          <div className="space-y-6">
             <Card className="border-none shadow-xl rounded-[2rem] bg-indigo-600 text-white overflow-hidden">
                <CardHeader className="pb-4">
                   <CardTitle className="flex items-center gap-2 text-xl font-black uppercase italic tracking-tighter">
                     <Calculator size={22} className="text-indigo-300" />
                     Points Calc
                   </CardTitle>
                   <CardDescription className="text-indigo-200 font-bold text-[10px] tracking-widest uppercase">
                     {calcActivePlayerId ? "Dream11 Quick Entry" : "Select a player to calculate"}
                   </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   {calcActivePlayerId ? (
                      <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
                         
                         <div className="grid grid-cols-2 gap-2">
                           <div className="space-y-1">
                             <label className="text-[9px] font-black uppercase text-indigo-300">Runs</label>
                             <Input 
                                type="number" 
                                className="h-9 bg-indigo-700/50 border-indigo-400/30 text-white font-bold"
                                value={calcStats.runs}
                                onChange={(e) => updateCalcField('runs', parseInt(e.target.value) || 0)}
                             />
                           </div>
                           <div className="space-y-1">
                             <label className="text-[9px] font-black uppercase text-indigo-300">Balls</label>
                             <Input 
                                type="number" 
                                className="h-9 bg-indigo-700/50 border-indigo-400/30 text-white font-bold"
                                value={calcStats.balls}
                                onChange={(e) => updateCalcField('balls', parseInt(e.target.value) || 0)}
                             />
                           </div>
                         </div>

                         <div className="grid grid-cols-2 gap-2">
                           <div className="space-y-1">
                             <label className="text-[9px] font-black uppercase text-indigo-300">4s / 6s</label>
                             <div className="flex gap-1">
                                <Input type="number" placeholder="4" className="h-9 bg-indigo-700/50 border-indigo-400/30 text-white p-2" value={calcStats.fours} onChange={(e) => updateCalcField('fours', parseInt(e.target.value) || 0)} />
                                <Input type="number" placeholder="6" className="h-9 bg-indigo-700/50 border-indigo-400/30 text-white p-2" value={calcStats.sixes} onChange={(e) => updateCalcField('sixes', parseInt(e.target.value) || 0)} />
                             </div>
                           </div>
                           <div className="space-y-1">
                             <label className="text-[9px] font-black uppercase text-indigo-300">Wickets</label>
                             <Input type="number" className="h-9 bg-indigo-700/50 border-indigo-400/30 text-white" value={calcStats.wickets} onChange={(e) => updateCalcField('wickets', parseInt(e.target.value) || 0)} />
                           </div>
                         </div>

                         <div className="grid grid-cols-2 gap-2">
                           <div className="space-y-1">
                             <label className="text-[9px] font-black uppercase text-indigo-300">Catches</label>
                             <Input type="number" className="h-9 bg-indigo-700/50 border-indigo-400/30 text-white" value={calcStats.catches} onChange={(e) => updateCalcField('catches', parseInt(e.target.value) || 0)} />
                           </div>
                           <div className="space-y-1">
                             <label className="text-[9px] font-black uppercase text-indigo-300">Maidens</label>
                             <Input type="number" className="h-9 bg-indigo-700/50 border-indigo-400/30 text-white" value={calcStats.maidens} onChange={(e) => updateCalcField('maidens', parseInt(e.target.value) || 0)} />
                           </div>
                         </div>

                         <div className="flex items-center gap-2 pt-2">
                            <input 
                              type="checkbox" 
                              checked={calcStats.isDuck} 
                              onChange={(e) => updateCalcField('isDuck', e.target.checked)}
                              className="h-4 w-4 accent-amber-400"
                            />
                            <label className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Dismissed for Duck?</label>
                         </div>

                         <div className="pt-4 space-y-2">
                            <div className="flex justify-between items-center text-indigo-100 font-black">
                               <span className="text-[10px] uppercase">Calculated Points</span>
                               <span className="text-2xl italic tracking-tighter">{calculateDream11Points(calcStats as MatchStats)}</span>
                            </div>
                            <Button 
                              onClick={applyCalcPoints}
                              className="w-full bg-amber-500 hover:bg-white hover:text-amber-600 text-white font-black uppercase tracking-widest py-6 rounded-2xl shadow-lg transition-all"
                            >
                              Apply to Player
                            </Button>
                            <Button 
                              variant="ghost" 
                              className="w-full text-indigo-200 hover:text-white font-black uppercase tracking-widest text-[9px]"
                              onClick={() => setCalcActivePlayerId(null)}
                            >
                              Dismiss Calc
                            </Button>
                         </div>
                      </div>
                   ) : (
                      <div className="py-8 text-center space-y-4 opacity-60">
                         <div className="h-16 w-16 bg-indigo-500/30 rounded-full flex items-center justify-center mx-auto border border-indigo-400/20">
                            <Zap size={32} />
                         </div>
                         <p className="text-xs font-bold px-4">Click the calculator icon in any row to accurately compute points based on Dream11 rules.</p>
                      </div>
                   )}
                </CardContent>
             </Card>

             <Card className="border-none shadow-lg rounded-[2rem] bg-white">
                <CardHeader className="pb-2">
                   <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Quick Tips</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="flex gap-3">
                      <div className="h-8 w-8 shrink-0 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                         <Activity size={16} />
                      </div>
                      <p className="text-[11px] font-medium leading-tight text-slate-500">Changes are saved per Match ID. Ensure you select the correct Game before saving.</p>
                   </div>
                   <div className="flex gap-3">
                      <div className="h-8 w-8 shrink-0 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                         <Trophy size={16} />
                      </div>
                      <p className="text-[11px] font-medium leading-tight text-slate-500">Live points will update on the Leaderboard as soon as you hit Save.</p>
                   </div>
                </CardContent>
             </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
