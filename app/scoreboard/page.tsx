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
import { useAuth } from "@/components/auth/AuthProvider";
import React from "react";
import ScorecardViewer from "@/components/scoreboard/ScorecardViewer";
import {
  scorePjRulesPlayer,
  pjRulesDetailedBreakdown,
  d11BonusMultiplierInfo,
  d11PointsAfterMultiplier,
  parseLbwBowledBowlerName,
  pjResolveScoringPlayerRole,
  type PjRulesDetailedBreakdown,
  type D11BonusMultiplierInfo,
} from "@/lib/scoring";

type PlayerCatalogRow = {
  player_name: string;
  team: string;
  type: string | null;
  role: string | null;
};

function normalizeScorecardPlayerName(raw: string) {
  return String(raw || "")
    .replace(/†/g, "")
    .replace(/\(c\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function catalogNameMatches(scorecardNorm: string, dbName: string): boolean {
  const a = scorecardNorm.toLowerCase().replace(/\s+/g, " ").trim();
  const b = normalizeScorecardPlayerName(dbName).toLowerCase();
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const al = a.split(/\s+/).pop() || a;
  const bl = b.split(/\s+/).pop() || b;
  if (al === bl && al.length >= 3) return true;
  return false;
}

function catalogTeamMatches(
  scorecardTeam: string,
  playerTeam: string,
  match: {
    team1_short?: string | null;
    team1_name?: string | null;
    team2_short?: string | null;
    team2_name?: string | null;
  }
): boolean {
  const pt = playerTeam.trim().toLowerCase();
  if (!pt) return true;
  const st = scorecardTeam.trim().toLowerCase();
  if (st.includes(pt) || pt.includes(st)) return true;
  const hints = [match.team1_short, match.team1_name, match.team2_short, match.team2_name].filter(Boolean) as string[];
  for (const h of hints) {
    const hl = h.toLowerCase();
    if (hl.includes(pt) || pt.includes(hl)) return true;
    if (st.includes(hl) || hl.includes(st)) return true;
  }
  return false;
}

function findPlayerCatalogRow(
  displayName: string,
  scorecardTeam: string,
  catalog: PlayerCatalogRow[],
  match: {
    team1_short?: string | null;
    team1_name?: string | null;
    team2_short?: string | null;
    team2_name?: string | null;
  }
): PlayerCatalogRow | null {
  if (!catalog?.length) return null;
  const norm = normalizeScorecardPlayerName(displayName);
  const candidates = catalog.filter((p) => catalogNameMatches(norm, p.player_name));
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const teamScoped = candidates.filter((p) => catalogTeamMatches(scorecardTeam, p.team, match));
  return teamScoped[0] ?? candidates[0];
}

/** Cached breakdown rows may predate bonus `d11` / `pjDetail`; recompute from stats. */
function getD11ForRow(p: {
  d11?: D11BonusMultiplierInfo & { multipliedTotal: number };
  r?: number;
  w?: number;
  total?: number;
}): D11BonusMultiplierInfo & { multipliedTotal: number } {
  if (p.d11) return p.d11;
  const meta = d11BonusMultiplierInfo(p.r ?? 0, p.w ?? 0);
  return {
    ...meta,
    multipliedTotal: d11PointsAfterMultiplier(p.total ?? 0, meta.appliedMultiplier),
  };
}

function getPjDetailForRow(p: any): PjRulesDetailedBreakdown {
  if (p.pjDetail) return p.pjDetail;
  const pjInput = {
    batting: { runs: p.r, balls: p.b, fours: p.f, sixes: p.s, dismissal: p.dismissal || "not out" },
    bowling: {
      overs: p.o,
      maidens: p.m,
      runs_conceded: p.r_conc,
      wickets: p.w,
      lbw_bowled_wickets: p.lbwB,
      dot_balls: p.dots,
    },
    fielding: { catches: p.c, stumpings: p.st, runout_direct: p.ro, runout_indirect: 0 },
    in_announced_lineup: true,
    playerRole: p.role,
  };
  return pjRulesDetailedBreakdown(pjInput);
}

// ─── Fixture helpers ────────────────────────────────────────────────
interface Fixture {
  id: string;
  api_match_id: string;
  match_no?: number;
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
  points_synced?: boolean;
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

function formatLocalTime(dateTimeGMT: string): { time: string; tz: string } {
  if (!dateTimeGMT) return { time: "", tz: "Local" };
  const d = new Date(dateTimeGMT);
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true });
  const tzPart = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value;
  return { time, tz: tzPart || "Local" };
}

function cleanShort(short: string | null): string {
  if (!short) return "";
  return short.endsWith("W") && short.length > 2 ? short.slice(0, -1) : short;
}

/** Join key to `public.fixtures` (ESPN) — only the stored `match_no` column, never parsed from titles. */
function espnMatchNo(f: { match_no?: number | null }): number | null {
  const n = Number(f?.match_no);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getIplTeamStyle(team: string | null | undefined) {
  if (!team) {
    return { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700" };
  }
  return iplColors[team] || { bg: "bg-slate-50", border: "border-slate-100", text: "text-slate-600" };
}

/** IPL franchise (`team`) A–Z, then player name. */
function sortSquadByTeamThenName(players: any[]) {
  return [...players].sort((a, b) => {
    const ta = (a.team ?? "").toString();
    const tb = (b.team ?? "").toString();
    if (ta !== tb) return ta.localeCompare(tb);
    return (a.player_name ?? "").toString().localeCompare((b.player_name ?? "").toString());
  });
}

// ─── Constants ───
const TEAM_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#ef4444", "#06b6d4", "#f97316"];

// ─── Main page ──────────────────────────────────────────────────────
export default function ScoreboardPage() {
  const { user, profile: authProfile, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  /** `players.type` / `players.role` for PJ duck/SR (sold players). */
  const [playersCatalog, setPlayersCatalog] = useState<PlayerCatalogRow[]>([]);
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
  const [analyticsTeamId, setAnalyticsTeamId] = useState<string | null>(null);
  const [standings, setStandings] = useState<any[]>([]);
  const [allMatchPoints, setAllMatchPoints] = useState<any[]>([]);
  const [expandedScorecardId, setExpandedScorecardId] = useState<string | null>(null);
  const [expandedPointsId, setExpandedPointsId] = useState<string | null>(null);
  const [showBreakdownId, setShowBreakdownId] = useState<string | null>(null);

  const [espnScorecardByMatchNo, setEspnScorecardByMatchNo] = useState<Record<number, any | null>>({});
  const [espnScorecardLoadingByMatchNo, setEspnScorecardLoadingByMatchNo] = useState<Record<number, boolean>>({});
  /** `public.fixtures.points_synced` keyed by `match_no` — sole source for “synced”; not `fixtures_cricapi` or `match_ended`. */
  const [fixturePointsSyncedByMatchNo, setFixturePointsSyncedByMatchNo] = useState<Record<number, boolean>>({});

  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [fixtureFilter, setFixtureFilter] = useState<"all" | "upcoming" | "completed">("all");

  type BreakdownRow = {
    n: string;
    team: string;
    role: string;
    r: number;
    b: number;
    f: number;
    s: number;
    w: number;
    m: number;
    o: number;
    r_conc: number;
    c: number;
    st: number;
    dots: number;
    lbwB: number;
    ro: number;
    dismissal?: string;
    base: number;
    b_pts: number;
    bw_pts: number;
    f_pts: number;
    sr_pts: number | null;
    eco_pts: number | null;
    total: number;
    breakdownHint?: string;
    _variant: "pjRules";
    pjDetail?: PjRulesDetailedBreakdown;
    /** Bonus multiplier metadata on total base points (base `total` unchanged). */
    d11?: D11BonusMultiplierInfo & { multipliedTotal: number };
  };

  const [breakdownCache, setBreakdownCache] = useState<Record<string, BreakdownRow[]>>({});
  const [breakdownLoadingKey, setBreakdownLoadingKey] = useState<string | null>(null);

  const computeBreakdownRows = useCallback((sc: any, match: any, catalog: PlayerCatalogRow[]): BreakdownRow[] => {
      if (!sc?.innings) return [];

      const stats: Record<string, any> = {};

      // Initialize registry from batting/bowling names
      sc.innings.forEach((inn: any) => {
        const battingTeam = inn.team;
        const bowlingTeam = sc.innings.find((i: any) => i.team !== battingTeam)?.team || "Opponent";
        (inn.batting || []).forEach((b: any) => {
          const raw = b.player || "";
          if (!raw || raw === "BATTING") return;
          const n = normalizeScorecardPlayerName(raw);
          const key = `${n}_${battingTeam}`;
          if (!stats[key])
            stats[key] = { n, team: battingTeam, r: 0, b: 0, f: 0, s: 0, w: 0, m: 0, o: 0, r_conc: 0, c: 0, st: 0, dots: 0, lbwB: 0, ro: 0, isDuck: false, role: "Batter" };
        });
        (inn.bowling || []).forEach((bw: any) => {
          const raw = bw.bowler || "";
          if (!raw || raw === "BOWLING") return;
          const n = normalizeScorecardPlayerName(raw);
          // bowling is done by opposition
          const key = `${n}_${bowlingTeam}`;
          if (!stats[key])
            stats[key] = { n, team: bowlingTeam, r: 0, b: 0, f: 0, s: 0, w: 0, m: 0, o: 0, r_conc: 0, c: 0, st: 0, dots: 0, lbwB: 0, ro: 0, isDuck: false, role: "Bowler" };
        });
      });

      /** Map a name (possibly partial) to a stats key for exactly one franchise — never cross teams. */
      const findKeyForTeamRoster = (name: string, team: string) => {
        const n = normalizeScorecardPlayerName(name);
        const suffix = `_${team}`;
        const exact = `${n}_${team}`;
        if (stats[exact]) return exact;
        const keys = Object.keys(stats).filter((k) => k.endsWith(suffix));
        const nLower = n.toLowerCase();
        for (const k of keys) {
          const playerPart = k.slice(0, -suffix.length);
          if (playerPart.toLowerCase() === nLower) return k;
        }
        for (const k of keys) {
          const pl = k.slice(0, -suffix.length).toLowerCase();
          if (pl.includes(nLower) || nLower.includes(pl)) return k;
        }
        const lastTok = nLower.split(/\s+/).pop() || nLower;
        for (const k of keys) {
          const parts = k.slice(0, -suffix.length).toLowerCase().split(/\s+/).filter(Boolean);
          if (parts.some((part) => part === lastTok || part.startsWith(lastTok) || lastTok.startsWith(part))) return k;
        }
        return exact;
      };

      const ensureStatRow = (key: string, team: string, role: string, displayName?: string) => {
        if (stats[key]) return;
        const suffix = `_${team}`;
        const playerName =
          displayName ||
          (key.endsWith(suffix) ? key.slice(0, -suffix.length) : normalizeScorecardPlayerName(String(key).split("_")[0] || ""));
        stats[key] = {
          n: playerName,
          team,
          r: 0,
          b: 0,
          f: 0,
          s: 0,
          w: 0,
          m: 0,
          o: 0,
          r_conc: 0,
          c: 0,
          st: 0,
          dots: 0,
          lbwB: 0,
          ro: 0,
          isDuck: false,
          role,
          dismissal: "",
        };
      };

      // Accumulate
      sc.innings.forEach((inn: any) => {
        const currentTeam = inn.team;
        const opposingTeam = sc.innings.find((i: any) => i.team !== currentTeam)?.team || "Opponent";

        (inn.batting || []).forEach((b: any) => {
          const rawN = b.player || "";
          if (!rawN || rawN === "BATTING") return;
          const key = findKeyForTeamRoster(rawN, currentTeam);
          const dStr = (b.dismissal || b["dismissal-text"] || "").toLowerCase();
          const sufCT = `_${currentTeam}`;

          if (!stats[key])
            stats[key] = {
              n: key.endsWith(sufCT) ? key.slice(0, -sufCT.length) : normalizeScorecardPlayerName(rawN),
              team: currentTeam,
              r: 0,
              b: 0,
              f: 0,
              s: 0,
              w: 0,
              m: 0,
              o: 0,
              r_conc: 0,
              c: 0,
              st: 0,
              dots: 0,
              lbwB: 0,
              ro: 0,
              isDuck: false,
              role: "Batter",
              dismissal: "",
            };
          stats[key].r += Number(b.R || b.r) || 0;
          stats[key].b += Number(b.B || b.b) || 0;
          stats[key].f += Number(b["4s"]) || 0;
          stats[key].s += Number(b["6s"]) || 0;
          if (dStr) stats[key].dismissal = dStr;
          if (rawN.includes("†")) stats[key].role = "WK";
          else if (stats[key].role === "Fielder") stats[key].role = "Batter";

          if (stats[key].r === 0 && dStr !== "not out" && dStr !== "") stats[key].isDuck = true;

          // +8 LBW/bowled bonus credits the **bowler** (opposing team), not the dismissed batter.
          const lbwBowledBy = parseLbwBowledBowlerName(b.dismissal || b["dismissal-text"] || "");
          if (lbwBowledBy) {
            const bKey = findKeyForTeamRoster(lbwBowledBy, opposingTeam);
            ensureStatRow(bKey, opposingTeam, "Bowler", lbwBowledBy);
            stats[bKey].lbwB += 1;
          }
        });

        (inn.bowling || []).forEach((bw: any) => {
          const rawN = bw.bowler;
          if (!rawN || rawN === "BOWLING") return;
          const key = findKeyForTeamRoster(rawN, opposingTeam);
          const sufOpp = `_${opposingTeam}`;

          if (!stats[key])
            stats[key] = {
              n: key.endsWith(sufOpp) ? key.slice(0, -sufOpp.length) : normalizeScorecardPlayerName(rawN),
              team: opposingTeam,
              r: 0,
              b: 0,
              f: 0,
              s: 0,
              r_conc: 0,
              w: 0,
              m: 0,
              o: 0,
              c: 0,
              st: 0,
              dots: 0,
              lbwB: 0,
              ro: 0,
              isDuck: false,
              role: "Bowler",
            };
          stats[key].w += Number(bw.W || bw.w) || 0;
          stats[key].m += Number(bw.M || bw.m) || 0;
          stats[key].r_conc += Number(bw.R || bw.r) || 0;
          stats[key].o += Number(bw.O || bw.o) || 0;
          stats[key].dots += Number(bw["0s"] || 0);

          if (stats[key].role === "Batter" || stats[key].role === "WK") stats[key].role = stats[key].role === "WK" ? "WK/Bowler" : "All-Rounder";
          else if (stats[key].role === "Fielder") stats[key].role = "Bowler";
        });

        (inn.catching || []).forEach((c: any) => {
          const rawN = typeof c.catcher === "string" ? c.catcher : c.catcher?.name;
          if (!rawN) return;
          const key = findKeyForTeamRoster(rawN, opposingTeam);
          ensureStatRow(key, opposingTeam, "Fielder", rawN);
          stats[key].c += Number(c.catch || 0);
          stats[key].st += Number(c.stumped || 0);
        });

        (inn.batting || []).forEach((b: any) => {
          const d = (b.dismissal || b["dismissal-text"] || "").toLowerCase();
          if (!d) return;

          // Bowling side (Team B when Team A bats): c & b, c, st, run out — map partial names only to opposingTeam.
          if (/\bc\s*&\s*b\s+/i.test(d)) {
            const m = d.match(/\bc\s*&\s*b\s+([a-zA-Z .''-]+)/i);
            if (m?.[1]) {
              const nRaw = m[1].trim();
              const key = findKeyForTeamRoster(nRaw, opposingTeam);
              ensureStatRow(key, opposingTeam, "Fielder", nRaw);
              stats[key].c += 1;
              // c&b: catch points only (no separate bowled/LBW +8).
            }
            return;
          }

          if (d.startsWith("c ") || d.startsWith("st ")) {
            const parts = d.split(" b ");
            let nRaw = parts[0].replace(/^(?:c|st)\s+(?:†)?/, "").trim();
            if (nRaw && !["sub", "batting", "retired"].includes(nRaw)) {
              const key = findKeyForTeamRoster(nRaw, opposingTeam);
              ensureStatRow(key, opposingTeam, "Fielder", nRaw);
              if (d.startsWith("c ")) stats[key].c += 1;
              if (d.startsWith("st ")) stats[key].st += 1;
            }
          }

          if (d.includes("run out")) {
            const roMatch = d.match(/\(([^)]+)\)/);
            if (roMatch?.[1]) {
              const n = roMatch[1].split(/[/,]/)[0].trim();
              if (n && !/^sub$/i.test(n)) {
                const key = findKeyForTeamRoster(n, opposingTeam);
                ensureStatRow(key, opposingTeam, "Fielder", n);
                stats[key].ro += 1;
              }
            }
          }
        });
      });

      const base = 4;

      const rows: BreakdownRow[] = Object.values(stats).map((p: any) => {
        const cat = findPlayerCatalogRow(p.n, p.team, catalog, match);
        const resolvedRole = pjResolveScoringPlayerRole(cat?.type, cat?.role, p.role);
        const pjInput = {
          batting: { runs: p.r, balls: p.b, fours: p.f, sixes: p.s, dismissal: p.dismissal || "not out" },
          bowling: {
            overs: p.o,
            maidens: p.m,
            runs_conceded: p.r_conc,
            wickets: p.w,
            lbw_bowled_wickets: p.lbwB,
            dot_balls: p.dots,
          },
          fielding: { catches: p.c, stumpings: p.st, runout_direct: p.ro, runout_indirect: 0 },
          in_announced_lineup: true,
          playerRole: resolvedRole,
        };
        const scored = scorePjRulesPlayer(pjInput);
        const pjDetail = pjRulesDetailedBreakdown(pjInput);
        const totalPts = base + scored.total_pts - 4;
        const d11Meta = d11BonusMultiplierInfo(p.r, p.w);
        return {
          ...p,
          role: resolvedRole,
          _variant: "pjRules" as const,
          base,
          b_pts: scored.batting_pts,
          bw_pts: scored.bowling_pts,
          f_pts: scored.fielding_pts,
          sr_pts: scored.sr_pts ?? null,
          eco_pts: scored.eco_pts ?? null,
          total: totalPts,
          breakdownHint: "PJ Rules (T20)",
          pjDetail,
          d11: {
            ...d11Meta,
            multipliedTotal: d11PointsAfterMultiplier(totalPts, d11Meta.appliedMultiplier),
          },
        };
      });

      return rows.sort((a: any, b: any) => (b.total || 0) - (a.total || 0));
    },
    [playersCatalog]
  );

  useEffect(() => {
    setBreakdownCache({});
  }, [playersCatalog]);

  useEffect(() => {
    if (!expandedPointsId) return;
    const match = fixtures.find((m) => m.api_match_id === expandedPointsId);
    if (!match) return;

    const mn = espnMatchNo(match);
    const espn = mn != null ? espnScorecardByMatchNo[mn] : null;
    const espnLoading = mn != null ? !!espnScorecardLoadingByMatchNo[mn] : false;
    const pointsSynced = mn != null ? !!fixturePointsSyncedByMatchNo[mn] : false;

    const key = expandedPointsId;

    if (mn == null || !pointsSynced) {
      setBreakdownLoadingKey(null);
      return;
    }
    if (espnLoading) {
      setBreakdownLoadingKey(null);
      return;
    }

    if (breakdownCache[key]) {
      setBreakdownLoadingKey(null);
      return;
    }

    if (!espn?.innings?.length) {
      setBreakdownCache((prev) => ({ ...prev, [key]: [] }));
      setBreakdownLoadingKey(null);
      return;
    }

    setBreakdownLoadingKey(key);
    const t = setTimeout(() => {
      try {
        const rows = computeBreakdownRows(espn, match, playersCatalog);
        setBreakdownCache((prev) => ({ ...prev, [key]: rows }));
      } finally {
        setBreakdownLoadingKey((cur) => (cur === key ? null : cur));
      }
    }, 0);

    return () => clearTimeout(t);
  }, [
    expandedPointsId,
    fixtures,
    breakdownCache,
    espnScorecardByMatchNo,
    espnScorecardLoadingByMatchNo,
    fixturePointsSyncedByMatchNo,
    computeBreakdownRows,
    playersCatalog,
  ]);

  const fetchEspnScorecardForMatchNo = useCallback(async (matchNo: number) => {
    if (!matchNo || matchNo <= 0) return;
    if (espnScorecardLoadingByMatchNo[matchNo]) return;
    if (espnScorecardByMatchNo[matchNo] !== undefined) return; // cached (including null)

    setEspnScorecardLoadingByMatchNo((prev) => ({ ...prev, [matchNo]: true }));
    try {
      const { data, error } = await supabase
        .from("fixtures")
        .select("scorecard,points_synced")
        .eq("match_no", matchNo)
        .maybeSingle();
      if (error) {
        console.error("[espn] scorecard fetch error", { matchNo, error });
        setEspnScorecardByMatchNo((prev) => ({ ...prev, [matchNo]: null }));
        return;
      }
      setEspnScorecardByMatchNo((prev) => ({ ...prev, [matchNo]: data?.scorecard ?? null }));
    } catch (e) {
      console.error("[espn] scorecard fetch exception", { matchNo, e });
      setEspnScorecardByMatchNo((prev) => ({ ...prev, [matchNo]: null }));
    } finally {
      setEspnScorecardLoadingByMatchNo((prev) => ({ ...prev, [matchNo]: false }));
    }
  }, [espnScorecardByMatchNo, espnScorecardLoadingByMatchNo]);
  const [subLoading, setSubLoading] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  /** Which auction franchise’s score sheet is shown (sub-tabs under Sheets). */
  const [sheetFranchiseId, setSheetFranchiseId] = useState<string | null>(null);
  const today = useMemo(() => getTodayIST(), []);

  const matchByNo = useMemo(() => {
    const map = new Map<number, any>();
    (allMatches || []).forEach((m) => {
      const n = Number(m?.match_no);
      if (Number.isFinite(n)) map.set(n, m);
    });
    return map;
  }, [allMatches]);

  const effectivePointsByPlayerMatch = useMemo(() => {
    const map = new Map<string, number>();
    (allMatchPoints || []).forEach((pt: any) => {
      if (!pt?.player_id || !pt?.match_id) return;
      map.set(`${pt.player_id}_${pt.match_id}`, Number(pt.points) || 0);
    });
    Object.values(pendingEdits || {}).forEach((ed: any) => {
      if (!ed?.player_id || !ed?.match_id) return;
      map.set(`${ed.player_id}_${ed.match_id}`, Number(ed.points) || 0);
    });
    return map;
  }, [allMatchPoints, pendingEdits]);

  const getEffectivePointsForPlayerMatchNo = (playerId: string, matchNo: number) => {
    const m = matchByNo.get(matchNo);
    if (!m?.id) return 0;
    const key = `${playerId}_${m.id}`;
    return effectivePointsByPlayerMatch.get(key) ?? 0;
  };

  useEffect(() => { if (authProfile) setProfile(authProfile); }, [authProfile]);

  useEffect(() => {
    if (!franchises.length) return;
    setSheetFranchiseId((prev) => {
      if (prev && franchises.some((f) => f.id === prev)) return prev;
      const mine = authProfile?.id ? franchises.find((f) => f.id === authProfile.id) : null;
      return mine?.id ?? franchises[0].id;
    });
  }, [franchises, authProfile?.id]);

  useEffect(() => {
    setPendingEdits({});
  }, [sheetFranchiseId]);
  useEffect(() => { fetchInitialData(); }, []);
  useEffect(() => { if (selectedMatchId) fetchMatchSpecificData(selectedMatchId); }, [selectedMatchId]);
  useEffect(() => { if (activeTab === "standings") fetchStandingsData(); }, [activeTab]);
  useEffect(() => {
    if (activeTab === "sheets") fetchSheetsData();
  }, [activeTab]);
  useEffect(() => { if (activeTab === "fixtures") fetchFixtures(); }, [activeTab]);

  const fetchFixtures = async () => {
    setTabLoading(true);
    try {
      const [cricRes, espnRes] = await Promise.all([
        supabase.from("fixtures_cricapi").select("*").order("date_time_gmt", { ascending: true }),
        supabase.from("fixtures").select("match_no,points_synced"),
      ]);
      if (cricRes.data) setFixtures(cricRes.data);
      if (espnRes.data) {
        const m: Record<number, boolean> = {};
        for (const row of espnRes.data as { match_no?: number | null; points_synced?: boolean | null }[]) {
          const n = Number(row.match_no);
          if (Number.isFinite(n)) m[n] = !!row.points_synced;
        }
        setFixturePointsSyncedByMatchNo(m);
      }
    } finally {
      setTabLoading(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [teamsRes, matchesRes, playersCatRes] = await Promise.all([
        supabase.from("profiles").select("*").neq("role", "Viewer").order("team_name", { ascending: true }),
        supabase.from("matches").select("*").order("match_no", { ascending: true }),
        supabase
          .from("players")
          .select("player_name, team, type, role")
          .eq("auction_status", "sold")
          .order("player_name", { ascending: true }),
      ]);
      const teamsData = teamsRes.data || [];
      setFranchises(teamsData);
      if (matchesRes.data) {
        setAllMatches(matchesRes.data);
        const nextMatch = matchesRes.data.find(m => m.status === 'live' || m.status === 'scheduled') || matchesRes.data[0];
        if (nextMatch) setSelectedMatchId(nextMatch.id);
      }
      if (playersCatRes.data) {
        setPlayersCatalog(playersCatRes.data as PlayerCatalogRow[]);
      }
    } finally { setTimeout(() => setLoading(false), 300); }
  };

  /** All auction franchises’ squads + persisted match points (sheets tab). */
  const fetchSheetsData = async () => {
    setSubLoading(true);
    try {
      const [playersRes, pointsRes] = await Promise.all([
        supabase.from("players").select("*").eq("auction_status", "sold").order("player_name", { ascending: true }),
        supabase.from("match_points").select("*"),
      ]);
      const pl = playersRes.data || [];
      setAllPlayers(pl);
      setPlayersCatalog(
        pl.map((p: any) => ({
          player_name: p.player_name,
          team: p.team,
          type: p.type ?? null,
          role: p.role ?? null,
        }))
      );
      setAllMatchPoints(pointsRes.data || []);
    } finally {
      setSubLoading(false);
    }
  };

  const fetchStandingsData = async () => {
    setTabLoading(true);
    try {
      // NOTE: players table doesn't have `team_name`; ownership is stored as `sold_to`/`sold_to_id`.
      const { data: soldPlayers } = await supabase
        .from("players")
        .select("id, sold_to_id, sold_to, player_name, role")
        .eq("auction_status", "sold");
      const { data: pts } = await supabase.from("match_points").select("*");
      setAllPlayers(soldPlayers || []);
      setAllMatchPoints(pts || []);
      // Do NOT call calculateStandings here: setState is async; effectivePoints / derived maps
      // would still be stale. Recompute in useEffect after state commits.
    } finally {
      setTabLoading(false);
    }
  };

  /** Build the same key map as effectivePointsByPlayerMatch but from explicit rows (avoids stale closure). */
  const buildPointsMap = useCallback((points: any[]) => {
    const map = new Map<string, number>();
    (points || []).forEach((pt: any) => {
      if (!pt?.player_id || !pt?.match_id) return;
      map.set(`${pt.player_id}_${pt.match_id}`, Number(pt.points) || 0);
    });
    Object.values(pendingEdits || {}).forEach((ed: any) => {
      if (!ed?.player_id || !ed?.match_id) return;
      map.set(`${ed.player_id}_${ed.match_id}`, Number(ed.points) || 0);
    });
    return map;
  }, [pendingEdits]);

  const playerBelongsToTeam = useCallback((p: any, team: any) => {
    if (p.sold_to_id && team.id && p.sold_to_id === team.id) return true;
    const a = String(p.sold_to || "").trim().toLowerCase();
    const b = String(team.team_name || "").trim().toLowerCase();
    if (a && b && a === b) return true;
    const c = String(team.full_name || "").trim().toLowerCase();
    if (a && c && a === c) return true;
    return false;
  }, []);

  const calculateStandings = useCallback(
    (players: any[], points: any[]) => {
      if (!franchises.length) return;
      const pointsMap = buildPointsMap(points || []);
      const standingsData = franchises.map((team) => {
        let totalPoints = 0;
        let matchesPlayed = 0;
        let bestMatch = 0;
        let worstMatch = Infinity;
        const matchScores: number[] = [];
        const teamPlayers = (players || []).filter((p) => playerBelongsToTeam(p, team));

        (allMatches || []).forEach((m) => {
          let matchTotal = 0;
          let matchHasPoints = false;
          teamPlayers.forEach((player) => {
            const key = `${player.id}_${m.id}`;
            if (pointsMap.has(key)) {
              matchHasPoints = true;
              matchTotal += pointsMap.get(key) || 0;
            }
          });
          if (matchHasPoints) {
            matchesPlayed++;
            totalPoints += matchTotal;
            matchScores.push(matchTotal);
            if (matchTotal > bestMatch) bestMatch = matchTotal;
            if (matchTotal < worstMatch) worstMatch = matchTotal;
          }
        });
        return {
          ...team,
          totalPoints,
          matchesPlayed: Math.min(matchesPlayed, 17),
          bestMatch: matchesPlayed > 0 ? bestMatch : 0,
          worstMatch: worstMatch === Infinity ? 0 : worstMatch,
          avgPerMatch: matchesPlayed > 0 ? Math.round((totalPoints / matchesPlayed) * 10) / 10 : 0,
          squadSize: teamPlayers.length,
        };
      }).sort((a, b) => b.totalPoints - a.totalPoints);
      setStandings(standingsData);
    },
    [franchises, allMatches, buildPointsMap, playerBelongsToTeam]
  );

  useEffect(() => {
    if (activeTab !== "standings") return;
    if (!franchises.length || !allMatches.length) return;
    calculateStandings(allPlayers, allMatchPoints);
  }, [activeTab, allMatchPoints, allPlayers, allMatches, franchises, calculateStandings]);

  const fetchMatchSpecificData = async (matchId: string) => {
    const { data } = await supabase.from("nominations").select("*").eq("match_id", matchId);
    setAllNominations(data || []);
  };

  const updateSeasonPoint = async (pId: string, mNo: number, val: string) => {
    if (!profile?.id || sheetFranchiseId !== profile.id) return;
    const fr = franchises.find((f) => f.id === sheetFranchiseId);
    const player = allPlayers.find((p) => p.id === pId);
    if (!fr || !player || (player.sold_to_id !== fr.id && player.sold_to !== fr.team_name)) return;
    const pts = parseFloat(val) || 0;
    const match = allMatches.find((m) => m.match_no === mNo);
    if (!match) return;
    setPendingEdits((prev) => ({ ...prev, [`${pId}_${match.id}`]: { player_id: pId, match_id: match.id, points: pts } }));
  };

  const handleBulkSave = async () => {
    if (!profile?.id || sheetFranchiseId !== profile.id) return;
    setSaving(true);
    const { error } = await supabase.from("match_points").upsert(Object.values(pendingEdits), { onConflict: "player_id,match_id" });
    if (!error) setPendingEdits({});
    // Keep Sheets + Standings consistent immediately after saving.
    // Without this, the grid keeps showing stale values until a refresh/refetch.
    if (!error) {
      const { data: pts } = await supabase.from("match_points").select("*");
      setAllMatchPoints(pts || []);
    }
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

        {/* Tabs */}
        <div className="flex bg-white/50 backdrop-blur-md p-1.5 rounded-[1.5rem] border border-slate-200 overflow-x-auto no-scrollbar">
           {(["sheets", "standings", "fixtures"] as const).map(tab => {
             const label = tab === "fixtures" ? "fixtures/results" : tab;
             return (
               <button
                 key={tab}
                 onClick={() => setActiveTab(tab as any)}
                 className={cn("px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-1", activeTab === tab ? "bg-slate-900 text-white shadow-lg" : "text-slate-400")}
               >
                 {label}
               </button>
             );
           })}
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
                       teamPlayers.forEach(tp => {
                         const key = `${tp.id}_${matchObj.id}`;
                         sum += effectivePointsByPlayerMatch.get(key) || 0;
                       });
                       data[team.team_name] = (gIdx > 0 ? (cumulativeData[gIdx - 1] as any)[team.team_name] : 0) + sum;
                    }
                  });
                  return data;
                });

                const currentAnalyticsTeam = analyticsTeamId ? franchises.find(f => f.id === analyticsTeamId) : standings[0];
                const playerPointsList = allPlayers.filter(p => p.sold_to_id === currentAnalyticsTeam?.id || p.sold_to === currentAnalyticsTeam?.team_name).map(p => ({
                   name: p.player_name,
                   points: allMatches.reduce((acc, m) => acc + (effectivePointsByPlayerMatch.get(`${p.id}_${m.id}`) || 0), 0),
                   role: p.role
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
            {tabLoading ? (
              <div className="space-y-5">
                <div className="h-4 w-40 rounded-lg bg-slate-200 animate-pulse" />
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 w-28 rounded-md bg-slate-200 animate-pulse ml-2" />
                    <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
                      <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="h-10 w-10 rounded-xl bg-slate-200 animate-pulse" />
                          <div className="h-4 w-24 rounded-lg bg-slate-200 animate-pulse" />
                        </div>
                        <div className="h-6 w-12 rounded-lg bg-slate-200 animate-pulse" />
                        <div className="flex items-center gap-4 flex-1 justify-end">
                          <div className="h-4 w-24 rounded-lg bg-slate-200 animate-pulse" />
                          <div className="h-10 w-10 rounded-xl bg-slate-200 animate-pulse" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
                        <div className="h-3 w-2/3 rounded-md bg-slate-200 animate-pulse" />
                        <div className="flex gap-2">
                          <div className="h-8 w-24 rounded-lg bg-slate-200 animate-pulse" />
                          <div className="h-8 w-24 rounded-lg bg-slate-200 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {!tabLoading && groupedFixtures.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
                <Calendar className="h-10 w-10 text-slate-200 mb-3" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No fixtures found</p>
              </div>
            ) : null}
             {groupedFixtures.map(([date, matches]) => (
                <div key={date} className="space-y-3">
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{formatDate(date)}</div>
                   {matches.map(match => {
                      const isToday = match.match_date === today;
                      const mnRow = espnMatchNo(match);
                      const pointsSynced = mnRow != null ? !!fixturePointsSyncedByMatchNo[mnRow] : false;
                      const breakdownReady = pointsSynced;
                      return (
                      <div key={match.id} className="space-y-2">
                        {isToday && (
                          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 px-2">
                            Today
                          </div>
                        )}
                      <div className={cn("bg-white rounded-[2rem] border p-6 shadow-sm transition-all", isToday ? "border-indigo-500 ring-2 ring-indigo-50/50" : "border-slate-100")}>
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
                            <div className="text-[10px] font-bold text-slate-400 uppercase">
                              {(() => {
                                const ist = `${formatTime(match.date_time_gmt)} IST`;
                                const local = formatLocalTime(match.date_time_gmt);
                                const localPart = local.tz !== "IST" ? ` • ${local.time} ${local.tz}` : "";
                                const venue = match.venue?.split(",")[0] ? ` • ${match.venue.split(",")[0]}` : "";
                                return `${ist}${localPart}${venue}`;
                              })()}
                            </div>
                            {breakdownReady ? (
                              <div className="flex gap-2">
                                 <Button
                                   variant="outline"
                                   size="sm"
                                   onClick={() => {
                                     const mn = espnMatchNo(match);
                                     if (mn != null) fetchEspnScorecardForMatchNo(mn);
                                     setExpandedScorecardId(match.api_match_id);
                                   }}
                                   className="h-8 text-[9px] font-black uppercase shadow-none border-slate-200"
                                 >
                                   Scorecard
                                 </Button>
                                 <Button
                                   variant="outline"
                                   size="sm"
                                   onClick={() => {
                                     const mn = espnMatchNo(match);
                                     if (mn != null) fetchEspnScorecardForMatchNo(mn);
                                     setExpandedPointsId(match.api_match_id);
                                   }}
                                   className="h-8 text-[9px] font-black uppercase border-amber-200 text-amber-600 bg-amber-50/50 shadow-none"
                                 >
                                   Breakdown
                                 </Button>
                              </div>
                            ) : match.match_ended && !pointsSynced ? (
                              <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase">Points will be updated soon.</span>
                            ) : (
                              <span className="text-[9px] font-black text-amber-500 bg-amber-50 px-2 py-1 rounded uppercase">Live Soon</span>
                            )}
                         </div>

                         {/* Scorecard Modal */}
                         <Dialog open={expandedScorecardId === match.api_match_id} onOpenChange={(o) => setExpandedScorecardId(o ? match.api_match_id : null)}>
                            <DialogContent className="max-w-[95vw] sm:max-w-4xl bg-[#F8FAFC] border-0 p-0 rounded-[2rem] overflow-hidden">
                               <div className="bg-slate-900 p-8 text-white flex flex-col gap-1">
                                 <DialogTitle className="text-2xl font-black uppercase italic">Match Statistics</DialogTitle>
                                 <p className="text-[10px] font-black uppercase tracking-widest text-white/60">ESPNcricinfo</p>
                               </div>
                               <div className="p-4 sm:p-8 max-h-[75vh] min-h-[60vh] overflow-y-auto no-scrollbar">
                                 {expandedScorecardId === match.api_match_id ? (() => {
                                   const mn = espnMatchNo(match);
                                   const espn = mn != null ? espnScorecardByMatchNo[mn] : null;
                                   const espnLoading = mn != null ? !!espnScorecardLoadingByMatchNo[mn] : false;
                                   const pointsSyncedModal = mn != null ? !!fixturePointsSyncedByMatchNo[mn] : false;

                                   if (mn == null) {
                                     return (
                                       <div className="px-2 py-10 text-center text-[11px] font-black uppercase tracking-widest text-slate-400">
                                         Score not available for this category.
                                       </div>
                                     );
                                   }
                                   if (espnLoading) {
                                     return (
                                       <div className="px-2 py-10 text-center text-[11px] font-black uppercase tracking-widest text-slate-400">
                                         Loading ESPN scorecard…
                                       </div>
                                     );
                                   }
                                   if (!pointsSyncedModal) {
                                     return (
                                       <div className="px-2 py-10 text-center text-[11px] font-black uppercase tracking-widest text-slate-400">
                                         Score not available for this category.
                                       </div>
                                     );
                                   }
                                   return <ScorecardViewer scorecard={(espn ?? {}) as any} />;
                                 })() : null}
                               </div>
                            </DialogContent>
                         </Dialog>

                         {/* Points Modal - Team-Aware Calculation */}
                         <Dialog open={expandedPointsId === match.api_match_id} onOpenChange={(o) => { setExpandedPointsId(o ? match.api_match_id : null); setShowBreakdownId(null); }}>
                            <DialogContent className="max-w-[95vw] sm:max-w-3xl bg-white border-0 p-0 rounded-[2rem] overflow-hidden">
                               <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 text-white">
                                  <DialogTitle className="text-2xl font-black uppercase tracking-tight leading-none">Scoring Intelligence</DialogTitle>
                                  <p className="text-[9px] font-black uppercase opacity-90 mt-1.5 leading-none">
                                    {match.team1_short} vs {match.team2_short} • ESPN scorecard • PJ Rules
                                  </p>
                               </div>
                               <div className="p-2 sm:p-8 max-h-[75vh] min-h-[60vh] overflow-y-auto no-scrollbar">
                                  <table className="w-full text-left">
                                     <thead className="bg-slate-50 border-b">
                                        <tr><th className="px-4 py-4 text-[9px] font-black uppercase opacity-30">Selection</th><th className="px-3 py-4 text-[9px] font-black opacity-30 text-center uppercase">Contribution</th><th className="px-4 py-4 text-[11px] font-black text-right uppercase">Final Points</th></tr>
                                     </thead>
                                     <tbody className="divide-y divide-slate-100">
                                        {expandedPointsId === match.api_match_id ? (() => {
                                          const mn = espnMatchNo(match);
                                          const key = match.api_match_id;
                                          const rows = breakdownCache[key];
                                          const isLoading = breakdownLoadingKey === key;
                                          const pointsSyncedRow = mn != null ? !!fixturePointsSyncedByMatchNo[mn] : false;
                                          const espnLoadingRow = mn != null ? !!espnScorecardLoadingByMatchNo[mn] : false;

                                          if (mn == null) {
                                            return (
                                              <tr>
                                                <td colSpan={3} className="px-6 py-10 text-center text-[11px] font-black uppercase tracking-widest text-slate-400">
                                                  Score not available for this category.
                                                </td>
                                              </tr>
                                            );
                                          }
                                          if (!pointsSyncedRow) {
                                            return (
                                              <tr>
                                                <td colSpan={3} className="px-6 py-10 text-center text-[11px] font-black uppercase tracking-widest text-slate-400">
                                                  Score not available for this category.
                                                </td>
                                              </tr>
                                            );
                                          }
                                          if (espnLoadingRow) {
                                            return (
                                              <tr>
                                                <td colSpan={3} className="px-6 py-10 text-center text-[11px] font-black uppercase tracking-widest text-slate-400">
                                                  Loading ESPN scorecard…
                                                </td>
                                              </tr>
                                            );
                                          }

                                          if (isLoading) {
                                            return (
                                              <tr>
                                                <td colSpan={3} className="px-6 py-10 text-center">
                                                  <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Computing scores…
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          }

                                          if (!rows) {
                                            return (
                                              <tr>
                                                <td colSpan={3} className="px-6 py-10 text-center">
                                                  <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Computing scores…
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          }

                                          return rows.map((p: any) => {
                                            const d11 = getD11ForRow(p);
                                            return (
                                              <React.Fragment key={`${p.n}_${p.team}`}>
                                                <tr
                                                  onClick={() => setShowBreakdownId(showBreakdownId === `${p.n}_${p.team}` ? null : `${p.n}_${p.team}`)}
                                                  className={cn("hover:bg-slate-50 cursor-pointer transition-all", showBreakdownId === `${p.n}_${p.team}` ? "bg-slate-50" : "")}
                                                >
                                                  <td className="px-4 py-4">
                                                    <div className="flex items-center gap-1.5">
                                                      <span className="text-xs font-black uppercase text-slate-800 leading-none">{p.n}</span>
                                                      <ChevronRight size={10} className={cn("text-indigo-500", showBreakdownId === `${p.n}_${p.team}` ? "rotate-90" : "")} />
                                                    </div>
                                                    <p className="text-[7px] font-black uppercase text-slate-400 mt-1">
                                                      {p.team} • {p.role}
                                                    </p>
                                                  </td>
                                                  <td className="px-3 py-4 text-center">
                                                    <div className="text-[9px] font-black text-slate-900 leading-none">
                                                      {p.r}R • {p.w}W • {p.c}C
                                                    </div>
                                                  </td>
                                                  <td className="px-4 py-4 text-right">
                                                    <div className="text-sm font-black text-slate-900">{Math.round(p.total)}</div>
                                                    {d11.appliedMultiplier > 1 ? (
                                                      <div className="text-[8px] font-bold text-indigo-600 mt-1 leading-tight">
                                                        Bonus multiplier {d11.multipliedTotal.toFixed(1)} pts
                                                        <span className="text-indigo-400"> · {d11.appliedMultiplier}×</span>
                                                      </div>
                                                    ) : null}
                                                  </td>
                                                </tr>
                                                {showBreakdownId === `${p.n}_${p.team}` && (
                                                  <tr className="bg-slate-50/50 border-none">
                                                    <td colSpan={3} className="px-4 pb-6 pt-2 border-none">
                                                      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-inner max-w-xl animate-in slide-in-from-top-2">
                                                        <div className="space-y-4">
                                                          <h4 className="text-[8px] font-black uppercase text-indigo-600 tracking-widest border-b border-slate-100 pb-2">
                                                            PJ Rules Breakdown ({p.team})
                                                          </h4>
                                                          {(() => {
                                                            const d = getPjDetailForRow(p);
                                                            const sumL = (lines: { pts: number }[]) =>
                                                              lines.reduce((a, l) => a + l.pts, 0);
                                                            const fmt = (n: number) =>
                                                              `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;
                                                            const Block = ({
                                                              title,
                                                              lines,
                                                              subtotal,
                                                            }: {
                                                              title: string;
                                                              lines: { label: string; pts: number; detail?: string }[];
                                                              subtotal: number;
                                                            }) => (
                                                              <div className="space-y-1.5">
                                                                <div className="flex justify-between items-baseline gap-2">
                                                                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                                                                    {title}
                                                                  </span>
                                                                  <span className="text-[10px] font-black text-slate-800 tabular-nums">
                                                                    {fmt(subtotal)}
                                                                  </span>
                                                                </div>
                                                                <ul className="space-y-1 border-l-2 border-slate-100 pl-3">
                                                                  {lines.length === 0 ? (
                                                                    <li className="text-[9px] text-slate-400 italic">No points in this category</li>
                                                                  ) : (
                                                                    lines.map((line, i) => (
                                                                      <li key={`${title}-${i}`} className="text-[9px] leading-snug">
                                                                        <div className="flex justify-between gap-3">
                                                                          <span className="text-slate-600 font-medium">{line.label}</span>
                                                                          <span
                                                                            className={cn(
                                                                              "font-mono font-bold tabular-nums shrink-0",
                                                                              line.pts >= 0 ? "text-emerald-700" : "text-rose-600"
                                                                            )}
                                                                          >
                                                                            {fmt(line.pts)}
                                                                          </span>
                                                                        </div>
                                                                        {line.detail ? (
                                                                          <p className="text-[7px] text-slate-400 mt-0.5 font-medium uppercase tracking-tight">
                                                                            {line.detail}
                                                                          </p>
                                                                        ) : null}
                                                                      </li>
                                                                    ))
                                                                  )}
                                                                </ul>
                                                              </div>
                                                            );
                                                            return (
                                                              <>
                                                                <Block
                                                                  title="Entry & playing XI"
                                                                  lines={d.extras}
                                                                  subtotal={sumL(d.extras)}
                                                                />
                                                                <Block
                                                                  title="Batting"
                                                                  lines={d.batting}
                                                                  subtotal={sumL(d.batting)}
                                                                />
                                                                <Block
                                                                  title="Bowling"
                                                                  lines={d.bowling}
                                                                  subtotal={sumL(d.bowling)}
                                                                />
                                                                <Block
                                                                  title="Fielding"
                                                                  lines={d.fielding}
                                                                  subtotal={sumL(d.fielding)}
                                                                />
                                                                <div className="border-t border-slate-200 pt-3 flex justify-between items-center gap-2">
                                                                  <span className="text-[11px] font-black uppercase text-slate-900">
                                                                    Final total (base PJ)
                                                                  </span>
                                                                  <span className="text-sm font-black text-slate-900 tabular-nums">
                                                                    {fmt(Number(p.total || 0))}
                                                                  </span>
                                                                </div>
                                                                <div className="rounded-xl bg-indigo-50/80 border border-indigo-100 p-3 space-y-2">
                                                                  <div className="text-[8px] font-black uppercase tracking-widest text-indigo-700 border-b border-indigo-100 pb-1.5">
                                                                    Bonus multiplier (on total base points)
                                                                  </div>
                                                                  <div className="space-y-1 text-[9px]">
                                                                    <div className="flex justify-between gap-2">
                                                                      <span className="text-slate-600 font-semibold">Runs tier</span>
                                                                      <span className="font-mono font-bold text-slate-800">
                                                                        {d11.runMultiplier}×
                                                                      </span>
                                                                    </div>
                                                                    <p className="text-[7px] text-slate-500 uppercase tracking-tight leading-tight">
                                                                      {d11.runTierLabel}
                                                                    </p>
                                                                    <div className="flex justify-between gap-2 pt-1">
                                                                      <span className="text-slate-600 font-semibold">Wickets tier</span>
                                                                      <span className="font-mono font-bold text-slate-800">
                                                                        {d11.wicketMultiplier}×
                                                                      </span>
                                                                    </div>
                                                                    <p className="text-[7px] text-slate-500 uppercase tracking-tight leading-tight">
                                                                      {d11.wicketTierLabel}
                                                                    </p>
                                                                    <div className="flex justify-between gap-2 pt-2 border-t border-indigo-100 items-baseline">
                                                                      <span className="text-indigo-900 font-black uppercase text-[9px]">
                                                                        Applied (max)
                                                                      </span>
                                                                      <span className="text-sm font-black text-indigo-700 tabular-nums">
                                                                        {d11.appliedMultiplier}×
                                                                      </span>
                                                                    </div>
                                                                    <p className="text-[7px] text-indigo-600/90 font-bold uppercase tracking-tight">
                                                                      {d11.appliedSource === "none" && "No bonus tier — 1×"}
                                                                      {d11.appliedSource === "runs" &&
                                                                        "Higher multiplier from runs"}
                                                                      {d11.appliedSource === "wickets" &&
                                                                        "Higher multiplier from wickets"}
                                                                      {d11.appliedSource === "both" &&
                                                                        "Runs & wickets tie on same multiplier"}
                                                                    </p>
                                                                    <div className="flex justify-between gap-2 pt-1 border-t border-indigo-100">
                                                                      <span className="text-slate-800 font-black uppercase text-[10px]">
                                                                        Points after bonus multiplier
                                                                      </span>
                                                                      <span className="text-sm font-black text-indigo-800 tabular-nums">
                                                                        {fmt(d11.multipliedTotal)}
                                                                      </span>
                                                                    </div>
                                                                    <p className="text-[7px] text-slate-500 leading-relaxed normal-case font-medium">
                                                                      {Number(p.total || 0).toFixed(1)} base × {d11.appliedMultiplier} ={" "}
                                                                      {d11.multipliedTotal.toFixed(1)}
                                                                    </p>
                                                                  </div>
                                                                </div>
                                                              </>
                                                            );
                                                          })()}
                                                        </div>
                                                      </div>
                                                        </td></tr>
                                                     )}
                                                  </React.Fragment>
                                               );
                                            });
                                        })() : null}
                                     </tbody>
                                  </table>
                               </div>
                            </DialogContent>
                         </Dialog>
                      </div>
                      </div>
                   )})}
                </div>
             ))}
          </div>
        )}

        {/* ─── TAB: SCORE SHEETS (4 franchise tabs; edit only your own) ─── */}
        {activeTab === "sheets" && (
           <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex flex-col gap-4">
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
                        let csv = "Auction Franchise,Player,IPL Team,Role,Price\n";
                        franchises.forEach((franchise) => {
                          const squad = allPlayers.filter(p => p.sold_to_id === franchise.id || p.sold_to === franchise.team_name);
                          squad.forEach((p) => {
                            csv += `"${franchise.team_name || franchise.full_name}","${p.player_name}","${p.team ?? ""}","${p.role}","${p.sold_price || p.price}"\n`;
                          });
                        });
                        const link = document.createElement("a");
                        link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + csv));
                        link.setAttribute("download", "All_Franchises_Score_Sheets.csv");
                        link.click();
                      }} 
                      className="h-11 border-slate-200 rounded-xl font-black uppercase tracking-widest flex gap-2 text-slate-600 px-6 shadow-sm text-[10px]"
                    >
                       <Download size={16} /> Export all squads
                    </Button>
                 </div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    Rows are ordered by IPL team name, then player. Row tint follows IPL franchise (CSK, MI, RCB, etc.), matching the auction room and dashboard.
                 </p>
                 <div className="flex flex-wrap gap-2 items-center bg-white/80 p-3 rounded-xl border border-slate-100">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mr-1">IPL legend</span>
                    {Object.entries(iplColors).map(([code, colors]) => (
                      <div key={code} className={cn("px-2 py-1 rounded-lg border", colors.bg, colors.border)}>
                        <span className={cn("text-[9px] font-black uppercase tracking-tight", colors.text)}>{code}</span>
                      </div>
                    ))}
                 </div>
              </div>

              {/* One tab per auction franchise */}
              {!subLoading && franchises.length > 0 && (
                <div className="flex flex-wrap gap-2 bg-white/60 backdrop-blur-md p-1.5 rounded-[1.25rem] border border-slate-200">
                  {franchises.map((f) => {
                    const isActive = sheetFranchiseId === f.id;
                    const isOwn = profile?.id === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSheetFranchiseId(f.id)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                          isActive ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-white/80"
                        )}
                      >
                        <span className="max-w-[140px] truncate">{f.team_name || f.full_name}</span>
                        {isOwn ? (
                          <span
                            className={cn(
                              "text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md",
                              isActive ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-800"
                            )}
                          >
                            You
                          </span>
                        ) : (
                          <Lock className="h-3 w-3 opacity-60 shrink-0" aria-hidden />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {subLoading ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
                  <Loader2 className="h-10 w-10 text-slate-900 animate-spin mb-3" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading score sheets</p>
                </div>
              ) : (
              (() => {
                const franchise = franchises.find((f) => f.id === sheetFranchiseId) ?? franchises[0];
                if (!franchise) return null;
                const canEdit = !!profile?.id && franchise.id === profile.id;
                const fi = franchises.findIndex((f) => f.id === franchise.id);
                const squad = allPlayers.filter((p) => p.sold_to_id === franchise.id || p.sold_to === franchise.team_name);
                const q = searchQuery.trim().toLowerCase();
                const filtered = q ? squad.filter((p) => p.player_name.toLowerCase().includes(q)) : squad;
                const visible = sortSquadByTeamThenName(filtered);
                const showEmptySquad = !q && squad.length === 0;
                const noSearchHits = q && visible.length === 0;

                return (
                  <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-xl">
                    <div className={cn("px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3", "bg-slate-900 text-white")}>
                      <div>
                        <h2 className="text-sm font-black uppercase italic tracking-tight">{franchise.team_name || franchise.full_name}</h2>
                        <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest mt-0.5">
                          {squad.length} players • Franchise {fi + 1} of {franchises.length}
                          {canEdit ? " • You can edit this sheet" : " • View only (owner edits their own sheet)"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {canEdit ? (
                          <span className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Editing</span>
                        ) : (
                          <span className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-white/10 text-white/70 border border-white/10 flex items-center gap-1">
                            <Lock className="h-3 w-3" /> View only
                          </span>
                        )}
                        <div className="h-10 px-4 rounded-xl bg-white/10 flex items-center justify-center font-black text-xs uppercase tracking-widest">
                          Grand&nbsp;Total:&nbsp;
                          {(() => {
                            const teamTotal = squad.reduce((sum, sp) => {
                              let t = 0;
                              for (let i = 1; i <= 17; i++) t += getEffectivePointsForPlayerMatchNo(sp.id, i);
                              return sum + t;
                            }, 0);
                            return String(teamTotal % 1 === 0 ? teamTotal : teamTotal.toFixed(1));
                          })()}
                        </div>
                      </div>
                    </div>
                    {showEmptySquad ? (
                      <div className="px-8 py-14 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                        No sold players in this squad yet.
                      </div>
                    ) : noSearchHits ? (
                      <div className="px-8 py-14 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                        No players match your search.
                      </div>
                    ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[1200px]">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 sticky left-0 bg-slate-50 z-10 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]">Squad Player</th>
                            {[...Array(17)].map((_, i) => (
                              <th key={i} className="px-3 py-5 text-center text-[10px] font-black text-slate-400">G{i + 1}</th>
                            ))}
                            <th className="px-8 py-5 text-right text-[10px] font-black text-slate-900 sticky right-0 bg-slate-50 z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)]">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((p) => {
                            const teamStyle = getIplTeamStyle(p.team);
                            const pts = Array.from({ length: 17 }, (_, idx) => getEffectivePointsForPlayerMatchNo(p.id, idx + 1));
                            const total = pts.reduce((a, b) => a + b, 0);

                            return (
                              <tr key={p.id} className={cn("border-b border-slate-200/80 transition-colors", teamStyle.bg)}>
                                <td
                                  className={cn(
                                    "px-8 py-4 sticky left-0 z-10 border-l-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)]",
                                    teamStyle.bg,
                                    teamStyle.border
                                  )}
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="h-9 w-9 rounded-xl bg-white/60 overflow-hidden shrink-0 border border-white/80 italic flex items-center justify-center">
                                      {p.image_url ? (
                                        <img src={getPlayerImage(p.image_url)!} className="w-full h-full object-cover object-top" alt="" />
                                      ) : (
                                        <User size={16} className="text-slate-300" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className={cn("font-bold text-xs", teamStyle.text)}>{p.player_name}</div>
                                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                        <span className="text-[8px] font-black uppercase text-slate-500">{p.role}</span>
                                        {p.team ? (
                                          <span className={cn("text-[8px] font-black uppercase px-1.5 py-0 rounded border", teamStyle.border, teamStyle.text, "bg-white/50")}>
                                            {p.team}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                {pts.map((score, i) => {
                                  const mObj = allMatches.find((m) => m.match_no === i + 1);
                                  const isDirty = mObj && pendingEdits[`${p.id}_${mObj.id}`] !== undefined;
                                  return (
                                    <td key={i} className={cn("px-3 py-4 text-center", teamStyle.bg)}>
                                      <Input
                                        type="number"
                                        step="0.5"
                                        value={score ? String(score) : ""}
                                        readOnly={!canEdit}
                                        onChange={(e) => {
                                          if (!canEdit) return;
                                          updateSeasonPoint(p.id, i + 1, e.target.value);
                                        }}
                                        className={cn(
                                          "h-8 w-14 mx-auto text-[10px] font-black text-center border-none rounded-lg",
                                          isDirty ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300" : "bg-white/70 text-slate-900",
                                          !canEdit && "cursor-not-allowed opacity-85"
                                        )}
                                        placeholder="0"
                                      />
                                    </td>
                                  );
                                })}
                                <td
                                  className={cn(
                                    "px-8 py-4 text-right font-black italic text-sm sticky right-0 z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)]",
                                    teamStyle.bg
                                  )}
                                >
                                  {String(total % 1 === 0 ? total : total.toFixed(1))}
                                </td>
                              </tr>
                            );
                          })}
                          {(() => {
                            const teamGameTotals = Array(17).fill(0);
                            squad.forEach((sp) => {
                              for (let i = 1; i <= 17; i++) teamGameTotals[i - 1] += getEffectivePointsForPlayerMatchNo(sp.id, i);
                            });
                            const teamGrandTotal = teamGameTotals.reduce((a, b) => a + b, 0);
                            return (
                              <tr className="bg-slate-900 text-white">
                                <td className="px-8 py-5 sticky left-0 z-10 bg-slate-900 font-black uppercase tracking-widest text-[10px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.3)]">
                                  Grand Total
                                </td>
                                {teamGameTotals.map((v, idx) => (
                                  <td key={idx} className="px-3 py-5 text-center text-[10px] font-black tabular-nums">
                                    {v ? (v % 1 === 0 ? v : v.toFixed(1)) : ""}
                                  </td>
                                ))}
                                <td className="px-8 py-5 text-right sticky right-0 z-10 bg-slate-900 font-black italic text-sm shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.3)]">
                                  {teamGrandTotal % 1 === 0 ? teamGrandTotal : teamGrandTotal.toFixed(1)}
                                </td>
                              </tr>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                    )}
                  </div>
                );
              })()
              )}
           </div>
        )}

      </div>

      {activeTab === "sheets" && profile?.id && sheetFranchiseId === profile.id && Object.keys(pendingEdits).length > 0 && (
         <div className="fixed bottom-6 right-6 z-50"><Button onClick={handleBulkSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-8 py-7 shadow-2xl flex gap-3 items-center font-black uppercase text-xs">{saving ? <Loader2 className="animate-spin" /> : <Save />} Save Changes ({Object.keys(pendingEdits).length})</Button></div>
      )}
    </div>
  );
}
