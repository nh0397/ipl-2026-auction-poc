"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart as BarChartRecharts, Bar, PieChart, Pie, Cell, Legend
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Trophy, Medal, Shield, Zap, Star, Activity, 
  Lock, History, AlertCircle, TrendingUp,
  Calculator, Save, RefreshCw, ChevronLeft, Search, Clock,
  Users, User, Download, LayoutGrid, ListChecks, Calendar,
  MapPin, BarChart3, Target, Loader2, ArrowUpDown, Radio, Database, XCircle
} from "lucide-react";
import { cn, getPlayerImage, iplColors } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import React from "react";
import ScorecardViewer from "@/components/scoreboard/ScorecardViewer";
import { adaptCricApiToScorecardViewer } from "@/lib/adapters/cricapiScorecard";
import { aggregateFantasyRowsFromCricApiMatchData } from "@/lib/cricapiFantasyAggregate";
import {
  computeEspnPjBreakdownRows,
  type PlayerCatalogRow,
} from "@/lib/espnPjBreakdownFromScorecard";
import { FantasyPjBreakdownPanel } from "@/components/fantasy/FantasyPjBreakdownPanel";
import { FranchiseCvcPanel } from "@/components/scoreboard/FranchiseCvcPanel";
import { FranchiseIconPanel } from "@/components/scoreboard/FranchiseIconPanel";
import {
  activeCvcForMatchDate,
  franchiseFantasyMultiplier,
  matchDateKeyIST,
  type FranchiseCvcRow,
  type FranchiseIconRow,
} from "@/lib/franchiseCvc";

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

/** Map `players.team` (short or full IPL name) to a canonical short code (CSK, MI, …). */
const IPL_TEAM_HINTS: [RegExp, string][] = [
  [/chennai super kings|chennai|^csk$/i, "CSK"],
  [/mumbai indians|^mi$/i, "MI"],
  [/royal challengers|bengaluru|^rcb$/i, "RCB"],
  [/kolkata knight|^kkr$/i, "KKR"],
  [/delhi capitals|^dc$/i, "DC"],
  [/gujarat titans|^gt$/i, "GT"],
  [/lucknow super giants|^lsg$/i, "LSG"],
  [/punjab kings|^pbks$/i, "PBKS"],
  [/rajasthan royals|^rr$/i, "RR"],
  [/sunrisers hyderabad|^srh$/i, "SRH"],
];

function resolvePlayerTeamToShort(team: string | null | undefined): string | null {
  if (!team) return null;
  const t = team.trim();
  if (!t) return null;
  const upper = t.toUpperCase().replace(/W$/, "");
  for (const code of Object.keys(iplColors)) {
    if (upper === code) return code;
  }
  for (const [re, code] of IPL_TEAM_HINTS) {
    if (re.test(t)) return code;
  }
  return null;
}

type IplScheduleRow = {
  match_no: number | null;
  team1_short: string | null;
  team2_short: string | null;
  date_time_gmt: string | null;
};

/** Per IPL team: league `match_no` values in chronological order (that team’s 1st, 2nd, … game). */
function buildTeamSchedules(rows: IplScheduleRow[]): Map<string, number[]> {
  const byTeam = new Map<string, { mn: number; t: string }[]>();
  for (const r of rows) {
    const mn = Number(r.match_no);
    if (!Number.isFinite(mn) || mn <= 0) continue;
    const dt = String(r.date_time_gmt ?? "");
    for (const raw of [r.team1_short, r.team2_short]) {
      const s = cleanShort(raw);
      if (!s) continue;
      if (!byTeam.has(s)) byTeam.set(s, []);
      byTeam.get(s)!.push({ mn, t: dt });
    }
  }
  const out = new Map<string, number[]>();
  for (const [team, list] of byTeam) {
    list.sort((a, b) => a.t.localeCompare(b.t));
    const seen = new Set<number>();
    const ordered: number[] = [];
    for (const x of list) {
      if (!seen.has(x.mn)) {
        seen.add(x.mn);
        ordered.push(x.mn);
      }
    }
    out.set(team, ordered);
  }
  return out;
}

