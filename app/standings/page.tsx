"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Trophy, Medal, TrendingUp, Users, Target, ArrowUpRight, ArrowDownRight, Minus, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function StandingsBoard() {
  const [standings, setStandings] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculateStandings();
  }, []);

  const calculateStandings = async () => {
    setLoading(true);

    // 1. Get all teams
    const { data: teams } = await supabase
      .from("profiles")
      .select("*")
      .neq("role", "Viewer")
      .order("team_name");

    // 2. Get all matches
    const { data: matchesData } = await supabase
      .from("matches")
      .select("*")
      .order("match_no", { ascending: true });
    
    setMatches(matchesData || []);

    // 3. Get all points and nominations
    const { data: allPoints } = await supabase.from("match_points").select("*");
    const { data: allNoms } = await supabase.from("nominations").select("*");
    const { data: allPlayers } = await supabase.from("players").select("id, sold_to_id");

    if (!teams || !allPlayers) return;

    // 4. Compute Standings
    const standingsData = teams.map(team => {
      let totalPoints = 0;
      
      // Calculate points per match
      const matchScores = (matchesData || []).map(match => {
        let matchTotal = 0;
        const nom = allNoms?.find(n => n.team_id === team.id && n.match_id === match.id);
        
        // Players owned by this team
        const teamPlayers = allPlayers.filter(p => p.sold_to_id === team.id);
        
        teamPlayers.forEach(player => {
          const ptRecord = allPoints?.find(p => p.player_id === player.id && p.match_id === match.id);
          if (ptRecord) {
            let pts = ptRecord.points;
            if (nom?.captain_id === player.id) pts *= 2;
            else if (nom?.vc_id === player.id) pts *= 1.5;
            matchTotal += pts;
          }
        });
        
        return matchTotal;
      });

      totalPoints = matchScores.reduce((a, b) => a + b, 0);

      return {
        ...team,
        totalPoints,
        lastMatchScore: matchScores[matchScores.length - 1] || 0,
        // For trend calculation (comparing last two matches)
        trend: matchScores.length > 1 
          ? matchScores[matchScores.length - 1] > matchScores[matchScores.length - 2] ? 'up' : 'down' 
          : 'neutral'
      };
    });

    // Sort by points descending
    standingsData.sort((a, b) => b.totalPoints - a.totalPoints);
    setStandings(standingsData);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full font-black uppercase text-[10px] tracking-widest border border-amber-200 shadow-sm">
             <Trophy size={14} />
             Championship Leaderboard
          </div>
          <h1 className="text-5xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">The Standings</h1>
          <p className="text-slate-500 font-bold uppercase text-xs tracking-widest pt-2">Live updates from {matches.length} matches played</p>
        </div>

        {/* Podium Top 3 */}
        {!loading && standings.length >= 3 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
             {/* 2nd Place */}
             <div className="order-2 md:order-1 flex flex-col justify-end">
                <div className="bg-white p-6 rounded-[2.5rem] border-b-8 border-slate-200 shadow-xl text-center space-y-4 relative">
                   <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-slate-200 text-slate-600 h-8 w-8 rounded-lg font-black flex items-center justify-center">2</div>
                   <div className="h-16 w-16 bg-slate-100 rounded-2xl mx-auto flex items-center justify-center border border-slate-200">
                      <Medal className="text-slate-400" size={32} />
                   </div>
                   <div>
                      <div className="font-black uppercase italic text-lg leading-none">{standings[1].team_name}</div>
                      <div className="text-2xl font-black text-slate-400 mt-2">{Math.floor(standings[1].totalPoints)}</div>
                   </div>
                </div>
             </div>
             {/* 1st Place */}
             <div className="order-1 md:order-2">
                <div className="bg-slate-900 p-8 rounded-[3rem] border-b-8 border-amber-500 shadow-2xl shadow-amber-500/10 text-center space-y-4 py-12 relative transform md:scale-110">
                   <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-amber-500 text-white h-12 w-12 rounded-xl font-black flex items-center justify-center shadow-lg">1</div>
                   <div className="h-24 w-24 bg-slate-800 rounded-3xl mx-auto flex items-center justify-center border border-slate-700 shadow-inner">
                      <Trophy className="text-amber-500" size={48} />
                   </div>
                   <div className="space-y-1">
                      <div className="font-black uppercase italic text-2xl text-white tracking-tighter leading-none">{standings[0].team_name}</div>
                      <div className="text-sm font-bold text-amber-500 uppercase tracking-widest">Current Leader</div>
                   </div>
                   <div className="text-5xl font-black italic tracking-tighter text-white">{Math.floor(standings[0].totalPoints)}</div>
                </div>
             </div>
             {/* 3rd Place */}
             <div className="order-3 flex flex-col justify-end">
                <div className="bg-white p-6 rounded-[2.5rem] border-b-8 border-amber-100 shadow-xl text-center space-y-4 relative">
                   <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-100 text-amber-600 h-8 w-8 rounded-lg font-black flex items-center justify-center">3</div>
                   <div className="h-16 w-16 bg-amber-50 rounded-2xl mx-auto flex items-center justify-center border border-amber-100">
                      <Medal className="text-amber-600/40" size={32} />
                   </div>
                   <div>
                      <div className="font-black uppercase italic text-lg leading-none">{standings[2].team_name}</div>
                      <div className="text-2xl font-black text-amber-600/40 mt-2">{Math.floor(standings[2].totalPoints)}</div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* Full Table */}
        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
           <CardHeader className="bg-slate-900 text-white p-8">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <Medal className="text-amber-500" />
                    <CardTitle className="text-xl font-black italic uppercase tracking-tight">Championship Table</CardTitle>
                 </div>
                 <div className="flex items-center gap-6">
                    <div className="text-center">
                       <div className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Avg Pts</div>
                       <div className="font-black text-xs text-amber-500">{(standings.reduce((s, t) => s + t.totalPoints, 0) / (standings.length || 1)).toFixed(1)}</div>
                    </div>
                 </div>
              </div>
           </CardHeader>
           <CardContent className="p-0">
              <Table>
                 <TableHeader className="bg-slate-50">
                    <TableRow className="border-none">
                       <TableHead className="w-20 text-center text-[10px] font-black uppercase tracking-widest">Rank</TableHead>
                       <TableHead className="text-[10px] font-black uppercase tracking-widest">Franchise</TableHead>
                       <TableHead className="text-center text-[10px] font-black uppercase tracking-widest">Matches</TableHead>
                       <TableHead className="text-center text-[10px] font-black uppercase tracking-widest">Last M</TableHead>
                       <TableHead className="text-center text-[10px] font-black uppercase tracking-widest">Trend</TableHead>
                       <TableHead className="text-right pr-12 text-[10px] font-black uppercase tracking-widest">Total Points</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {loading ? (
                       <TableRow>
                          <TableCell colSpan={6} className="h-64 text-center font-black uppercase tracking-widest text-slate-300 animate-pulse">Calculating Standings...</TableCell>
                       </TableRow>
                    ) : standings.map((team, idx) => (
                       <TableRow key={team.id} className="hover:bg-slate-50/50 transition-colors border-slate-50">
                          <TableCell className="text-center py-6">
                             <span className={cn(
                               "h-8 w-8 flex items-center justify-center rounded-lg font-black text-xs",
                               idx === 0 ? "bg-amber-500 text-white shadow-lg" : "bg-slate-100 text-slate-400"
                             )}>
                               {idx + 1}
                             </span>
                          </TableCell>
                          <TableCell>
                             <div className="flex items-center gap-4">
                                <div className="h-10 w-10 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center">
                                   <Shield className="text-slate-300" size={20} />
                                </div>
                                <div>
                                   <div className="font-black italic uppercase text-slate-900 leading-none">{team.team_name}</div>
                                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{team.full_name}</div>
                                </div>
                             </div>
                          </TableCell>
                          <TableCell className="text-center font-bold text-slate-500">{matches.length}</TableCell>
                          <TableCell className="text-center font-black text-slate-400">{Math.floor(team.lastMatchScore)}</TableCell>
                          <TableCell className="text-center">
                             <div className="flex justify-center">
                                {team.trend === 'up' ? <ArrowUpRight className="text-emerald-500" size={18} /> : 
                                 team.trend === 'down' ? <ArrowDownRight className="text-red-500" size={18} /> : 
                                 <Minus className="text-slate-300" size={18} />}
                             </div>
                          </TableCell>
                          <TableCell className="text-right pr-12 font-black italic text-2xl tracking-tighter text-slate-900">
                             {Math.floor(team.totalPoints)}
                          </TableCell>
                       </TableRow>
                    ))}
                 </TableBody>
              </Table>
           </CardContent>
        </Card>

      </div>
    </div>
  );
}
