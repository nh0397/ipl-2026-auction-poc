import React from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  '0s'?: number | string;
  WD?: number | string;
  NB?: number | string;
}

interface InningData {
  team: string;
  /** Batting side (ESPN scrape); optional */
  batting_team?: string;
  /** Opposition / bowling side when known (ESPN scrape) */
  bowling_team?: string;
  batting: BattingRow[];
  extras: { text: string; total: number };
  total: { score: string; overs: string; run_rate: string };
  fall_of_wickets: string[];
  bowling: BowlingRow[];
  yet_to_bat?: string[];
}

/** Last token of bowler name from "… b Bowler Name" / "lbw b …" in dismissal text. */
function bowlerTokenFromDismissal(dismissal: string): string | null {
  const d = String(dismissal || "");
  if (!d.trim() || /not out/i.test(d)) return null;
  const m = d.match(/\bb\s+([A-Za-zÀ-ÿ .'-]+?)\s*$/i) || d.match(/\bb\s+([A-Za-zÀ-ÿ .'-]+)/i);
  if (!m?.[1]) return null;
  const parts = m[1].trim().split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last || last.length < 2) return null;
  return last.toLowerCase();
}

function bowlingTableMatchesBowlerToken(token: string, bowling: BowlingRow[]): boolean {
  if (!token) return false;
  return (bowling || []).some((bw) => {
    const n = String(bw.bowler || "").trim().toLowerCase();
    if (!n || n === "bowling") return false;
    return n === token || n.endsWith(" " + token) || n.split(/\s+/).pop() === token || n.includes(token);
  });
}

/** Share of dismissals whose `b <bowler>` appears in this bowling table (0–1). No dismissals → 0.5 (neutral). */
function dismissalBowlingConsistency(inn: InningData): number {
  let matched = 0;
  let total = 0;
  for (const b of inn.batting || []) {
    const tok = bowlerTokenFromDismissal(String(b.dismissal || ""));
    if (!tok) continue;
    total += 1;
    if (bowlingTableMatchesBowlerToken(tok, inn.bowling || [])) matched += 1;
  }
  if (total === 0) return 0.5;
  return matched / total;
}

/** When two innings exist, sometimes batting₁ is paired with bowling₁ from the wrong block; swap if it improves dismissal↔bowling agreement. */
function alignBowlingToBattingOpposition(innings: InningData[]): InningData[] {
  if (innings.length !== 2) return innings;
  const [a, b] = innings;
  const asIs = dismissalBowlingConsistency(a) + dismissalBowlingConsistency(b);
  const swappedA = { ...a, bowling: b.bowling };
  const swappedB = { ...b, bowling: a.bowling };
  const ifSwapped = dismissalBowlingConsistency(swappedA) + dismissalBowlingConsistency(swappedB);
  if (ifSwapped > asIs + 0.01) {
    return [swappedA, swappedB];
  }
  return innings;
}

interface ScorecardData {
  match_info: any;
  innings: InningData[];
}