const SHEET_GAME_SLOTS = 17;

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
  /** IPL schedule from `fixtures_cricapi` — used so sheet columns G1… = each team’s 1st, 2nd, … match. */
  const [iplScheduleRows, setIplScheduleRows] = useState<IplScheduleRow[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [allNominations, setAllNominations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<
    Record<string, { player_id: string; match_id: string; points: number | null; manual_override: boolean }>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"sheets" | "standings" | "fixtures">("sheets");
  const [analyticsTeamId, setAnalyticsTeamId] = useState<string | null>(null);
  const [standings, setStandings] = useState<any[]>([]);
  const [allMatchPoints, setAllMatchPoints] = useState<any[]>([]);
  const [franchiseCvcRows, setFranchiseCvcRows] = useState<FranchiseCvcRow[]>([]);
  const [franchiseIconRows, setFranchiseIconRows] = useState<FranchiseIconRow[]>([]);
  /** Fixtures tab: ESPN / CricAPI modal (scorecard + fantasy tabs). */
  const [fixtureModal, setFixtureModal] = useState<{ source: "espn" | "cricapi"; fixture: Fixture } | null>(null);
  const [fixtureModalTab, setFixtureModalTab] = useState<"scorecard" | "fantasy">("scorecard");
  const [modalFixtureFresh, setModalFixtureFresh] = useState<Fixture | null>(null);
  const [modalRefreshing, setModalRefreshing] = useState(false);
  const [expandedCricapiFantasyId, setExpandedCricapiFantasyId] = useState<string | null>(null);
  const [expandedEspnFantasyKey, setExpandedEspnFantasyKey] = useState<string | null>(null);
  const [syncingPoints, setSyncingPoints] = useState(false);

  const [espnScorecardByMatchNo, setEspnScorecardByMatchNo] = useState<Record<number, any | null>>({});
  const [espnScorecardLoadingByMatchNo, setEspnScorecardLoadingByMatchNo] = useState<Record<number, boolean>>({});
  /** `public.fixtures.points_synced` keyed by `match_no` — sole source for “synced”; not `fixtures_cricapi` or `match_ended`. */
  const [fixturePointsSyncedByMatchNo, setFixturePointsSyncedByMatchNo] = useState<Record<number, boolean>>({});

  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [fixtureFilter, setFixtureFilter] = useState<"all" | "upcoming" | "completed">("all");

  const [subLoading, setSubLoading] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  /** Which auction franchise’s score sheet is shown (sub-tabs under Sheets). */
  const [sheetFranchiseId, setSheetFranchiseId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!fixtureModal) {
      setModalFixtureFresh(null);
      return;
    }
    let cancelled = false;
    if (fixtureModal.source === "cricapi") {
      setModalRefreshing(true);
      (async () => {
        const { data, error } = await supabase
          .from("fixtures_cricapi")
          .select("*")
          .eq("id", fixtureModal.fixture.id)
          .maybeSingle();
        if (cancelled) return;
        if (!error && data) {
          setModalFixtureFresh(data as Fixture);
          setFixtures((prev) => prev.map((f) => (f.id === fixtureModal.fixture.id ? { ...f, ...data } : f)));
        }
        setModalRefreshing(false);
      })();
      return () => {
        cancelled = true;
      };
    }
    if (fixtureModal.source === "espn") {
      const mn = espnMatchNo(fixtureModal.fixture);
      if (mn == null) return;
      void fetchEspnScorecardForMatchNo(mn);
    }
  }, [fixtureModal, fetchEspnScorecardForMatchNo]);

  const closeFixtureModal = useCallback(() => {
    setFixtureModal(null);
    setFixtureModalTab("scorecard");
    setExpandedCricapiFantasyId(null);
    setExpandedEspnFantasyKey(null);
  }, []);

  const cricapiModalData = fixtureModal?.source === "cricapi" ? modalFixtureFresh ?? fixtureModal.fixture : null;
  const cricapiViewer = useMemo(() => {
    const raw = cricapiModalData?.scorecard;
    if (!raw) return null;
    return adaptCricApiToScorecardViewer(raw);
  }, [cricapiModalData?.scorecard]);

  const cricapiFantasyRows = useMemo(() => {
    const raw = cricapiModalData?.scorecard as Record<string, unknown> | null | undefined;
    if (!raw) return [];
    return aggregateFantasyRowsFromCricApiMatchData(raw);
  }, [cricapiModalData?.scorecard]);

  const espnModalMn = fixtureModal?.source === "espn" ? espnMatchNo(fixtureModal.fixture) : null;
  const espnModalScore = espnModalMn != null ? espnScorecardByMatchNo[espnModalMn] : undefined;
  const espnModalLoading = espnModalMn != null ? !!espnScorecardLoadingByMatchNo[espnModalMn] : false;
  const espnModalPjRows = useMemo(() => {
    if (fixtureModal?.source !== "espn" || !espnModalScore?.innings?.length || !fixtureModal) return [];
    return computeEspnPjBreakdownRows(espnModalScore, fixtureModal.fixture, playersCatalog);
  }, [fixtureModal, espnModalScore, playersCatalog]);

  const today = useMemo(() => getTodayIST(), []);

  const matchByNo = useMemo(() => {
    const map = new Map<number, any>();
    (allMatches || []).forEach((m) => {
      const n = Number(m?.match_no);
      if (Number.isFinite(n)) map.set(n, m);
    });
    return map;
  }, [allMatches]);

  const teamSchedules = useMemo(() => buildTeamSchedules(iplScheduleRows), [iplScheduleRows]);

  /**
   * Stored `match_points.points`: NULL = DNP, number = score (0 = played, zero points).
   * Map only contains keys for rows present in DB or pending; missing key = no row yet.
   */
  const matchPointsCellMap = useMemo(() => {
    const map = new Map<string, number | null>();
    (allMatchPoints || []).forEach((pt: any) => {
      if (!pt?.player_id || !pt?.match_id) return;
      const key = `${pt.player_id}_${pt.match_id}`;
      const raw = pt.points;
      if (raw === null || raw === undefined) map.set(key, null);
      else map.set(key, Number(raw) || 0);
    });
    Object.values(pendingEdits || {}).forEach((ed: any) => {
      if (!ed?.player_id || !ed?.match_id) return;
      const key = `${ed.player_id}_${ed.match_id}`;
      const raw = ed.points;
      if (raw === null || raw === undefined) map.set(key, null);
      else map.set(key, Number(raw) || 0);
    });
    return map;
  }, [allMatchPoints, pendingEdits]);

  /** `base_points` from DB (before performance multipliers); used under the cell total. */
  const matchPointsBasePointsMap = useMemo(() => {
    const map = new Map<string, number | null>();
    (allMatchPoints || []).forEach((pt: any) => {
      if (!pt?.player_id || !pt?.match_id) return;
      const key = `${pt.player_id}_${pt.match_id}`;
      const raw = pt.base_points;
      if (raw === null || raw === undefined) map.set(key, null);
      else map.set(key, Number(raw));
    });
    return map;
  }, [allMatchPoints]);

  /** Stored fantasy total (base × multipliers) × franchise Icon or C/VC for this match day. */
  const getFranchiseFantasyMult = useCallback(
    (franchiseId: string, playerId: string, mObj: { id: string; date_time?: string } | null | undefined) => {
      if (!mObj?.date_time) return { mult: 1, tag: null as "icon" | "c" | "vc" | null };
      const d = matchDateKeyIST(mObj.date_time);
      const active = activeCvcForMatchDate(franchiseCvcRows, franchiseId, d);
      const iconId = franchiseIconRows.find((r) => r.team_id === franchiseId)?.player_id ?? null;
      return franchiseFantasyMultiplier(playerId, iconId, active);
    },
    [franchiseCvcRows, franchiseIconRows]
  );

  /** Sheet total: stored fantasy points × franchise multiplier (Icon / C / VC). */
  const getFranchiseSheetPoints = useCallback(
    (playerId: string, playerTeam: string | null | undefined, slot: number, franchiseId: string) => {
      const short = resolvePlayerTeamToShort(playerTeam);
      if (!short) return 0;
      const sched = teamSchedules.get(short);
      const leagueMn = sched?.[slot - 1];
      if (leagueMn == null) return 0;
      const m = matchByNo.get(leagueMn);
      if (!m?.id) return 0;
      const key = `${playerId}_${m.id}`;
      if (!matchPointsCellMap.has(key)) return 0;
      const v = matchPointsCellMap.get(key);
      if (v === null) return 0;
      const raw = Number(v) || 0;
      const { mult } = getFranchiseFantasyMult(franchiseId, playerId, m);
      return Math.round(raw * mult * 100) / 100;
    },
    [teamSchedules, matchByNo, matchPointsCellMap, getFranchiseFantasyMult]
  );

  /** Numeric points for totals (DNP and empty cell = 0). */
  const getEffectivePointsForPlayerTeamGame = (playerId: string, playerTeam: string | null | undefined, slot: number) => {
    const short = resolvePlayerTeamToShort(playerTeam);
    if (!short) return 0;
    const sched = teamSchedules.get(short);
    const leagueMn = sched?.[slot - 1];
    if (leagueMn == null) return 0;
    const m = matchByNo.get(leagueMn);
    if (!m?.id) return 0;
    const key = `${playerId}_${m.id}`;
    if (!matchPointsCellMap.has(key)) return 0;
    const v = matchPointsCellMap.get(key);
    if (v === null) return 0;
    return v;
  };

  /** Match considered “played” for DNP / empty semantics (sheet UX). */
  const isMatchPlayed = useCallback((m: { date_time?: string; is_locked?: boolean } | null | undefined) => {
    if (!m) return false;
    if (m.is_locked === true) return true;
    const dt = m.date_time;
    if (!dt) return false;
    return new Date(dt).getTime() <= Date.now();
  }, []);

  /**
   * no_match: slot past IPL schedule — show 0.
   * upcoming: match not played yet — show 0 (not DNP).
   * no_data: match played, no row in DB — show — until sync/entry (not auto DNP).
   * dnp: NULL stored — did not play.
   * score: numeric including 0 (played, zero points).
   */
  const resolveSheetCell = (
    playerId: string,
    mObj: { id: string; date_time?: string; is_locked?: boolean } | undefined
  ):
    | { kind: "no_match" }
    | { kind: "upcoming" }
    | { kind: "no_data" }
    | { kind: "dnp" }
    | { kind: "score"; value: number } => {
    if (!mObj) return { kind: "no_match" };
    if (!isMatchPlayed(mObj)) return { kind: "upcoming" };
    const key = `${playerId}_${mObj.id}`;
    const v = matchPointsCellMap.get(key);
    if (v === undefined) return { kind: "no_data" };
    if (v === null) return { kind: "dnp" };
    return { kind: "score", value: v };
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
      const [teamsRes, matchesRes, scheduleRes, playersCatRes, cvcRes, iconRes] = await Promise.all([
        supabase.from("profiles").select("*").neq("role", "Viewer").order("team_name", { ascending: true }),
        supabase.from("matches").select("*").order("match_no", { ascending: true }),
        supabase
          .from("fixtures_cricapi")
          .select("match_no,team1_short,team2_short,date_time_gmt")
          .order("date_time_gmt", { ascending: true }),
        supabase
          .from("players")
          .select("player_name, team, type, role")
          .eq("auction_status", "sold")
          .order("player_name", { ascending: true }),
        supabase.from("franchise_cvc_selections").select("*"),
        supabase.from("franchise_icon_selection").select("*"),
      ]);
      if (scheduleRes.data) setIplScheduleRows(scheduleRes.data as IplScheduleRow[]);
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
      if (cvcRes.data) setFranchiseCvcRows(cvcRes.data as FranchiseCvcRow[]);
      if (iconRes.data) setFranchiseIconRows(iconRes.data as FranchiseIconRow[]);
    } finally { setTimeout(() => setLoading(false), 300); }
  };

  /** All auction franchises’ squads + persisted match points (sheets tab). */
  const fetchSheetsData = async () => {
    setSubLoading(true);
    try {
      const [playersRes, pointsRes, schedRes, cvcRes, iconRes] = await Promise.all([
        supabase.from("players").select("*").eq("auction_status", "sold").order("player_name", { ascending: true }),
        supabase.from("match_points").select("*"),
        supabase
          .from("fixtures_cricapi")
          .select("match_no,team1_short,team2_short,date_time_gmt")
          .order("date_time_gmt", { ascending: true }),
        supabase.from("franchise_cvc_selections").select("*"),
        supabase.from("franchise_icon_selection").select("*"),
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
      if (schedRes.data?.length) setIplScheduleRows(schedRes.data as IplScheduleRow[]);
      if (cvcRes.data) setFranchiseCvcRows(cvcRes.data as FranchiseCvcRow[]);
      if (iconRes.data) setFranchiseIconRows(iconRes.data as FranchiseIconRow[]);
    } finally {
      setSubLoading(false);
    }
  };

  const fetchStandingsData = async () => {
    setTabLoading(true);
    try {
      // Must include `team` (IPL side) or G-column mapping and charts read 0 for every cell.
      const [{ data: soldPlayers }, { data: pts }, { data: schedRes }, { data: cvcRows }, { data: iconRows }] = await Promise.all([
        supabase.from("players").select("*").eq("auction_status", "sold").order("player_name", { ascending: true }),
        supabase.from("match_points").select("*"),
        supabase
          .from("fixtures_cricapi")
          .select("match_no,team1_short,team2_short,date_time_gmt")
          .order("date_time_gmt", { ascending: true }),
        supabase.from("franchise_cvc_selections").select("*"),
        supabase.from("franchise_icon_selection").select("*"),
      ]);
      setAllPlayers(soldPlayers || []);
      setAllMatchPoints(pts || []);
      if (schedRes?.length) setIplScheduleRows(schedRes as IplScheduleRow[]);
      if (cvcRows) setFranchiseCvcRows(cvcRows as FranchiseCvcRow[]);
      if (iconRows) setFranchiseIconRows(iconRows as FranchiseIconRow[]);
    } finally {
      setTabLoading(false);
    }
  };

  /** Standings: numeric totals only (DNP → 0). */
  const buildPointsMap = useCallback((points: any[]) => {
    const map = new Map<string, number>();
    (points || []).forEach((pt: any) => {
      if (!pt?.player_id || !pt?.match_id) return;
      const raw = pt.points;
      const n = raw === null || raw === undefined ? 0 : Number(raw) || 0;
      map.set(`${pt.player_id}_${pt.match_id}`, n);
    });
    Object.values(pendingEdits || {}).forEach((ed: any) => {
      if (!ed?.player_id || !ed?.match_id) return;
      const raw = ed.points;
      const n = raw === null || raw === undefined ? 0 : Number(raw) || 0;
      map.set(`${ed.player_id}_${ed.match_id}`, n);
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
              const raw = pointsMap.get(key) || 0;
              const iconId = franchiseIconRows.find((r) => r.team_id === team.id)?.player_id ?? null;
              const d = matchDateKeyIST(m.date_time);
              const active = activeCvcForMatchDate(franchiseCvcRows, team.id, d);
              const { mult } = franchiseFantasyMultiplier(player.id, iconId, active);
              matchTotal += raw * mult;
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
    [franchises, allMatches, buildPointsMap, playerBelongsToTeam, franchiseCvcRows, franchiseIconRows]
  );

  useEffect(() => {
    if (activeTab !== "standings") return;
    if (!franchises.length || !allMatches.length) return;
    calculateStandings(allPlayers, allMatchPoints);
  }, [activeTab, allMatchPoints, allPlayers, allMatches, franchises, calculateStandings, franchiseCvcRows, franchiseIconRows]);

  const fetchMatchSpecificData = async (matchId: string) => {
    const { data } = await supabase.from("nominations").select("*").eq("match_id", matchId);
    setAllNominations(data || []);
  };

  const setSeasonMatchPoints = (pId: string, teamGameSlot: number, points: number | null) => {
    if (!profile?.id || sheetFranchiseId !== profile.id) return;
    const fr = franchises.find((f) => f.id === sheetFranchiseId);
    const player = allPlayers.find((p) => p.id === pId);
    if (!fr || !player || (player.sold_to_id !== fr.id && player.sold_to !== fr.team_name)) return;
    const short = resolvePlayerTeamToShort(player.team);
    const leagueMn = short ? teamSchedules.get(short)?.[teamGameSlot - 1] : undefined;
    const match = leagueMn != null ? allMatches.find((m) => m.match_no === leagueMn) : undefined;
    if (!match) return;
    setPendingEdits((prev) => ({
      ...prev,
      [`${pId}_${match.id}`]: { player_id: pId, match_id: match.id, points, manual_override: true },
    }));
  };

  const updateSeasonPoint = (pId: string, teamGameSlot: number, val: string) => {
    const ptsIn = parseFloat(val);
    const displayPts = Number.isFinite(ptsIn) ? ptsIn : 0;
    const fr = franchises.find((f) => f.id === sheetFranchiseId);
    const player = allPlayers.find((p) => p.id === pId);
    if (!fr || !player) return;
    const short = resolvePlayerTeamToShort(player.team);
    const leagueMn = short ? teamSchedules.get(short)?.[teamGameSlot - 1] : undefined;
    const match = leagueMn != null ? allMatches.find((m) => m.match_no === leagueMn) : undefined;
    const mult = match ? getFranchiseFantasyMult(fr.id, pId, match).mult : 1;
    const raw = mult > 0 ? Math.round((displayPts / mult) * 100) / 100 : displayPts;
    setSeasonMatchPoints(pId, teamGameSlot, raw);
  };

  const handleSyncMatchPoints = async () => {
    setSyncingPoints(true);
    try {
      const res = await fetch("/api/match-points/sync", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof json?.error === "string" ? json.error : `Sync failed (${res.status})`);
        return;
      }
      const { data: pts } = await supabase.from("match_points").select("*");
      setAllMatchPoints(pts || []);
      const skipM = json.rowsSkippedManual ?? 0;
      const skipU = json.rowsSkippedUnmapped ?? 0;
      const sample = Array.isArray(json.unmappedNameSample) ? json.unmappedNameSample : [];
      alert(
        `Synced: ${json.rowsUpserted ?? 0} row(s) from ${json.fixturesProcessed ?? 0} fixture(s).` +
          (skipM ? ` Skipped ${skipM} manual row(s).` : "") +
          (skipU
            ? ` No DB player for ${skipU} scorecard name(s) (CricAPI IDs are mapped by player name).` +
                (sample.length ? ` Examples: ${sample.slice(0, 8).join(", ")}` : "")
            : "") +
          (json.errors?.length ? `\nNotes: ${json.errors.slice(0, 5).join("; ")}` : "")
      );
    } finally {
      setSyncingPoints(false);
    }
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
      <div className="max-w-7xl mx-auto min-w-0 space-y-6">
        
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
          <div className="min-w-0 space-y-6 animate-in fade-in duration-500">
             {(() => {
                /** Same axes as score sheets: G1 = IPL team’s 1st match, … — cumulative = running sum of franchise column totals. */
                const gameLabels = Array.from({ length: SHEET_GAME_SLOTS }, (_, i) => `G${i + 1}`);
                const cumulativeData = gameLabels.reduce((acc: any[], gl, gIdx) => {
                  const slot = gIdx + 1;
                  const prev = gIdx > 0 ? acc[gIdx - 1] : null;
                  const data: Record<string, unknown> = { game: gl };
                  standings.forEach((team) => {
                    const teamPlayers = allPlayers.filter(
                      (p) => p.sold_to_id === team.id || p.sold_to === team.team_name
                    );
                    let colSum = 0;
                    teamPlayers.forEach((tp) => {
                      colSum += Number(getEffectivePointsForPlayerTeamGame(tp.id, tp.team, slot)) || 0;
                    });
                    const prior = prev ? Number((prev as Record<string, number>)[team.team_name]) || 0 : 0;
                    data[team.team_name] = prior + colSum;
                  });
                  acc.push(data);
                  return acc;
                }, []);

                const currentAnalyticsTeam = analyticsTeamId
                  ? franchises.find((f) => f.id === analyticsTeamId)
                  : standings[0];
                const playerPointsList = allPlayers
                  .filter((p) => p.sold_to_id === currentAnalyticsTeam?.id || p.sold_to === currentAnalyticsTeam?.team_name)
                  .map((p) => ({
                    name: p.player_name,
                    points: Array.from({ length: SHEET_GAME_SLOTS }, (_, i) =>
                      Number(getEffectivePointsForPlayerTeamGame(p.id, p.team, i + 1)) || 0
                    ).reduce((a, b) => a + b, 0),
                    role: p.role,
                  }))
                  .sort((a, b) => (b.points ?? 0) - (a.points ?? 0));

                const contributorData = playerPointsList
                  .slice(0, 5)
                  .map((p) => ({ name: p.name.split(" ")[0], value: Math.round(p.points ?? 0) }));
                const roleData = ["Batter", "Bowler", "All-Rounder", "WK"]
                  .map((r) => ({
                    name: r,
                    value: Math.round(
                      playerPointsList.filter((p) => p.role === r).reduce((a, b) => a + (b.points ?? 0), 0)
                    ),
                  }))
                  .filter((d) => d.value > 0);

                return (
                  <>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-[2rem] p-6 border shadow-sm h-80">
                           <h3 className="text-sm font-black uppercase italic">Points Progression</h3>
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-3 leading-snug">
                             Cumulative franchise points after each sheet column (sum of G1…Gk column totals for that squad).
                           </p>
                           <ResponsiveContainer width="100%" height="82%"><AreaChart data={cumulativeData}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="game" tick={{fontSize:10, fontWeight:700}} /><YAxis tick={{fontSize:10, fontWeight:700}} /><Tooltip contentStyle={{borderRadius:12, border:"none", boxShadow:"0 5px 15px rgba(0,0,0,0.1)"}} />{standings.map((t, i) => <Area key={t.id} type="monotone" dataKey={t.team_name} stroke={TEAM_COLORS[i % TEAM_COLORS.length]} fill="none" strokeWidth={3} />)}</AreaChart></ResponsiveContainer>
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
                     <Card className="relative min-w-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
                        {tabLoading && <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-50 flex items-center justify-center"><Loader2 className="animate-spin text-slate-900" /></div>}
                        <CardHeader className="bg-slate-50/50 p-8 border-b"><CardTitle className="text-xl font-black uppercase italic text-slate-900">Season Standings</CardTitle></CardHeader>
                        <CardContent className="min-w-0 overflow-x-auto overscroll-x-contain touch-pan-x p-0 [-webkit-overflow-scrolling:touch]"><table className="w-full min-w-[800px] text-left"><thead className="bg-slate-50"><tr><th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Rank</th><th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Franchise</th><th className="px-6 py-5 text-center text-[10px] font-black text-slate-400">Squad</th><th className="px-6 py-5 text-center text-[10px] font-black text-slate-400">Games</th><th className="px-8 py-5 text-right text-[10px] font-black text-slate-900">Total Points</th></tr></thead><tbody>{standings.map((t, idx) => (<tr key={t.id} className="border-b hover:bg-slate-50 transition-colors"><td className="px-8 py-6"><span className={cn("h-10 w-10 flex items-center justify-center rounded-2xl font-black", idx === 0 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400")}>{idx + 1}</span></td><td className="px-8 py-6"><div className="font-black italic uppercase text-slate-900">{t.team_name}</div></td><td className="px-6 py-6 text-center font-black text-slate-500">{t.squadSize}</td><td className="px-6 py-6 text-center font-black text-slate-500">{t.matchesPlayed}</td><td className="px-8 py-6 text-right font-black italic text-2xl text-slate-900">{Math.floor(t.totalPoints)}</td></tr>))}</tbody></table></CardContent>
                     </Card>
                  </>
                );
             })()}
          </div>
        )}

        {/* ─── TAB: FIXTURES ─── */}
        {activeTab === "fixtures" && (
          <div className="min-w-0 space-y-6 animate-in fade-in duration-500">
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
                      const espnPointsSynced = mnRow != null ? !!fixturePointsSyncedByMatchNo[mnRow] : false;
                      const cricapiPointsSynced = !!match.points_synced;
                      const espnReady = mnRow != null && espnPointsSynced;
                      const cricReady = cricapiPointsSynced;
                      const syncStatusLine = (() => {
                        if (espnReady && cricReady) return null;
                        if (!espnReady && !cricReady) return "ESPN and CricAPI data not ready yet";
                        if (!espnReady) return "ESPN points pending";
                        return "CricAPI sync pending";
                      })();
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
                         <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-slate-50 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase min-w-0 break-words leading-snug">
                              {(() => {
                                const ist = `${formatTime(match.date_time_gmt)} IST`;
                                const local = formatLocalTime(match.date_time_gmt);
                                const localPart = local.tz !== "IST" ? ` • ${local.time} ${local.tz}` : "";
                                const venue = match.venue?.split(",")[0] ? ` • ${match.venue.split(",")[0]}` : "";
                                return `${ist}${localPart}${venue}`;
                              })()}
                            </div>
                            <div className="grid grid-cols-2 gap-2 w-full sm:max-w-sm sm:ml-auto">
                              <button
                                type="button"
                                disabled={!espnReady}
                                onClick={() => {
                                  if (!espnReady) return;
                                  const mn = espnMatchNo(match);
                                  if (mn != null) void fetchEspnScorecardForMatchNo(mn);
                                  setFixtureModalTab("scorecard");
                                  setExpandedCricapiFantasyId(null);
                                  setFixtureModal({ source: "espn", fixture: match });
                                }}
                                className={cn(
                                  "touch-manipulation min-h-10 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wide transition-all border text-center leading-tight",
                                  espnReady
                                    ? "bg-white border-slate-200 text-slate-800 active:bg-slate-100 hover:bg-slate-50 shadow-sm"
                                    : "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                                )}
                              >
                                <Radio className="h-3.5 w-3.5 shrink-0" />
                                ESPN
                              </button>
                              <button
                                type="button"
                                disabled={!cricReady}
                                onClick={() => {
                                  if (!cricReady) return;
                                  setFixtureModalTab("scorecard");
                                  setExpandedCricapiFantasyId(null);
                                  setFixtureModal({ source: "cricapi", fixture: match });
                                }}
                                className={cn(
                                  "touch-manipulation min-h-10 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wide transition-all border text-center leading-tight",
                                  cricReady
                                    ? "bg-slate-900 text-white border-slate-900 active:bg-slate-800 hover:bg-black shadow-md"
                                    : "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                                )}
                              >
                                <Database className="h-3.5 w-3.5 shrink-0" />
                                CricAPI
                              </button>
                            </div>
                            {syncStatusLine ? (
                              <p className="text-[9px] font-bold text-slate-500 text-center sm:text-right uppercase tracking-wide leading-snug">
                                {syncStatusLine}
                              </p>
                            ) : null}
                            {!espnReady && !cricReady && !match.match_ended ? (
                              <p className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded uppercase text-center sm:text-right w-fit sm:ml-auto">
                                Live soon
                              </p>
                            ) : null}
                         </div>
                      </div>
                      </div>
                   )})}
                </div>
             ))}
          {fixtureModal && (
            <div className="fixed inset-0 z-[100] flex items-stretch sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeFixtureModal} />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="scoreboard-fixture-modal-title"
                className="relative box-border flex min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-none bg-white shadow-2xl animate-in slide-in-from-bottom duration-500 h-[100dvh] max-h-[100dvh] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:h-auto sm:max-h-[min(90vh,calc(100dvh-2rem))] sm:rounded-3xl sm:pt-0 sm:pb-0"
              >
                <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-start gap-2 sm:gap-4 bg-white shrink-0">
                  <div className="flex items-start gap-2 sm:gap-4 min-w-0 flex-1">
                    <div
                      className={cn(
                        "h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shadow-lg shrink-0 mt-0.5",
                        fixtureModal.source === "espn" ? "bg-white border border-slate-200" : "bg-blue-600 shadow-blue-100"
                      )}
                    >
                      {fixtureModal.source === "espn" ? (
                        <Radio className="h-4 w-4 sm:h-5 sm:w-5 text-slate-800" />
                      ) : (
                        <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pr-1">
                      <h2
                        id="scoreboard-fixture-modal-title"
                        className="text-sm sm:text-lg font-black uppercase tracking-tight text-slate-900 leading-snug break-words"
                      >
                        {fixtureModal.fixture.title || "Match"}
                      </h2>
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wide sm:tracking-widest mt-1 leading-relaxed break-words">
                        {fixtureModal.source === "espn" ? "ESPN (fixtures table)" : "CricAPI (fixtures_cricapi)"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeFixtureModal}
                    className="p-2 -mr-1 hover:bg-slate-100 rounded-full transition-colors group shrink-0 touch-manipulation"
                    aria-label="Close"
                  >
                    <XCircle className="h-6 w-6 text-slate-300 group-hover:text-slate-600" />
                  </button>
                </div>

                <Tabs
                  value={fixtureModalTab}
                  onValueChange={(v) => setFixtureModalTab(v as "scorecard" | "fantasy")}
                  className="flex flex-col flex-1 min-h-0 overflow-hidden"
                >
                  <div className="px-3 sm:px-6 pt-2 sm:pt-3 pb-2 border-b border-slate-100 bg-slate-50/80 shrink-0">
                    <TabsList className="w-full h-auto min-h-10 flex-wrap sm:flex-nowrap gap-1 p-1">
                      <TabsTrigger value="scorecard" className="flex-1 min-w-[8rem] text-xs sm:text-sm py-2 touch-manipulation">
                        Scorecard
                      </TabsTrigger>
                      <TabsTrigger value="fantasy" className="flex-1 min-w-[8rem] text-xs sm:text-sm py-2 touch-manipulation">
                        <span className="hidden sm:inline">Fantasy points</span>
                        <span className="sm:hidden">Fantasy</span>
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="scorecard" className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 md:p-8 mt-0 min-h-0">
                    {fixtureModal.source === "cricapi" && (
                      <>
                        {modalRefreshing ? (
                          <div className="flex flex-col items-center justify-center py-20 gap-4 px-2">
                            <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-center leading-relaxed">
                              Loading from database…
                            </p>
                          </div>
                        ) : cricapiViewer?.innings ? (
                          <div className="w-full min-w-0 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
                            <ScorecardViewer scorecard={cricapiViewer} />
                          </div>
                        ) : (
                          <p className="text-center text-sm font-bold text-slate-400 py-16 uppercase tracking-wide">
                            No scorecard in DB yet for this match.
                          </p>
                        )}
                      </>
                    )}
                    {fixtureModal.source === "espn" && (
                      <>
                        {espnModalMn == null ? (
                          <p className="text-center text-sm font-bold text-slate-400 py-16 uppercase tracking-wide">
                            No <code className="font-mono">match_no</code> — link this fixture to ESPN in Supabase.
                          </p>
                        ) : espnModalLoading ? (
                          <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="h-10 w-10 text-slate-600 animate-spin" />
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                              Loading ESPN scorecard from database…
                            </p>
                          </div>
                        ) : espnModalScore?.innings?.length ? (
                          <div className="w-full min-w-0 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
                            <ScorecardViewer scorecard={espnModalScore} />
                          </div>
                        ) : (
                          <p className="text-center text-sm font-bold text-slate-400 py-16 uppercase tracking-wide">
                            No ESPN scorecard stored for this match_no.
                          </p>
                        )}
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="fantasy" className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 mt-0 min-h-0">
                    {fixtureModal.source === "cricapi" && (
                      <>
                        {modalRefreshing ? (
                          <div className="flex justify-center py-16">
                            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                          </div>
                        ) : cricapiFantasyRows.length === 0 ? (
                          <p className="text-center text-sm font-bold text-slate-400 py-16 px-2 leading-relaxed">
                            No fantasy rows — save a CricAPI scorecard to the DB first.
                          </p>
                        ) : (
                          <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-slate-100">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-8 sm:w-10 px-2 sm:px-4" />
                                  <TableHead className="min-w-[7rem] max-w-[40vw]">Player</TableHead>
                                  <TableHead className="min-w-[4rem]">Team</TableHead>
                                  <TableHead className="text-right whitespace-nowrap">PJ</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {cricapiFantasyRows.map((row) => {
                                  const open = expandedCricapiFantasyId === row.player_id;
                                  const { breakdown, scoring, d11 } = row;
                                  const mult = d11.appliedMultiplier;
                                  return (
                                    <React.Fragment key={row.player_id}>
                                      <TableRow
                                        className="cursor-pointer touch-manipulation"
                                        onClick={() => setExpandedCricapiFantasyId(open ? null : row.player_id)}
                                      >
                                        <TableCell className="px-2 sm:px-4 align-top">{open ? "▼" : "▶"}</TableCell>
                                        <TableCell className="max-w-[40vw] sm:max-w-none">
                                          <div className="font-semibold text-slate-900 text-sm leading-snug break-words">
                                            {row.player_name}
                                          </div>
                                          <div className="text-[10px] text-slate-500 break-words">{row.fantasy.playerRole}</div>
                                        </TableCell>
                                        <TableCell className="align-top">
                                          {row.team ? (
                                            <Badge
                                              variant="secondary"
                                              className="whitespace-normal text-center max-w-[6rem] sm:max-w-none break-words"
                                            >
                                              {row.team}
                                            </Badge>
                                          ) : (
                                            "—"
                                          )}
                                        </TableCell>
                                        <TableCell className="text-right align-top whitespace-nowrap">
                                          <div className="font-bold tabular-nums text-slate-900">
                                            {d11.multipliedTotal % 1 === 0 ? d11.multipliedTotal : d11.multipliedTotal.toFixed(2)}
                                          </div>
                                          {mult > 1 ? (
                                            <div className="text-[10px] font-medium text-amber-800">
                                              ×{mult} on {scoring.total_pts} base
                                            </div>
                                          ) : (
                                            <div className="text-[10px] text-slate-500">Base (1×)</div>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                      {open ? (
                                        <TableRow>
                                          <TableCell colSpan={4} className="bg-slate-50 p-3 sm:p-4">
                                            <FantasyPjBreakdownPanel breakdown={breakdown} scoring={scoring} d11={d11} />
                                          </TableCell>
                                        </TableRow>
                                      ) : null}
                                    </React.Fragment>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </>
                    )}
                    {fixtureModal.source === "espn" && (
                      <>
                        {espnModalMn == null ? (
                          <p className="text-center text-sm font-bold text-slate-400 py-16 uppercase tracking-wide">
                            Need <code className="font-mono">match_no</code> for ESPN PJ breakdown.
                          </p>
                        ) : espnModalLoading ? (
                          <div className="flex justify-center py-16">
                            <Loader2 className="h-8 w-8 text-slate-600 animate-spin" />
                          </div>
                        ) : espnModalPjRows.length === 0 ? (
                          <p className="text-center text-sm font-bold text-slate-400 py-16">
                            Load an ESPN scorecard from the database (Scorecard tab) to compute PJ points.
                          </p>
                        ) : (
                          <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-slate-100">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="min-w-[10rem]">Player</TableHead>
                                  <TableHead className="min-w-[5rem]">Team</TableHead>
                                  <TableHead className="text-right whitespace-nowrap">PJ</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {espnModalPjRows.map((row) => {
                                  const key = `${row.n}_${row.team}`;
                                  const open = expandedEspnFantasyKey === key;
                                  const d11 = row.d11;
                                  const mult = d11?.appliedMultiplier ?? 1;
                                  const pj = row.pjDetail;
                                  const sc = row.pjScoring;
                                  return (
                                    <React.Fragment key={key}>
                                      <TableRow
                                        className="cursor-pointer touch-manipulation"
                                        onClick={() => setExpandedEspnFantasyKey(open ? null : key)}
                                      >
                                        <TableCell className="align-top font-medium text-sm">
                                          <span className="mr-2 inline-block w-4 text-slate-400">{open ? "▼" : "▶"}</span>
                                          <span className="break-words max-w-[50vw] sm:max-w-none">{row.n}</span>
                                        </TableCell>
                                        <TableCell className="align-top">
                                          <Badge variant="outline" className="whitespace-normal break-words max-w-[7rem]">
                                            {row.team}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-right whitespace-nowrap">
                                          <div className="font-bold tabular-nums text-slate-900">
                                            {d11
                                              ? d11.multipliedTotal % 1 === 0
                                                ? d11.multipliedTotal
                                                : d11.multipliedTotal.toFixed(2)
                                              : row.total}
                                          </div>
                                          {d11 && mult > 1 ? (
                                            <div className="text-[10px] font-medium text-amber-800">
                                              ×{mult} on {row.total} base
                                            </div>
                                          ) : (
                                            <div className="text-[10px] text-slate-500">Base (1×)</div>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                      {open && pj && sc ? (
                                        <TableRow>
                                          <TableCell colSpan={3} className="bg-slate-50 p-3 sm:p-4">
                                            <FantasyPjBreakdownPanel breakdown={pj} scoring={sc} d11={d11} />
                                          </TableCell>
                                        </TableRow>
                                      ) : open ? (
                                        <TableRow>
                                          <TableCell colSpan={3} className="bg-slate-50 p-4 text-sm text-slate-500">
                                            Breakdown not available for this row.
                                          </TableCell>
                                        </TableRow>
                                      ) : null}
                                    </React.Fragment>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>
                </Tabs>

                <div className="p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-slate-50 border-t border-slate-100 text-center shrink-0">
                  <button
                    type="button"
                    onClick={closeFixtureModal}
                    className="w-full sm:w-auto min-h-[48px] px-8 py-3 bg-white border border-slate-200 text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm touch-manipulation active:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        )}

        {/* ─── TAB: SCORE SHEETS (4 franchise tabs; edit only your own) ─── */}
        {activeTab === "sheets" && (
           <div className="min-w-0 space-y-8 animate-in fade-in duration-500">
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
                    <div className="flex flex-wrap gap-2">
                    <Button 
                      variant="outline" 
                      disabled={syncingPoints}
                      onClick={handleSyncMatchPoints}
                      className="h-11 border-slate-200 rounded-xl font-black uppercase tracking-widest flex gap-2 text-slate-600 px-6 shadow-sm text-[10px]"
                      title="Recompute stored points from scorecards (base points × multipliers). Sheet saves are skipped."
                    >
                       {syncingPoints ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                       Sync points
                    </Button>
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
                 </div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    Rows are ordered by IPL team name, then player. Row tint follows IPL franchise (CSK, MI, RCB, etc.), matching the auction room and dashboard.
                    Each game column G1–G{SHEET_GAME_SLOTS} is that player’s IPL team’s 1st, 2nd, … match of the season (not the league schedule round). If CSK have played twice, only G1–G2 apply for CSK players.
                    The database stores <span className="font-black text-slate-600">base points</span> (<code className="font-mono text-slate-500">base_points</code>) and <span className="font-black text-slate-600">total fantasy points</span> (<code className="font-mono text-slate-500">points</code>) = <span className="font-black text-slate-600">base points × performance multipliers</span> (big scores get a higher multiplier). The big number in each cell is your <span className="font-black text-slate-600">franchise total</span> = that stored total × <span className="font-black text-slate-600">Icon (2×) or Captain / Vice</span> (Icon wins if both apply). Small lines under the cell spell out <span className="font-black text-slate-600">base × multiplier → stored</span> and <span className="font-black text-slate-600">stored × franchise → what you see</span>. Day pipeline: <code className="font-mono">python3 scripts/run_ipl_day.py --date YYYY-MM-DD</code>. Manual edits set <span className="font-black text-slate-600">manual_override</span> so Sync skips them.
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
                  <div className="min-w-0 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
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
                              for (let i = 1; i <= SHEET_GAME_SLOTS; i++) {
                                t +=
                                  Number(getFranchiseSheetPoints(sp.id, sp.team, i, franchise.id)) || 0;
                              }
                              return sum + t;
                            }, 0);
                            return String(teamTotal % 1 === 0 ? teamTotal : teamTotal.toFixed(1));
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="border-b border-slate-100 space-y-4 px-3 py-3 sm:px-6">
                      <FranchiseIconPanel
                        franchiseId={franchise.id}
                        franchiseLabel={franchise.team_name || franchise.full_name || ""}
                        squad={squad}
                        row={franchiseIconRows.find((r) => r.team_id === franchise.id)}
                        canEdit={canEdit}
                        onSaved={async () => {
                          const { data } = await supabase.from("franchise_icon_selection").select("*");
                          setFranchiseIconRows((data as FranchiseIconRow[]) || []);
                        }}
                      />
                      <FranchiseCvcPanel
                        key={franchise.id}
                        franchiseId={franchise.id}
                        franchiseLabel={franchise.team_name || franchise.full_name || ""}
                        squad={squad}
                        rows={franchiseCvcRows}
                        franchiseIconPlayerId={franchiseIconRows.find((r) => r.team_id === franchise.id)?.player_id}
                        canEdit={canEdit}
                        onSaved={async () => {
                          const { data } = await supabase.from("franchise_cvc_selections").select("*");
                          setFranchiseCvcRows((data as FranchiseCvcRow[]) || []);
                        }}
                      />
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
                    <>
                    <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:hidden">
                      Swipe sideways to see all game columns (G1–G17).
                    </p>
                    <div className="min-w-0 w-full overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
                      <table className="w-full min-w-[1200px] text-left">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="bg-slate-50 px-3 py-4 text-[10px] font-black uppercase text-slate-400 sm:px-8 sm:py-5 static z-auto sm:sticky sm:left-0 sm:z-10 sm:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]">Squad Player</th>
                            {[...Array(SHEET_GAME_SLOTS)].map((_, i) => (
                              <th key={i} className="px-1.5 py-4 text-center text-[10px] font-black text-slate-400 sm:px-3 sm:py-5">G{i + 1}</th>
                            ))}
                            <th className="bg-slate-50 px-3 py-4 text-right text-[10px] font-black text-slate-900 sm:px-8 sm:py-5 static z-auto sm:sticky sm:right-0 sm:z-10 sm:shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)]">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((p) => {
                            const teamStyle = getIplTeamStyle(p.team);
                            const total = Array.from({ length: SHEET_GAME_SLOTS }, (_, idx) =>
                              Number(getFranchiseSheetPoints(p.id, p.team, idx + 1, franchise.id)) || 0
                            ).reduce((a, b) => a + b, 0);

                            return (
                              <tr key={p.id} className={cn("border-b border-slate-200/80 transition-colors", teamStyle.bg)}>
                                <td
                                  className={cn(
                                    "border-l-4 px-3 py-3 sm:px-8 sm:py-4 static z-auto sm:sticky sm:left-0 sm:z-10 max-sm:shadow-none sm:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)]",
                                    teamStyle.bg,
                                    teamStyle.border
                                  )}
                                >
                                  <div className="flex items-center gap-2 sm:gap-4">
                                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-white/60 overflow-hidden shrink-0 border border-white/80 italic flex items-center justify-center">
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
                                {Array.from({ length: SHEET_GAME_SLOTS }, (_, i) => {
                                  const short = resolvePlayerTeamToShort(p.team);
                                  const leagueMn =
                                    short != null ? teamSchedules.get(short)?.[i] : undefined;
                                  const mObj =
                                    leagueMn != null ? matchByNo.get(leagueMn) : undefined;
                                  const slot = i + 1;
                                  const isDirty =
                                    mObj && pendingEdits[`${p.id}_${mObj.id}`] !== undefined;
                                  const cell = resolveSheetCell(p.id, mObj);

                                  if (cell.kind === "no_match" || cell.kind === "upcoming") {
                                    return (
                                      <td
                                        key={i}
                                        className={cn(
                                          "px-1.5 py-3 text-center text-[10px] font-black tabular-nums text-slate-400 sm:px-3 sm:py-4",
                                          teamStyle.bg
                                        )}
                                      >
                                        0
                                      </td>
                                    );
                                  }

                                  if (cell.kind === "no_data") {
                                    if (!canEdit) {
                                      return (
                                        <td
                                          key={i}
                                          className={cn(
                                            "px-1.5 py-3 text-center text-[10px] text-slate-400 sm:px-3 sm:py-4",
                                            teamStyle.bg
                                          )}
                                          title="No points yet — run Sync or enter manually"
                                        >
                                          —
                                        </td>
                                      );
                                    }
                                    return (
                                      <td key={i} className={cn("px-1.5 py-3 text-center sm:px-3 sm:py-4", teamStyle.bg)}>
                                        <div className="flex flex-col items-center gap-0.5">
                                          <Input
                                            type="number"
                                            step="0.5"
                                            value=""
                                            onChange={(e) => {
                                              if (!canEdit) return;
                                              updateSeasonPoint(p.id, slot, e.target.value);
                                            }}
                                            className={cn(
                                              "h-8 w-11 sm:w-14 mx-auto text-[10px] font-black text-center border-none rounded-lg",
                                              isDirty
                                                ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                                                : "bg-white/70 text-slate-900"
                                            )}
                                            placeholder="0"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => setSeasonMatchPoints(p.id, slot, null)}
                                            className="text-[8px] font-black uppercase text-slate-500 hover:text-slate-700 touch-manipulation"
                                            title="Save as did not play (NULL points)"
                                          >
                                            Mark DNP
                                          </button>
                                        </div>
                                      </td>
                                    );
                                  }

                                  if (cell.kind === "dnp") {
                                    return (
                                      <td
                                        key={i}
                                        className={cn("px-1 py-2 align-middle sm:px-3 sm:py-4", teamStyle.bg)}
                                      >
                                        <div className="flex flex-col items-center justify-center gap-0.5 min-h-[2rem]">
                                          <span
                                            className="text-[9px] font-black uppercase tracking-tight text-slate-500 sm:text-[10px]"
                                            title="Did not play"
                                          >
                                            DNP
                                          </span>
                                          {canEdit ? (
                                            <button
                                              type="button"
                                              onClick={() => setSeasonMatchPoints(p.id, slot, 0)}
                                              className="text-[8px] font-bold uppercase text-blue-600 underline decoration-dotted touch-manipulation"
                                            >
                                              Enter pts
                                            </button>
                                          ) : null}
                                        </div>
                                      </td>
                                    );
                                  }

                                  const rawPts = cell.value;
                                  const fant = mObj ? getFranchiseFantasyMult(franchise.id, p.id, mObj) : { mult: 1, tag: null };
                                  const displayPts = Math.round(rawPts * fant.mult * 100) / 100;
                                  const ptsKey = mObj ? `${p.id}_${mObj.id}` : "";
                                  const basePts =
                                    ptsKey && !isDirty ? matchPointsBasePointsMap.get(ptsKey) : undefined;
                                  const showBaseMultHint =
                                    basePts != null &&
                                    basePts > 0 &&
                                    Math.abs(rawPts - basePts) > 0.05;
                                  const perfMult = showBaseMultHint ? rawPts / basePts : null;
                                  return (
                                    <td key={i} className={cn("px-1.5 py-3 text-center sm:px-3 sm:py-4", teamStyle.bg)}>
                                      <div className="flex flex-col items-center gap-0.5">
                                        <Input
                                          type="number"
                                          step="0.5"
                                          value={String(displayPts)}
                                          readOnly={!canEdit}
                                          onChange={(e) => {
                                            if (!canEdit) return;
                                            updateSeasonPoint(p.id, slot, e.target.value);
                                          }}
                                          className={cn(
                                            "h-8 w-11 sm:w-14 mx-auto text-[10px] font-black text-center border-none rounded-lg",
                                            isDirty
                                              ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                                              : "bg-white/70 text-slate-900",
                                            !canEdit && "cursor-not-allowed opacity-85"
                                          )}
                                          placeholder="0"
                                          title={
                                            showBaseMultHint && basePts != null
                                              ? `Base points ${basePts} × multiplier → stored ${rawPts}; franchise ×${fant.mult} → cell ${displayPts}`
                                              : fant.mult > 1
                                                ? `Stored ${rawPts} × ${fant.mult} (${fant.tag === "icon" ? "Icon" : fant.tag === "c" ? "C" : "VC"}) = ${displayPts}`
                                                : undefined
                                          }
                                        />
                                        {showBaseMultHint && perfMult != null ? (
                                          <span
                                            className="text-[7px] font-black uppercase tracking-tight text-emerald-800/90 tabular-nums"
                                            title={`Base points × performance multiplier = stored fantasy points`}
                                          >
                                            base {basePts?.toFixed(1)}×{perfMult != null && perfMult >= 10 ? perfMult.toFixed(1) : perfMult != null ? perfMult.toFixed(2) : "?"}→{rawPts}
                                          </span>
                                        ) : null}
                                        {fant.mult > 1 ? (
                                          <span
                                            className="text-[7px] font-black uppercase tracking-tight text-violet-900 tabular-nums"
                                            title="Franchise multiplier on stored fantasy points"
                                          >
                                            {rawPts}×{fant.mult}
                                            {fant.tag === "icon" ? " Icon" : fant.tag === "c" ? " C" : " VC"}={displayPts}
                                          </span>
                                        ) : null}
                                        {canEdit && mObj && isMatchPlayed(mObj) ? (
                                          <button
                                            type="button"
                                            onClick={() => setSeasonMatchPoints(p.id, slot, null)}
                                            className="text-[8px] font-black uppercase text-slate-500 hover:text-slate-700 touch-manipulation"
                                            title="Mark as did not play (NULL points)"
                                          >
                                            Mark DNP
                                          </button>
                                        ) : null}
                                      </div>
                                    </td>
                                  );
                                })}
                                <td
                                  className={cn(
                                    "px-3 py-3 sm:px-8 sm:py-4 text-right font-black italic text-sm static z-auto sm:sticky sm:right-0 sm:z-10 max-sm:shadow-none sm:shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)]",
                                    teamStyle.bg
                                  )}
                                >
                                  {String(total % 1 === 0 ? total : total.toFixed(1))}
                                </td>
                              </tr>
                            );
                          })}
                          {(() => {
                            const teamGameTotals = Array(SHEET_GAME_SLOTS).fill(0);
                            squad.forEach((sp) => {
                              for (let i = 1; i <= SHEET_GAME_SLOTS; i++) {
                                teamGameTotals[i - 1] += getFranchiseSheetPoints(
                                  sp.id,
                                  sp.team,
                                  i,
                                  franchise.id
                                );
                              }
                            });
                            const teamGrandTotal = teamGameTotals.reduce((a, b) => a + b, 0);
                            return (
                              <tr className="bg-slate-900 text-white">
                                <td className="bg-slate-900 px-3 py-4 sm:px-8 sm:py-5 static z-auto font-black uppercase tracking-widest text-[10px] sm:sticky sm:left-0 sm:z-10 max-sm:shadow-none sm:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.3)]">
                                  Grand Total
                                </td>
                                {teamGameTotals.map((v, idx) => (
                                  <td key={idx} className="px-1.5 py-4 text-center text-[10px] font-black tabular-nums sm:px-3 sm:py-5">
                                    {v ? (v % 1 === 0 ? v : v.toFixed(1)) : ""}
                                  </td>
                                ))}
                                <td className="bg-slate-900 px-3 py-4 text-right font-black italic text-sm static z-auto sm:sticky sm:right-0 sm:z-10 sm:px-8 sm:py-5 max-sm:shadow-none sm:shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.3)]">
                                  {teamGrandTotal % 1 === 0 ? teamGrandTotal : teamGrandTotal.toFixed(1)}
                                </td>
                              </tr>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                    </>
                    )}
                  </div>
                );
              })()
              )}
           </div>
        )}

      </div>

      {activeTab === "sheets" && profile?.id && sheetFranchiseId === profile.id && Object.keys(pendingEdits).length > 0 && (
         <div className="fixed z-50 bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] max-w-[calc(100vw-2rem)]">
           <Button onClick={handleBulkSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6 py-6 sm:px-8 sm:py-7 shadow-2xl flex gap-2 sm:gap-3 items-center font-black uppercase text-[10px] sm:text-xs w-full sm:w-auto justify-center">{saving ? <Loader2 className="animate-spin" /> : <Save />} Save ({Object.keys(pendingEdits).length})</Button>
         </div>
      )}
    </div>
  );
}
