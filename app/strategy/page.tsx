"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Trophy, Shield, User, Zap, Star, Activity, 
  ChevronRight, Lock, History, AlertCircle, TrendingUp,
  Calculator, Save, RefreshCw, ChevronLeft, Search, Clock
} from "lucide-react";
import { cn, getPlayerImage } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { calculateDream11Points, MatchStats } from "@/lib/scoring";

export default function StrategyRoom() {
  const [profile, setProfile] = useState<any>(null);
  const [squad, setSquad] = useState<any[]>([]);
  const [allMatches, setAllMatches] = useState<any[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [matchPoints, setMatchPoints] = useState<Record<string, number>>({});
  const [nomination, setNomination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cvcChangesUsed, setCvcChangesUsed] = useState(0);
  const [activeTab, setActiveTab] = useState<"tactics" | "scores">("tactics");

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
    if (selectedMatchId && profile) {
      fetchMatchSpecificData(selectedMatchId);
    }
  }, [selectedMatchId, profile]);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/");
      return;
    }

    // 1. Profile & Squad
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    
    if (profileData) {
      setProfile(profileData);
      setCvcChangesUsed(profileData.cvc_changes_used || 0);

      const { data: squadData } = await supabase
        .from("players")
        .select("*")
        .eq("sold_to_id", profileData.id);
      
      if (squadData) setSquad(squadData);
    }

    // 2. All Matches
    const { data: matchesData } = await supabase
      .from("matches")
      .select("*")
      .order("match_no", { ascending: true });
    
    if (matchesData) {
      setAllMatches(matchesData);
      // Default to the first un-locked match, or the first one
      const nextMatch = matchesData.find(m => !m.is_locked) || matchesData[0];
      if (nextMatch) setSelectedMatchId(nextMatch.id);
    }

    setLoading(false);
  };

  const fetchMatchSpecificData = async (matchId: string) => {
    if (!profile) return;

    // 1. Current Nomination for this match
    const { data: nomData } = await supabase
      .from("nominations")
      .select("*")
      .eq("team_id", profile.id)
      .eq("match_id", matchId)
      .single();
    
    setNomination(nomData || null);

    // 2. Player Points for this match (only for squad)
    const { data: pointsData } = await supabase
      .from("match_points")
      .select("*")
      .eq("match_id", matchId)
      .in("player_id", squad.map(p => p.id));
    
    const pointsMap: Record<string, number> = {};
    pointsData?.forEach(p => {
      pointsMap[p.player_id] = p.points;
    });
    setMatchPoints(pointsMap);
  };

  const updateNomination = async (type: 'captain' | 'vc', playerId: string) => {
    if (!profile || !selectedMatchId) return;
    
    const selectedMatch = allMatches.find(m => m.id === selectedMatchId);
    if (selectedMatch?.is_locked) {
      alert("This match is locked. Strategy changes are no longer allowed.");
      return;
    }

    const isChange = (type === 'captain' && nomination?.captain_id !== playerId) ||
                     (type === 'vc' && nomination?.vc_id !== playerId);
    
    if (isChange && cvcChangesUsed >= 4) {
      alert("You have reached your limit of 4 C/VC changes for the season!");
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

  const updateScore = (playerId: string, val: string) => {
    const num = parseFloat(val) || 0;
    setMatchPoints(prev => ({ ...prev, [playerId]: num }));
  };

  const saveScores = async () => {
    if (!selectedMatchId || squad.length === 0) return;
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
      alert("Error saving scores: " + error.message);
    } else {
      alert("Match scores successfully recorded for your squad!");
    }
    setSaving(false);
  };

  const applyCalcPoints = () => {
    if (!calcActivePlayerId) return;
    const finalPoints = calculateDream11Points(calcStats as MatchStats);
    setMatchPoints(prev => ({ ...prev, [calcActivePlayerId]: finalPoints }));
    setCalcActivePlayerId(null);
  };

  const selectedMatch = allMatches.find(m => m.id === selectedMatchId);

  if (loading) return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
       <div className="text-white font-black italic uppercase tracking-tighter text-4xl animate-pulse">Initializing Strategy Command...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-800/30 p-8 rounded-[2rem] border border-slate-700/30 shadow-2xl backdrop-blur-xl">
           <div className="flex items-center gap-6">
              <div className="h-16 w-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-indigo-400/30">
                 <Zap size={32} className="text-white fill-white" />
              </div>
              <div>
                 <h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none">Strategy Room</h1>
                 <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-2 flex items-center gap-2">
                    <Activity size={12} className="text-emerald-500" />
                    Managing {profile?.team_name || "Unbranded Team"}
                 </p>
              </div>
           </div>

           <div className="flex flex-wrap items-center gap-4">
              <div className="bg-slate-900/80 px-5 py-3 rounded-2xl border border-slate-700/50">
                 <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">C/VC Changes Left</div>
                 <div className="flex items-center gap-3">
                    <span className={cn("text-xl font-black", (4 - cvcChangesUsed) === 0 ? "text-red-500" : "text-amber-500")}>
                      {4 - cvcChangesUsed} / 4
                    </span>
                    <div className="flex gap-0.5">
                       {[1, 2, 3, 4].map(idx => (
                          <div key={idx} className={cn("h-1 w-3 rounded-full", idx <= (4 - cvcChangesUsed) ? "bg-emerald-500" : "bg-slate-700")} />
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Match Selector & Tab Toggle */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="flex bg-slate-800/50 p-1 rounded-2xl border border-slate-700/50 w-full md:w-auto">
              <button 
                onClick={() => setActiveTab("tactics")}
                className={cn(
                  "flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === "tactics" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
                )}
              >
                Squad Tactics
              </button>
              <button 
                onClick={() => setActiveTab("scores")}
                className={cn(
                  "flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === "scores" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
                )}
              >
                Scorekeeping
              </button>
           </div>

           <div className="flex items-center gap-3 bg-slate-800/50 p-1.5 rounded-2xl border border-slate-700/50 w-full md:w-auto">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-slate-400 hover:text-white"
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
                className="bg-transparent font-black italic uppercase text-xs tracking-tighter text-white focus:outline-none cursor-pointer px-4"
              >
                 {allMatches.map(m => (
                    <option key={m.id} value={m.id} className="bg-slate-900 text-white">{m.title} (G{m.match_no})</option>
                 ))}
              </select>
              <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-slate-400 hover:text-white"
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           
           <div className="lg:col-span-2 space-y-8">
              {activeTab === "tactics" ? (
                 <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
                    {/* Active Match Strategy Selection */}
                    <Card className="bg-slate-800/40 border-slate-700/50 border shadow-2xl rounded-[2.5rem] overflow-hidden">
                       <CardHeader className="p-8 border-b border-slate-700/50 bg-slate-800/20">
                          <div className="flex items-center justify-between w-full">
                             <div>
                                <CardTitle className="text-2xl font-black uppercase italic tracking-tighter text-white">
                                   {selectedMatch?.title || "Match Selection"}
                                </CardTitle>
                                <CardDescription className="text-indigo-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 mt-1">
                                   <TrendingUp size={12} />
                                   Game {selectedMatch?.match_no} • Strategic Deployment
                                </CardDescription>
                             </div>
                             {selectedMatch?.is_locked ? (
                                <div className="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl border border-red-500/20 flex items-center gap-2">
                                   <Lock size={14} />
                                   <span className="text-[10px] font-black uppercase tracking-widest">Locked</span>
                                </div>
                             ) : (
                                <div className="bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-xl border border-emerald-500/20 flex items-center gap-2">
                                   <Clock size={14} className="animate-pulse" />
                                   <span className="text-[10px] font-black uppercase tracking-widest">Open</span>
                                </div>
                             )}
                          </div>
                       </CardHeader>
                       <CardContent className="p-8">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                   <Star size={12} className="text-amber-500 fill-amber-500" />
                                   Match Captain (2x Points)
                                </label>
                                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/30 flex items-center gap-4">
                                   {nomination?.captain_id ? (
                                      <>
                                        <div className="h-12 w-12 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
                                           <img src={getPlayerImage(squad.find(p => p.id === nomination.captain_id)?.image_url)!} className="w-full h-full object-cover object-top" alt="" />
                                        </div>
                                        <div className="flex-1">
                                           <div className="font-black italic uppercase text-lg leading-tight">{squad.find(p => p.id === nomination.captain_id)?.player_name}</div>
                                           <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Double Threat</div>
                                        </div>
                                      </>
                                   ) : (
                                      <div className="text-slate-600 font-black italic uppercase text-sm">Awaiting Designation</div>
                                   )}
                                </div>
                             </div>
                             
                             <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                   <Star size={12} className="text-indigo-400 fill-indigo-400" />
                                   Vice-Captain (1.5x)
                                </label>
                                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/30 flex items-center gap-4">
                                   {nomination?.vc_id ? (
                                      <>
                                        <div className="h-12 w-12 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
                                           <img src={getPlayerImage(squad.find(p => p.id === nomination.vc_id)?.image_url)!} className="w-full h-full object-cover object-top" alt="" />
                                        </div>
                                        <div className="flex-1">
                                           <div className="font-black italic uppercase text-lg leading-tight">{squad.find(p => p.id === nomination.vc_id)?.player_name}</div>
                                           <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Tactical Reserve</div>
                                        </div>
                                      </>
                                   ) : (
                                      <div className="text-slate-600 font-black italic uppercase text-sm">Awaiting Designation</div>
                                   )}
                                </div>
                             </div>
                          </div>
                       </CardContent>
                    </Card>

                    {/* Roster Selection */}
                    <div className="space-y-6">
                       <h3 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                          <Shield className="text-indigo-500" />
                          Franchise Roster
                       </h3>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {squad.map(player => (
                             <div 
                               key={player.id} 
                               className={cn(
                                 "group bg-slate-800/40 p-5 rounded-[2rem] border transition-all duration-300 hover:scale-[1.02] cursor-default",
                                 (nomination?.captain_id === player.id || nomination?.vc_id === player.id) 
                                   ? "border-indigo-500/50 shadow-lg shadow-indigo-500/10 bg-indigo-500/5" 
                                   : "border-slate-700/50 hover:border-slate-600"
                               )}
                             >
                                <div className="flex items-center gap-4">
                                   <div className="relative">
                                      <div className="h-16 w-16 rounded-2xl bg-slate-700 border border-slate-600 overflow-hidden">
                                         <img src={getPlayerImage(player.image_url)!} className="w-full h-full object-cover object-top filter grayscale group-hover:grayscale-0 transition-all" alt="" />
                                      </div>
                                      {nomination?.captain_id === player.id && (
                                         <div className="absolute -top-2 -right-2 h-7 w-7 bg-amber-500 rounded-lg flex items-center justify-center text-[10px] font-black shadow-xl border-2 border-slate-900">C</div>
                                      )}
                                      {nomination?.vc_id === player.id && (
                                         <div className="absolute -top-2 -right-2 h-7 w-7 bg-indigo-500 rounded-lg flex items-center justify-center text-[10px] font-black shadow-xl border-2 border-slate-900">VC</div>
                                      )}
                                   </div>
                                   <div className="flex-1">
                                      <div className="font-black italic uppercase text-lg leading-none">{player.player_name}</div>
                                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1.5">{player.role}</div>
                                   </div>
                                   {!selectedMatch?.is_locked && (
                                      <div className="flex flex-col gap-1.5">
                                         <Button 
                                           size="sm" 
                                           variant="ghost" 
                                           disabled={saving || nomination?.captain_id === player.id}
                                           onClick={() => updateNomination('captain', player.id)}
                                           className={cn(
                                             "h-7 px-3 rounded-lg text-[8px] font-black uppercase tracking-widest border border-slate-700",
                                             nomination?.captain_id === player.id ? "bg-amber-500 text-white border-none" : "hover:bg-amber-500 hover:text-white"
                                           )}
                                         >
                                           CAP
                                         </Button>
                                         <Button 
                                           size="sm" 
                                           variant="ghost" 
                                           disabled={saving || nomination?.vc_id === player.id}
                                           onClick={() => updateNomination('vc', player.id)}
                                           className={cn(
                                             "h-7 px-3 rounded-lg text-[8px] font-black uppercase tracking-widest border border-slate-700",
                                             nomination?.vc_id === player.id ? "bg-indigo-500 text-white border-none" : "hover:bg-indigo-500 hover:text-white"
                                           )}
                                         >
                                           VC
                                         </Button>
                                      </div>
                                   )}
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 </div>
              ) : (
                 <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <Card className="bg-slate-800/40 border-slate-700/50 border shadow-2xl rounded-[2.5rem] overflow-hidden">
                       <CardHeader className="p-8 border-b border-slate-700/50 bg-slate-800/20">
                          <div className="flex items-center justify-between">
                             <div>
                                <CardTitle className="text-2xl font-black uppercase italic tracking-tighter text-white">Match Points Entry</CardTitle>
                                <CardDescription className="text-indigo-400 font-bold uppercase text-[10px] tracking-widest mt-1">Manual score synchronization for your squad</CardDescription>
                             </div>
                             <Button 
                               onClick={saveScores} 
                               disabled={saving}
                               className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 rounded-2xl font-black uppercase tracking-widest flex gap-2 shadow-xl transition-all"
                             >
                                {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                                Save Points
                             </Button>
                          </div>
                       </CardHeader>
                       <CardContent className="p-0">
                          <div className="overflow-x-auto">
                             <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-900/50 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                   <tr>
                                      <th className="px-8 py-5">Squad Member</th>
                                      <th className="px-4 py-5">Role</th>
                                      <th className="px-8 py-5 text-right">Match Points</th>
                                   </tr>
                                </thead>
                                <tbody className="text-sm">
                                   {squad.map(player => (
                                      <tr key={player.id} className={cn("border-b border-slate-700/30 hover:bg-slate-700/10 transition-colors", calcActivePlayerId === player.id && "bg-indigo-500/5")}>
                                         <td className="px-8 py-4">
                                            <div className="flex items-center gap-4">
                                               <div className="h-10 w-10 rounded-xl bg-slate-800 overflow-hidden border border-slate-700">
                                                  <img src={getPlayerImage(player.image_url)!} className="w-full h-full object-cover object-top" alt="" />
                                               </div>
                                               <span className="font-bold text-white uppercase italic">{player.player_name}</span>
                                            </div>
                                         </td>
                                         <td className="px-4 py-4">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{player.role}</span>
                                         </td>
                                         <td className="px-8 py-4">
                                            <div className="flex items-center justify-end gap-3">
                                               <Button 
                                                  variant="ghost" 
                                                  size="icon" 
                                                  className={cn("h-8 w-8 rounded-lg transition-all", calcActivePlayerId === player.id ? "bg-amber-500 text-white" : "text-slate-500 hover:bg-slate-700")}
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
                                               <Input 
                                                  type="number"
                                                  step="0.5"
                                                  className="w-24 h-10 text-right font-black bg-slate-900 border-slate-700 rounded-xl focus:ring-0 focus:border-indigo-500"
                                                  value={matchPoints[player.id] || 0}
                                                  onChange={(e) => updateScore(player.id, e.target.value)}
                                               />
                                            </div>
                                         </td>
                                      </tr>
                                   ))}
                                </tbody>
                             </table>
                          </div>
                       </CardContent>
                    </Card>
                 </div>
              )}
           </div>

           {/* Sidebar - Season Progress & Calculator */}
           <div className="space-y-6">
              
              {/* Dynamic Calculator Sidebar */}
              {calcActivePlayerId && activeTab === 'scores' && (
                 <Card className="bg-indigo-600 border-none rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
                    <CardHeader className="p-8">
                       <CardTitle className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                          <Calculator className="text-indigo-300" />
                          Dream11 Calculator
                       </CardTitle>
                       <CardDescription className="text-indigo-200 font-bold text-[10px] tracking-widest uppercase">
                          Calculating for {squad.find(p => p.id === calcActivePlayerId)?.player_name}
                       </CardDescription>
                    </CardHeader>
                    <CardContent className="px-8 pb-8 space-y-4">
                       <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                             <label className="text-[9px] font-black uppercase text-indigo-300">Runs</label>
                             <Input type="number" className="bg-indigo-700 border-indigo-500 text-white font-bold" value={calcStats.runs} onChange={(e) => setCalcStats(prev => ({...prev, runs: parseInt(e.target.value) || 0}))} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[9px] font-black uppercase text-indigo-300">Balls</label>
                             <Input type="number" className="bg-indigo-700 border-indigo-500 text-white font-bold" value={calcStats.balls} onChange={(e) => setCalcStats(prev => ({...prev, balls: parseInt(e.target.value) || 0}))} />
                          </div>
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                             <label className="text-[9px] font-black uppercase text-indigo-300">Wickets</label>
                             <Input type="number" className="bg-indigo-700 border-indigo-500 text-white font-bold" value={calcStats.wickets} onChange={(e) => setCalcStats(prev => ({...prev, wickets: parseInt(e.target.value) || 0}))} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[9px] font-black uppercase text-indigo-300">Catches</label>
                             <Input type="number" className="bg-indigo-700 border-indigo-500 text-white font-bold" value={calcStats.catches} onChange={(e) => setCalcStats(prev => ({...prev, catches: parseInt(e.target.value) || 0}))} />
                          </div>
                       </div>
                       
                       <div className="pt-4 border-t border-indigo-500 flex justify-between items-center text-white">
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Result</span>
                          <span className="text-4xl font-black italic tracking-tighter">{calculateDream11Points(calcStats as MatchStats)}</span>
                       </div>

                       <div className="flex gap-2">
                          <Button 
                            className="flex-1 bg-amber-500 hover:bg-white hover:text-amber-600 text-white py-6 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all"
                            onClick={applyCalcPoints}
                          >
                            Apply Score
                          </Button>
                          <Button 
                             variant="ghost" 
                             className="px-3 text-indigo-200 hover:text-white"
                             onClick={() => setCalcActivePlayerId(null)}
                          >
                             Cancel
                          </Button>
                       </div>
                    </CardContent>
                 </Card>
              )}

              <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700/50 rounded-[2.5rem] shadow-2xl overflow-hidden">
                 <CardHeader className="p-8">
                    <CardTitle className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                       <TrendingUp className="text-indigo-400" />
                       Season Performance
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="px-8 pb-8 space-y-6">
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                       <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-2">Total Points Earned</div>
                       <div className="text-5xl font-black italic tracking-tighter text-white">{profile?.total_points || 0}</div>
                    </div>
                    
                    <Button 
                       className="w-full bg-slate-700 hover:bg-indigo-600 text-white py-7 rounded-3xl font-black uppercase tracking-widest shadow-xl transition-all"
                       onClick={() => router.push("/standings")}
                    >
                       Global Standings
                    </Button>
                 </CardContent>
              </Card>

              <Card className="bg-slate-900/40 border-slate-700/50 border rounded-[2.5rem] p-8">
                 <div className="flex items-center gap-4 mb-6">
                    <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center text-amber-500/50">
                       <AlertCircle size={20} />
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Regulations</div>
                 </div>
                 <ul className="space-y-4">
                    <li className="flex gap-4">
                       <div className="h-2 w-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                       <p className="text-xs font-bold text-slate-500 leading-relaxed">Scorekeeper mode is active. You are responsible for entering your own player points for each game.</p>
                    </li>
                    <li className="flex gap-4">
                       <div className="h-2 w-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                       <p className="text-xs font-bold text-slate-500 leading-relaxed">Changes to C/VC are absolute and tracked across all {allMatches.length} games. Limit: 4 changes.</p>
                    </li>
                 </ul>
              </Card>
           </div>

        </div>
      </div>
    </div>
  );
}
