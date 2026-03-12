"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Trophy, Shield, User, Zap, Star, Activity, 
  ChevronRight, Lock, History, AlertCircle, TrendingUp
} from "lucide-react";
import { cn, getPlayerImage } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function StrategyRoom() {
  const [profile, setProfile] = useState<any>(null);
  const [squad, setSquad] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [activeMatch, setActiveMatch] = useState<any>(null);
  const [nomination, setNomination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cvcChangesUsed, setCvcChangesUsed] = useState(0);

  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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

    // 2. Next Unlock Match
    const { data: matchesData } = await supabase
      .from("matches")
      .select("*")
      .eq("is_locked", false)
      .order("match_no", { ascending: true })
      .limit(1);
    
    if (matchesData && matchesData.length > 0) {
      const match = matchesData[0];
      setActiveMatch(match);

      // 3. Current Nomination for this match
      const { data: nomData } = await supabase
        .from("nominations")
        .select("*")
        .eq("team_id", session.user.id)
        .eq("match_id", match.id)
        .single();
      
      if (nomData) setNomination(nomData);
    }

    setLoading(false);
  };

  const updateNomination = async (type: 'captain' | 'vc', playerId: string) => {
    if (!profile || !activeMatch) return;
    
    // Safety: check if this constitutes a change to the profile's C/VC
    // Logic: If they have a previous nomination for ANY match, and this is DIFFERENT, it counts?
    // User said: "4 changes total for the season".
    // This usually means relative to their "Current active C/VC".
    
    const isChange = (type === 'captain' && nomination?.captain_id !== playerId) ||
                     (type === 'vc' && nomination?.vc_id !== playerId);
    
    if (isChange && cvcChangesUsed >= 4) {
      alert("You have reached your limit of 4 C/VC changes for the season!");
      return;
    }

    setSaving(true);
    const updates: any = {
      team_id: profile.id,
      match_id: activeMatch.id,
      [type === 'captain' ? 'captain_id' : 'vc_id']: playerId
    };

    const { error } = await supabase
      .from("nominations")
      .upsert(updates, { onConflict: "team_id,match_id" });

    if (!error && isChange) {
      // Increment changes used in profile
      await supabase
        .from("profiles")
        .update({ cvc_changes_used: cvcChangesUsed + 1 })
        .eq("id", profile.id);
      
      setCvcChangesUsed(cvcChangesUsed + 1);
    }

    if (error) alert(error.message);
    else await fetchData();
    
    setSaving(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
       <div className="text-white font-black italic uppercase tracking-tighter text-4xl animate-pulse">Entering Strategy Room...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-800/50 p-8 rounded-[2rem] border border-slate-700/50 shadow-2xl backdrop-blur-xl">
           <div className="flex items-center gap-6">
              <div className="h-20 w-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-indigo-400/30">
                 <Zap size={40} className="text-white fill-white" />
              </div>
              <div>
                 <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">Strategy Room</h1>
                 <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-2 flex items-center gap-2">
                    <Activity size={12} className="text-emerald-500" />
                    Managing {profile?.team_name || "Unbranded Team"}
                 </p>
              </div>
           </div>

           <div className="flex items-center gap-4">
              <div className="bg-slate-900/80 px-6 py-4 rounded-2xl border border-slate-700/50">
                 <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">C/VC Changes Left</div>
                 <div className="flex items-center gap-2">
                    <span className={cn("text-2xl font-black", (4 - cvcChangesUsed) === 0 ? "text-red-500" : "text-amber-500")}>
                      {4 - cvcChangesUsed}
                    </span>
                    <div className="flex gap-0.5">
                       {[1, 2, 3, 4].map(idx => (
                          <div key={idx} className={cn("h-1.5 w-4 rounded-full", idx <= (4 - cvcChangesUsed) ? "bg-amber-500" : "bg-slate-700")} />
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           
           {/* Active Match & Selection */}
           <div className="lg:col-span-2 space-y-6">
              <Card className="bg-slate-800/40 border-slate-700/50 border shadow-2xl rounded-[2.5rem] overflow-hidden">
                 <CardHeader className="p-8 border-b border-slate-700/50 bg-slate-800/20">
                    <div className="flex items-center justify-between w-full">
                       <div>
                          <CardTitle className="text-2xl font-black uppercase italic tracking-tighter text-white">
                             {activeMatch?.title || "No Upcoming Matches"}
                          </CardTitle>
                          <CardDescription className="text-indigo-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 mt-1">
                             <TrendingUp size={12} />
                             Game {activeMatch?.match_no} • Pre-Match Strategy Overdrive
                          </CardDescription>
                       </div>
                       <div className="bg-amber-500/10 text-amber-500 px-4 py-2 rounded-xl border border-amber-500/20 flex items-center gap-2">
                          <Clock size={14} className="animate-pulse" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Awaiting Lock</span>
                       </div>
                    </div>
                 </CardHeader>
                 <CardContent className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                             <Star size={12} className="text-amber-500 fill-amber-500" />
                             Selected Captain (2x Points)
                          </label>
                          <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/30 flex items-center gap-4">
                             {nomination?.captain_id ? (
                                <>
                                  <div className="h-12 w-12 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
                                     <img src={getPlayerImage(squad.find(p => p.id === nomination.captain_id)?.image_url)!} className="w-full h-full object-cover object-top" alt="" />
                                  </div>
                                  <div className="flex-1">
                                     <div className="font-black italic uppercase text-lg leading-tight">{squad.find(p => p.id === nomination.captain_id)?.player_name}</div>
                                     <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Master Strategist</div>
                                  </div>
                                </>
                             ) : (
                                <div className="text-slate-600 font-black italic uppercase text-sm">No Captain Selected</div>
                             )}
                          </div>
                       </div>
                       
                       <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                             <Star size={12} className="text-indigo-400 fill-indigo-400" />
                             Selected Vice-Captain (1.5x)
                          </label>
                          <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/30 flex items-center gap-4">
                             {nomination?.vc_id ? (
                                <>
                                  <div className="h-12 w-12 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
                                     <img src={getPlayerImage(squad.find(p => p.id === nomination.vc_id)?.image_url)!} className="w-full h-full object-cover object-top" alt="" />
                                  </div>
                                  <div className="flex-1">
                                     <div className="font-black italic uppercase text-lg leading-tight">{squad.find(p => p.id === nomination.vc_id)?.player_name}</div>
                                     <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Tactical Support</div>
                                  </div>
                                </>
                             ) : (
                                <div className="text-slate-600 font-black italic uppercase text-sm">No VC Selected</div>
                             )}
                          </div>
                       </div>
                    </div>
                 </CardContent>
              </Card>

              {/* Roster Selection */}
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                       <Shield className="text-indigo-500" />
                       Squad Selection
                    </h3>
                    <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                       {squad.length} Players Available
                    </div>
                 </div>

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
                                   <img src={getPlayerImage(player.image_url)!} className="w-full h-full object-cover object-top grayscale group-hover:grayscale-0 transition-all" alt="" />
                                </div>
                                {nomination?.captain_id === player.id && (
                                   <div className="absolute -top-2 -right-2 h-8 w-8 bg-amber-500 rounded-lg flex items-center justify-center text-[10px] font-black shadow-xl border-2 border-slate-800">C</div>
                                )}
                                {nomination?.vc_id === player.id && (
                                   <div className="absolute -top-2 -right-2 h-8 w-8 bg-indigo-500 rounded-lg flex items-center justify-center text-[10px] font-black shadow-xl border-2 border-slate-800">VC</div>
                                )}
                             </div>
                             <div className="flex-1">
                                <div className="font-black italic uppercase text-xl leading-none">{player.player_name}</div>
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1.5">{player.role}</div>
                             </div>
                             <div className="flex flex-col gap-2">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  disabled={saving || nomination?.captain_id === player.id}
                                  onClick={() => updateNomination('captain', player.id)}
                                  className={cn(
                                    "h-8 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-700",
                                    nomination?.captain_id === player.id ? "bg-amber-500 text-white border-none" : "hover:bg-amber-500 hover:text-white"
                                  )}
                                >
                                  SET C
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  disabled={saving || nomination?.vc_id === player.id}
                                  onClick={() => updateNomination('vc', player.id)}
                                  className={cn(
                                    "h-8 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-700",
                                    nomination?.vc_id === player.id ? "bg-indigo-500 text-white border-none" : "hover:bg-indigo-500 hover:text-white"
                                  )}
                                >
                                  SET VC
                                </Button>
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>

           {/* Sidebar - Season Progress */}
           <div className="space-y-6">
              <Card className="bg-gradient-to-br from-indigo-900 to-slate-900 border-none rounded-[2.5rem] shadow-2xl overflow-hidden">
                 <CardHeader className="p-8">
                    <CardTitle className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                       <TrendingUp className="text-indigo-400" />
                       Season Standing
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="px-8 pb-8 space-y-6">
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                       <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-2">Total Points Earned</div>
                       <div className="text-5xl font-black italic tracking-tighter">{profile?.total_points || 0}</div>
                    </div>
                    
                    <div className="space-y-4">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quick Stats</h4>
                       <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 text-center">
                             <div className="text-sm font-black italic uppercase">Rank</div>
                             <div className="text-xl font-black text-amber-500">#?</div>
                          </div>
                          <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 text-center">
                             <div className="text-sm font-black italic uppercase">Wins</div>
                             <div className="text-xl font-black text-indigo-400">0</div>
                          </div>
                       </div>
                    </div>

                    <Button className="w-full bg-indigo-600 hover:bg-white hover:text-indigo-600 text-white py-8 rounded-3xl font-black uppercase tracking-widest shadow-xl transition-all flex gap-3 group">
                       View Points History
                       <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                    </Button>
                 </CardContent>
              </Card>

              <Card className="bg-slate-800/40 border-slate-700/50 border rounded-[2.5rem] p-8">
                 <div className="flex items-center gap-4 mb-6">
                    <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center text-red-500">
                       <AlertCircle size={20} />
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Regulations</div>
                 </div>
                 <ul className="space-y-4">
                    <li className="flex gap-4">
                       <div className="h-2 w-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                       <p className="text-xs font-bold text-slate-400 leading-relaxed">Changes to C/VC are absolute. Once you hit 4, you cannot re-assign them for the rest of the season.</p>
                    </li>
                    <li className="flex gap-4">
                       <div className="h-2 w-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                       <p className="text-xs font-bold text-slate-400 leading-relaxed">Matches lock 5 minutes before the scheduled start time.</p>
                    </li>
                 </ul>
              </Card>
           </div>

        </div>
      </div>
    </div>
  );
}
