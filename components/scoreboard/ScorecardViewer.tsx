import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Zap, Activity, Target } from "lucide-react";
import { calculateDream11Points, MatchStats } from "@/lib/scoring";

interface BattingRow {
  player: string;
  dismissal: string;
  R: number | string;
  B: number | string;
  M: number | string;
  '4s': number | string;
  '6s': number | string;
  SR: number | string;
}

interface BowlingRow {
  bowler: string;
  O: number | string;
  M: number | string;
  R: number | string;
  W: number | string;
  ECON: number | string;
}

interface InningData {
  team: string;
  batting: BattingRow[];
  extras: { text: string; total: number };
  total: { score: string; overs: string; run_rate: string };
  fall_of_wickets: string[];
  bowling: BowlingRow[];
}

interface ScorecardData {
  match_info: any;
  innings: InningData[];
}

export default function ScorecardViewer({ scorecard }: { scorecard: ScorecardData }) {
  if (!scorecard || !scorecard.innings) return null;

  const getFieldingStats = (player: string, innings: InningData[]) => {
    let catches = 0;
    let stumpings = 0;
    innings.forEach(inn => {
      inn.batting.forEach(b => {
        const text = (b.dismissal || "").toLowerCase();
        if (text.includes(`c ${player.toLowerCase()}`) || text.includes(`c †${player.toLowerCase()}`)) catches++;
        if (text.includes(`st †${player.toLowerCase()}`)) stumpings++;
      });
    });
    return { catches, stumpings };
  };

  const getBowlingBonusStats = (player: string, innings: InningData[]) => {
    let lbwBowled = 0;
    innings.forEach(inn => {
      inn.batting.forEach(b => {
        const text = (b.dismissal || "").toLowerCase();
        if (text.includes(`b ${player.toLowerCase()}`) && (text.startsWith('b ') || text.includes('lbw b '))) lbwBowled++;
      });
    });
    return lbwBowled;
  };

  return (
    <div className="space-y-8 p-1 sm:p-4">
      {scorecard.innings.map((inning, idx) => (
        <div key={idx} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row md:items-center gap-4 bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-full bg-blue-600/10 skew-x-[-20deg] translate-x-16" />
            <div className="h-12 w-12 bg-white/10 rounded-xl flex items-center justify-center font-black text-xl shadow-lg relative z-10 shrink-0">
              {idx + 1}
            </div>
            <div className="flex-1 relative z-10">
              <h2 className="text-xl font-black uppercase italic tracking-tighter mb-1">{inning.team}</h2>
              <div className="flex items-center gap-3">
                <span className="text-amber-400 font-black italic text-2xl">{inning.total?.score || "0/0"}</span>
                <span className="h-1 w-1 bg-white/20 rounded-full" />
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{inning.total?.overs || 0} OVERS (RR {inning.total?.run_rate || 0})</span>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white border border-slate-100">
              <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap size={14} className="text-blue-600" />
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900 italic">Batting</h3>
                </div>
              </div>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-50 hover:bg-transparent">
                      <TableHead className="px-6 h-10 text-[8px] font-black uppercase tracking-widest text-slate-400">Batsman</TableHead>
                      <TableHead className="text-center h-10 text-[8px] font-black uppercase tracking-widest text-slate-400">R (B)</TableHead>
                      <TableHead className="text-center h-10 text-[8px] font-black uppercase tracking-widest text-slate-400">4s/6s/SR</TableHead>
                      <TableHead className="text-right px-6 h-10 text-[8px] font-black uppercase tracking-widest text-amber-500">PTS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inning.batting.map((b, j) => {
                      const fielding = getFieldingStats(b.player, scorecard.innings);
                      const stats: MatchStats = {
                        runs: Number(b.R) || 0,
                        balls: Number(b.B) || 0,
                        fours: Number(b['4s']) || 0,
                        sixes: Number(b['6s']) || 0,
                        strikeRate: Number(b.SR) || 0,
                        wickets: 0,
                        lbwBowled: 0,
                        maidens: 0,
                        dotBalls: 0,
                        catches: fielding.catches || 0,
                        stumpings: fielding.stumpings || 0,
                        runOutDirect: 0,
                        runOutIndirect: 0,
                        isDuck: (Number(b.R) || 0) === 0 && !(b.dismissal || "").toLowerCase().includes("not out"),
                        isAnnounced: true,
                        role: b.player.includes('†') ? 'WK' : 'Batter'
                      };
                      const points = calculateDream11Points(stats) || 0;
                      return (
                        <TableRow key={j} className="h-16 hover:bg-slate-50 transition-colors border-slate-50">
                          <TableCell className="px-6">
                            <div className="font-black text-slate-900 text-sm truncate max-w-[120px]">{b.player}</div>
                            <div className="text-[9px] font-bold text-slate-400 truncate max-w-[150px]">{b.dismissal}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="font-black text-base text-slate-950">{b.R}</div>
                            <div className="text-[9px] font-bold text-slate-400">({b.B}b)</div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-[10px] font-black text-slate-950 mb-0.5">{b.SR}</div>
                            <div className="text-[9px] font-bold text-blue-500 uppercase flex justify-center gap-1">
                              <span>{b['4s']}x4</span> <span>{b['6s']}x6</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-6">
                             <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none font-black text-[10px] tabular-nums">
                                {String(Math.round(points))}
                             </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white border border-slate-100">
              <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity size={14} className="text-indigo-600" />
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900 italic">Bowling</h3>
                </div>
              </div>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-50 hover:bg-transparent">
                      <TableHead className="px-6 h-10 text-[8px] font-black uppercase tracking-widest text-slate-400">Bowler</TableHead>
                      <TableHead className="text-center h-10 text-[8px] font-black uppercase tracking-widest text-slate-400">O-M-R-W</TableHead>
                      <TableHead className="text-center h-10 text-[8px] font-black uppercase tracking-widest text-slate-400">ECON</TableHead>
                      <TableHead className="text-right px-6 h-10 text-[8px] font-black uppercase tracking-widest text-amber-500">PTS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inning.bowling.filter(bw => bw.bowler !== "BOWLING").map((bw, j) => {
                      const fielding = getFieldingStats(bw.bowler, scorecard.innings);
                      const lbwBowled = getBowlingBonusStats(bw.bowler, scorecard.innings);
                      const batting = inning.batting.find(b => b.player === bw.bowler);
                      const stats: MatchStats = {
                        runs: batting ? (Number(batting.R) || 0) : 0,
                        balls: batting ? (Number(batting.B) || 0) : 0,
                        fours: batting ? (Number(batting['4s']) || 0) : 0,
                        sixes: batting ? (Number(batting['6s']) || 0) : 0,
                        strikeRate: batting ? (Number(batting.SR) || 0) : 0,
                        wickets: Number(bw.W) || 0,
                        lbwBowled: lbwBowled || 0,
                        maidens: Number(bw.M) || 0,
                        dotBalls: 0,
                        catches: fielding.catches || 0,
                        stumpings: fielding.stumpings || 0,
                        runOutDirect: 0,
                        runOutIndirect: 0,
                        economyRate: Number(bw.ECON) || 0,
                        oversMoved: Number(bw.O) || 0,
                        isDuck: batting ? ((Number(batting.R) || 0) === 0 && !(batting.dismissal || "").toLowerCase().includes("not out")) : false,
                        isAnnounced: true,
                        role: 'Bowler'
                      };
                      const points = calculateDream11Points(stats) || 0;
                      return (
                        <TableRow key={j} className="h-16 hover:bg-slate-50 transition-colors border-slate-50">
                          <TableCell className="px-6 font-black text-slate-900 text-sm whitespace-nowrap">{bw.bowler}</TableCell>
                          <TableCell className="text-center">
                            <div className="font-black text-base text-slate-950 tabular-nums">{bw.O}-{bw.M}-{bw.R}-<span className="text-rose-600">{bw.W}</span></div>
                          </TableCell>
                          <TableCell className="text-center px-6 text-xs font-black italic text-indigo-600">{bw.ECON}</TableCell>
                          <TableCell className="text-right px-6">
                             <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none font-black text-[10px] tabular-nums">
                                {String(Math.round(points))}
                             </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {inning.fall_of_wickets && (
            <div className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm">
              <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2">
                <Target size={12} className="text-slate-300" /> Fall of Wickets
              </h4>
              <div className="flex flex-wrap gap-2">
                {inning.fall_of_wickets.map((fow, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] font-bold border-slate-100 bg-slate-50/50 text-slate-500 py-1.5 px-3 rounded-xl hover:bg-white transition-colors">
                    {String(fow)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