export default function ScorecardViewer({ scorecard }: { scorecard: ScorecardData }) {
  if (!scorecard || !scorecard.innings) return null;

  const innings = React.useMemo(
    () => alignBowlingToBattingOpposition(scorecard.innings),
    [scorecard.innings]
  );

  const normalizePlayerName = React.useCallback((raw: string) => {
    return String(raw || "")
      .replace(/†/g, "")
      .replace(/\(c\)/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  // This used to be computed per-row (O(batters * allDismissals)).
  // Precompute once per scorecard to avoid huge CPU/RAM spikes when opening the modal.
  const fieldingByPlayer = React.useMemo(() => {
    const map = new Map<string, { catches: number; stumpings: number }>();

    const bump = (key: string, kind: "catches" | "stumpings") => {
      const k = (key || "").toLowerCase().trim();
      if (!k) return;
      const curr = map.get(k) || { catches: 0, stumpings: 0 };
      curr[kind] += 1;
      map.set(k, curr);
    };

    for (const inn of innings || []) {
      for (const b of inn.batting || []) {
        const text = String(b.dismissal || "").toLowerCase();
        if (!text) continue;

        // Very lightweight parsing:
        // - catches: "c <fielder>" or "c †<keeper>"
        // - stumpings: "st †<keeper>"
        // Fielders/keepers here are the opposition (bowling side) for this batting card.
        const cMatch = text.match(/\bc\s+†?([a-z0-9 .'-]+)/i);
        if (cMatch?.[1]) bump(cMatch[1], "catches");
        const stMatch = text.match(/\bst\s+†([a-z0-9 .'-]+)/i);
        if (stMatch?.[1]) bump(stMatch[1], "stumpings");
      }
    }

    return map;
  }, [innings]);

  return (
    <div className="space-y-12">
      {innings.map((inning, idx) => (
        <div key={idx} className="space-y-4">
          {/* Header Section (Cricinfo Style) */}
          <div className="flex items-center justify-between px-6 py-3 bg-[#E3F2FD] border-l-4 border-blue-500 rounded-r-lg">
             <div>
               <h2 className="text-sm sm:text-lg font-black text-slate-900 uppercase tracking-tighter">
                 {inning.team} <span className="text-slate-500 font-bold ml-2 text-xs sm:text-sm lowercase">(20 ovs maximum)</span>
               </h2>
               {(inning.bowling_team || "").trim() ? (
                 <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wide">
                   Bowling & fielding: {(inning.bowling_team || "").trim()}
                 </p>
               ) : null}
             </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
            {/* Batting Table */}
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="px-6 h-10 text-[9px] font-black uppercase text-slate-500">BATTING</TableHead>
                  <TableHead className="text-right h-10 text-[9px] font-black uppercase text-slate-500">R</TableHead>
                  <TableHead className="text-right h-10 text-[9px] font-black uppercase text-slate-500">B</TableHead>
                  <TableHead className="text-right h-10 text-[9px] font-black uppercase text-slate-500">M</TableHead>
                  <TableHead className="text-right h-10 text-[9px] font-black uppercase text-slate-500">4s</TableHead>
                  <TableHead className="text-right h-10 text-[9px] font-black uppercase text-slate-500">6s</TableHead>
                  <TableHead className="text-right px-6 h-10 text-[9px] font-black uppercase text-slate-500">SR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inning.batting.filter(b => b.player && b.player !== "BATTING").map((b, j) => {
                  const key = normalizePlayerName(String(b.player || "")).toLowerCase();
                  const fielding = fieldingByPlayer.get(key) || { catches: 0, stumpings: 0 };
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
                    <TableRow key={j} className="h-12 hover:bg-slate-50/50 border-slate-50">
                      <TableCell className="px-6 py-2">
                        <div className="flex items-center justify-between group">
                          <div className="flex flex-col">
                             <div className="font-black text-[13px] text-slate-900 tracking-tight">{b.player}</div>
                             <div className="text-[10px] font-bold text-slate-400 capitalize">{b.dismissal}</div>
                          </div>
                          <Badge className="opacity-0 group-hover:opacity-100 transition-opacity bg-amber-50 text-amber-600 border-none font-black text-[9px]">
                             {String(Math.round(points))} PTS
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-black text-slate-950 text-sm">{b.R}</TableCell>
                      <TableCell className="text-right font-bold text-slate-500 text-sm px-2">{b.B}</TableCell>
                      <TableCell className="text-right font-bold text-slate-400 text-[11px] px-2">{b.M}</TableCell>
                      <TableCell className="text-right font-bold text-slate-600 text-[11px] px-2">{b['4s']}</TableCell>
                      <TableCell className="text-right font-bold text-slate-600 text-[11px] px-2">{b['6s']}</TableCell>
                      <TableCell className="text-right px-6 font-bold text-slate-900 text-[11px] tabular-nums">{b.SR}</TableCell>
                    </TableRow>
                  );
                })}
                {/* Total Stats (Cricinfo Style) */}
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableCell className="px-6 py-3">
                    <div className="font-black text-xs text-slate-900 italic">Extras</div>
                    <div className="text-[10px] font-bold text-slate-400 capitalize">{inning.extras?.text}</div>
                  </TableCell>
                  <TableCell className="text-right font-black text-slate-950 text-sm">{inning.extras?.total}</TableCell>
                  <TableCell colSpan={5}></TableCell>
                </TableRow>
                <TableRow className="bg-slate-100/50 border-t-2 border-slate-100">
                  <TableCell className="px-6 py-4">
                    <div className="font-black text-[15px] uppercase italic text-slate-900">Total</div>
                    <div className="text-[11px] font-black text-slate-500">{inning.total?.overs} Ov (RR: {inning.total?.run_rate})</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-black text-lg text-slate-900 tracking-tighter">{inning.total?.score}</div>
                  </TableCell>
                  <TableCell colSpan={5}></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Yet to Bat (Cricinfo Style) */}
          {inning.yet_to_bat && inning.yet_to_bat.length > 0 && (
            <div className="px-6 py-4 bg-white border border-slate-100 rounded-xl shadow-sm">
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Yet to Bat</div>
               <div className="flex flex-wrap gap-x-2 gap-y-1">
                 {inning.yet_to_bat.map((player, pidx) => (
                   <span key={pidx} className="text-[11px] font-black text-slate-800 hover:text-blue-600 cursor-default transition-colors">
                     {player}{pidx < inning.yet_to_bat!.length - 1 ? "," : ""}
                   </span>
                 ))}
               </div>
            </div>
          )}

          {/* Fall of Wickets */}
          {inning.fall_of_wickets && inning.fall_of_wickets.length > 0 && (
             <div className="px-6 py-4 bg-white border border-slate-100 rounded-xl shadow-sm">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-0.5 flex items-center justify-between">
                  FALL OF WICKETS
                  <span className="text-[9px] opacity-20 border border-slate-200 px-1 rounded">DRS</span>
                </div>
                <div className="text-[10px] font-bold text-slate-600 leading-relaxed">
                   {(inning.fall_of_wickets).map((fow, fidx) => (
                     <span key={fidx} className="mr-3">
                       <span className="font-black text-slate-900">{fidx + 1}-{fow.split('(')[0]}</span>
                       <span className="text-slate-400">({fow.split('(')[1] || ""}</span>
                       {fidx < inning.fall_of_wickets.length - 1 ? "," : ""}
                     </span>
                   ))}
                </div>
             </div>
          )}

          {/* Bowling Table (Cricinfo Style) — opposition figures for this batting innings */}
          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm mt-4">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="px-6 h-10 text-[9px] font-black uppercase text-slate-500">
                    BOWLING
                    {(inning.bowling_team || "").trim() ? (
                      <span className="block font-bold text-slate-400 normal-case tracking-tight mt-0.5">
                        {(inning.bowling_team || "").trim()}
                      </span>
                    ) : null}
                  </TableHead>
                  <TableHead className="text-right h-10 text-[9px] font-black uppercase text-slate-500 px-2">O</TableHead>
                  <TableHead className="text-right h-10 text-[9px] font-black uppercase text-slate-500 px-2">M</TableHead>
                  <TableHead className="text-right h-10 text-[9px] font-black uppercase text-slate-500 px-2">R</TableHead>
                  <TableHead className="text-right h-10 text-[9px] font-black uppercase text-slate-500 px-2">W</TableHead>
                  <TableHead className="text-right h-10 text-[9px] font-black uppercase text-slate-500 px-2">ECON</TableHead>
                  <TableHead className="text-right h-10 text-[9px] font-black uppercase text-slate-500 px-2">0S</TableHead>
                  <TableHead className="text-right h-10 text-[9px] font-black uppercase text-slate-500 px-2">WD</TableHead>
                  <TableHead className="text-right px-6 h-10 text-[9px] font-black uppercase text-slate-500 px-2">NB</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inning.bowling.filter(bw => bw.bowler && bw.bowler !== "BOWLING").map((bw, j) => {
                  return (
                    <TableRow key={j} className="h-12 hover:bg-slate-50/50 border-slate-50">
                      <TableCell className="px-6 py-2">
                        <div className="font-black text-[13px] text-slate-900 tracking-tight">{bw.bowler}</div>
                      </TableCell>
                      <TableCell className="text-right font-black text-slate-950 text-sm px-2 tabular-nums">{bw.O}</TableCell>
                      <TableCell className="text-right font-bold text-slate-500 text-sm px-2 tabular-nums">{bw.M}</TableCell>
                      <TableCell className="text-right font-bold text-slate-400 text-sm px-2 tabular-nums">{bw.R}</TableCell>
                      <TableCell className="text-right font-black text-rose-600 text-sm px-2 tabular-nums">{bw.W}</TableCell>
                      <TableCell className="text-right font-bold text-indigo-600 text-sm px-2 tabular-nums">{bw.ECON}</TableCell>
                      <TableCell className="text-right font-bold text-slate-500 text-[11px] px-2 tabular-nums">{bw['0s'] || 0}</TableCell>
                      <TableCell className="text-right font-bold text-slate-500 text-[11px] px-2 tabular-nums">{bw.WD || 0}</TableCell>
                      <TableCell className="text-right px-6 font-bold text-slate-500 text-[11px] px-2 tabular-nums">{bw.NB || 0}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}
