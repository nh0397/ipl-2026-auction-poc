"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import {
  BarChart as BarChartRecharts,
  LineChart as LineChartRecharts,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  DISABLE_SHEET_AUTOCOMPUTE_ON_MANUAL_OVERRIDE,
  SHOW_CRICAPI_FIXTURE_UI,
  SHEET_MATCH_POINTS_TABLE,
} from "@/lib/featureFlags";
import { MATCH_POINTS_CRICAPI_TABLE, MATCH_POINTS_ESPN_TABLE } from "@/lib/matchPointsTables";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import React from "react";
import { toast } from "sonner";
import ScorecardViewer from "@/components/scoreboard/ScorecardViewer";
import { adaptCricApiToScorecardViewer } from "@/lib/adapters/cricapiScorecard";
import {
  computeEspnPjBreakdownRows,
  type PlayerCatalogRow,
} from "@/lib/espnPjBreakdownFromScorecard";
import { aggregateFantasyRowsFromCricApiMatchData } from "@/lib/cricapiFantasyAggregate";
import { FantasyPjBreakdownPanel } from "@/components/fantasy/FantasyPjBreakdownPanel";
import { PersistedFantasyMatchTable } from "@/components/fantasy/PersistedFantasyMatchTable";
import { buildPersistedFantasyRowsForMatch, type PersistedFantasyRow } from "@/lib/persistedFantasyRowsFromMatchPoints";
import { FranchiseBoosterPanel } from "@/components/scoreboard/FranchiseBoosterPanel";
import { FranchiseCvcPanel } from "@/components/scoreboard/FranchiseCvcPanel";
import { FranchiseIconPanel } from "@/components/scoreboard/FranchiseIconPanel";
import {
  activeCvcForMatchDate,
  franchiseMatchSheetDisplay,
  matchDateKeyIST,
  storedPointsFromFranchiseSheetDisplay,
  type FranchiseBoosterRow,
  type FranchiseCvcRow,
  type FranchiseIconRow,
  type FranchiseMatchSheetBreakdown,
} from "@/lib/franchiseCvc";
import { MOM_BONUS_DEFAULT, syntheticStoredAfterHaulWithMom } from "@/lib/matchMomBonus";
import { formatPoints2, toPoints2 } from "@/lib/pointsPrecision";

/** Recharts Tooltip value can be number, string, or array; normalize to 2-decimal display. */
function formatRechartsTooltipPoints(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return formatPoints2(Number(raw ?? 0));
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

/** Same label as fixture cards — team filter options and matching. */
function teamDisplayLabel(f: Fixture, side: 1 | 2): string {
  const short = side === 1 ? f.team1_short : f.team2_short;
  const name = side === 1 ? f.team1_name : f.team2_name;
  return (cleanShort(short) || name || "").trim();
}

function isFixtureResult(f: Fixture, today: string): boolean {
  return f.match_ended || f.match_date < today;
}

/** Results tab: latest finish first (`date_time_gmt`; fallback `match_date`). */
function compareCompletedFixturesByDateTimeDesc(a: Fixture, b: Fixture): number {
  const ta = Date.parse(a.date_time_gmt || "");
  const tb = Date.parse(b.date_time_gmt || "");
  if (Number.isFinite(tb) && Number.isFinite(ta)) return tb - ta;
  if (Number.isFinite(tb)) return 1;
  if (Number.isFinite(ta)) return -1;
  return String(b.match_date || "").localeCompare(String(a.match_date || ""));
}

/** Join key to `public.fixtures` (ESPN) — only the stored `match_no` column, never parsed from titles. */
function espnMatchNo(f: { match_no?: number | null }): number | null {
  const n = Number(f?.match_no);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normFantasyLookupKeyPart(s: string | null | undefined) {
  return String(s ?? "")
    .replace(/†/g, "")
    .replace(/\(c\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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

function cleanRoleLabel(role: string | null | undefined): string {
  const s = String(role ?? "").trim();
  return s ? s : "Unknown";
}

function fmtHaulTier(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Parse after the user leaves the cell; `undefined` = do not write (empty / invalid). */
function parseSheetPointsBlur(raw: string): number | undefined {
  const t = raw.trim().replace(/,/g, "");
  if (t === "" || t === "." || t === "-" || t === "-.") return undefined;
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

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
  /** `${playerId}_${matchId}` — while focused, edits are draft-only so `formatPoints2` does not fight the caret. */
  const [sheetCellFocusKey, setSheetCellFocusKey] = useState<string | null>(null);
  const [sheetCellDraft, setSheetCellDraft] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"sheets" | "standings" | "fixtures">("sheets");
  const [analyticsTeamId, setAnalyticsTeamId] = useState<string | null>(null);
  const [standings, setStandings] = useState<any[]>([]);
  const [allMatchPoints, setAllMatchPoints] = useState<any[]>([]);
  const [matchPointsSource, setMatchPointsSource] = useState<"espn" | "cricapi" | null>(null);
  const sheetMatchPointsTable =
    matchPointsSource === "cricapi"
      ? MATCH_POINTS_CRICAPI_TABLE
      : matchPointsSource === "espn"
        ? MATCH_POINTS_ESPN_TABLE
        : SHEET_MATCH_POINTS_TABLE;
  const [franchiseCvcRows, setFranchiseCvcRows] = useState<FranchiseCvcRow[]>([]);
  const [franchiseIconRows, setFranchiseIconRows] = useState<FranchiseIconRow[]>([]);
  const [franchiseBoosterRows, setFranchiseBoosterRows] = useState<FranchiseBoosterRow[]>([]);
  /** Admin-selected MoM per match — bonus added to PJ base before haul on sheets (not in match_points). */
  const [momRows, setMomRows] = useState<{ match_id: string; player_id: string; bonus_points: number }[]>([]);
  /** Fixtures tab: ESPN / CricAPI modal (scorecard + fantasy tabs). */
  const [fixtureModal, setFixtureModal] = useState<{ source: "espn" | "cricapi"; fixture: Fixture } | null>(null);
  const [fixtureModalTab, setFixtureModalTab] = useState<"scorecard" | "fantasy">("scorecard");
  const [modalFixtureFresh, setModalFixtureFresh] = useState<Fixture | null>(null);
  const [modalRefreshing, setModalRefreshing] = useState(false);
  const [expandedPersistedFantasyPlayerId, setExpandedPersistedFantasyPlayerId] = useState<string | null>(null);
  const [fixtureModalPersistedRows, setFixtureModalPersistedRows] = useState<PersistedFantasyRow[]>([]);
  const [fixtureModalPersistedLoading, setFixtureModalPersistedLoading] = useState(false);
  const [syncingPoints, setSyncingPoints] = useState(false); // legacy combined sync (kept for now)
  const [syncingEspn, setSyncingEspn] = useState(false);
  const [syncingCricapi, setSyncingCricapi] = useState(false);
  const [workflowDateIst, setWorkflowDateIst] = useState<string>(getTodayIST());
  const [triggeringWorkflow, setTriggeringWorkflow] = useState(false);
  const [workflowRuns, setWorkflowRuns] = useState<
    Array<{ conclusion: string | null; status: string; htmlUrl: string; createdAt: string; updatedAt: string; event: string; actor: string | null; runNumber: number }> | null
  >(null);
  const [workflowTriggerAudit, setWorkflowTriggerAudit] = useState<
    Array<{ app_user_email: string | null; github_run_number: number | null; created_at: string }> | null
  >(null);
  const [latestRunJobs, setLatestRunJobs] = useState<
    Array<{ name: string; status: string; conclusion: string | null; steps: Array<{ number: number; name: string; status: string; conclusion: string | null }> }>
  >([]);
  const [refreshingRunStatus, setRefreshingRunStatus] = useState(false);
  const [runStatusMessage, setRunStatusMessage] = useState<string>("");

  const [espnScorecardByMatchNo, setEspnScorecardByMatchNo] = useState<Record<number, any | null>>({});
  const [espnScorecardLoadingByMatchNo, setEspnScorecardLoadingByMatchNo] = useState<Record<number, boolean>>({});
  /** `public.fixtures.points_synced` keyed by `match_no` — sole source for “synced”; not `fixtures_cricapi` or `match_ended`. */
  const [fixturePointsSyncedByMatchNo, setFixturePointsSyncedByMatchNo] = useState<Record<number, boolean>>({});

  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  /** Fixtures sub-tab: scheduled vs finished (aligned with /fixtures page). */
  const [fixtureListView, setFixtureListView] = useState<"scheduled" | "results">("results");
  const [fixtureTeamFilter, setFixtureTeamFilter] = useState<string | null>(null);

  const [subLoading, setSubLoading] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  /** Which auction franchise’s score sheet is shown (sub-tabs under Sheets). */
  const [sheetFranchiseId, setSheetFranchiseId] = useState<string | null>(null);
  const [auctionConfigId, setAuctionConfigId] = useState<string | null>(null);

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
    setExpandedPersistedFantasyPlayerId(null);
    setFixtureModalPersistedRows([]);
    setFixtureModalPersistedLoading(false);
  }, []);

  const cricapiModalData = fixtureModal?.source === "cricapi" ? modalFixtureFresh ?? fixtureModal.fixture : null;
  const cricapiViewer = useMemo(() => {
    const raw = cricapiModalData?.scorecard;
    if (!raw) return null;
    return adaptCricApiToScorecardViewer(raw);
  }, [cricapiModalData?.scorecard]);

  const espnModalMn = fixtureModal?.source === "espn" ? espnMatchNo(fixtureModal.fixture) : null;
  const espnModalScore = espnModalMn != null ? espnScorecardByMatchNo[espnModalMn] : undefined;
  const espnModalLoading = espnModalMn != null ? !!espnScorecardLoadingByMatchNo[espnModalMn] : false;

  const today = useMemo(() => getTodayIST(), []);

  const matchByNo = useMemo(() => {
    const map = new Map<number, any>();
    (allMatches || []).forEach((m) => {
      const n = Number(m?.match_no);
      if (Number.isFinite(n)) map.set(n, m);
    });
    return map;
  }, [allMatches]);

  const fixtureModalMatchNo = fixtureModal ? espnMatchNo(fixtureModal.fixture) : null;
  const fixtureModalLeagueMatchId =
    fixtureModalMatchNo != null ? (matchByNo.get(fixtureModalMatchNo)?.id as string | undefined) : undefined;

  useEffect(() => {
    if (!fixtureModal || !fixtureModalLeagueMatchId) {
      setFixtureModalPersistedRows([]);
      setFixtureModalPersistedLoading(false);
      return;
    }
    const matchId = fixtureModalLeagueMatchId;
    let cancelled = false;
    setFixtureModalPersistedLoading(true);
    (async () => {
      const { data: pts, error } = await supabase.from(sheetMatchPointsTable).select("*").eq("match_id", matchId);
      if (cancelled) return;
      if (error) {
        console.error("[fixture modal] persisted fantasy fetch", error);
        setFixtureModalPersistedRows([]);
        setFixtureModalPersistedLoading(false);
        return;
      }
      if (!pts?.length) {
        setFixtureModalPersistedRows([]);
        setFixtureModalPersistedLoading(false);
        return;
      }
      const ids = [...new Set(pts.map((p: { player_id?: string }) => p.player_id).filter(Boolean))] as string[];
      const { data: pls, error: pErr } = await supabase.from("players").select("id, player_name, team").in("id", ids);
      if (cancelled) return;
      if (pErr) {
        console.error("[fixture modal] players fetch", pErr);
        setFixtureModalPersistedRows([]);
        setFixtureModalPersistedLoading(false);
        return;
      }
      setFixtureModalPersistedRows(buildPersistedFantasyRowsForMatch(matchId, pts, pls || []));
      setFixtureModalPersistedLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fixtureModal, fixtureModalLeagueMatchId, sheetMatchPointsTable]);

  const fixtureModalCricapiFantasyById = useMemo(() => {
    if (fixtureModal?.source !== "cricapi") return new Map<string, ReturnType<typeof aggregateFantasyRowsFromCricApiMatchData>[number]>();
    const raw = cricapiModalData?.scorecard as Record<string, unknown> | null | undefined;
    if (!raw) return new Map();
    const rows = aggregateFantasyRowsFromCricApiMatchData(raw);
    return new Map(rows.map((r) => [r.player_id, r] as const));
  }, [fixtureModal?.source, cricapiModalData?.scorecard]);

  const fixtureModalEspnFantasyByNameTeam = useMemo(() => {
    if (fixtureModal?.source !== "espn" || !espnModalScore?.innings?.length || !fixtureModal) {
      return new Map<string, ReturnType<typeof computeEspnPjBreakdownRows>[number]>();
    }
    const rows = computeEspnPjBreakdownRows(espnModalScore, fixtureModal.fixture, playersCatalog);
    const m = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      m.set(`${normFantasyLookupKeyPart(r.n)}_${normFantasyLookupKeyPart(r.team)}`, r);
    }
    return m;
  }, [fixtureModal, espnModalScore, playersCatalog]);

  const renderFixtureModalScorecardDetail = useCallback(
    (row: PersistedFantasyRow): React.ReactNode => {
      if (!fixtureModal) return null;
      if (fixtureModal.source === "cricapi") {
        const d = fixtureModalCricapiFantasyById.get(row.player_id);
        if (!d?.breakdown || !d.scoring) return null;
        return (
          <>
            <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Rule-by-rule (from scorecard)</div>
            <FantasyPjBreakdownPanel
              breakdown={d.breakdown}
              scoring={d.scoring}
              d11={d.d11}
              baseTotalLabel="Base from scorecard rules"
            />
          </>
        );
      }
      const k = `${normFantasyLookupKeyPart(row.player_name)}_${normFantasyLookupKeyPart(row.team)}`;
      const e = fixtureModalEspnFantasyByNameTeam.get(k);
      if (!e?.pjDetail || !e.pjScoring) return null;
      return (
        <>
          <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Rule-by-rule (from scorecard)</div>
          <FantasyPjBreakdownPanel
            breakdown={e.pjDetail}
            scoring={e.pjScoring}
            d11={e.d11}
            baseTotalLabel="Base from scorecard rules"
          />
        </>
      );
    },
    [fixtureModal, fixtureModalCricapiFantasyById, fixtureModalEspnFantasyByNameTeam]
  );

  const teamSchedules = useMemo(() => buildTeamSchedules(iplScheduleRows), [iplScheduleRows]);

  const momByMatchId = useMemo(() => {
    const m = new Map<string, { player_id: string; bonus_points: number }>();
    for (const r of momRows) {
      m.set(r.match_id, {
        player_id: r.player_id,
        bonus_points: Number(r.bonus_points) || MOM_BONUS_DEFAULT,
      });
    }
    return m;
  }, [momRows]);

  /**
   * Stored sheet table (`SHEET_MATCH_POINTS_TABLE`).points: NULL = DNP, number = score (0 = played, zero points).
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

  /** Keys that should bypass sheet auto-compute (manual override). */
  const manualOverrideKeySet = useMemo(() => {
    const s = new Set<string>();
    (allMatchPoints || []).forEach((pt: any) => {
      if (!pt?.player_id || !pt?.match_id) return;
      if (pt.manual_override === true) s.add(`${pt.player_id}_${pt.match_id}`);
    });
    Object.values(pendingEdits || {}).forEach((ed: any) => {
      if (!ed?.player_id || !ed?.match_id) return;
      // pending edits are always manual_override: true
      s.add(`${ed.player_id}_${ed.match_id}`);
    });
    return s;
  }, [allMatchPoints, pendingEdits]);

  /**
   * Per row in the sheet table: PJ base (before haul), and haul tiers (batting runs / bowling wickets / max).
   * Not merged from pending edits — still shown while a cell is dirty so the haul line stays visible.
   */
  const matchPointsDetailByKey = useMemo(() => {
    const map = new Map<
      string,
      { base: number | null; haulRun: number | null; haulWick: number | null; haulApp: number | null }
    >();
    (allMatchPoints || []).forEach((pt: any) => {
      if (!pt?.player_id || !pt?.match_id) return;
      const key = `${pt.player_id}_${pt.match_id}`;
      const bp = pt.base_points;
      const base = bp === null || bp === undefined ? null : Number(bp);
      const hr = pt.haul_run_mult;
      const hw = pt.haul_wicket_mult;
      const ha = pt.haul_applied_mult;
      map.set(key, {
        base: Number.isFinite(base as number) ? (base as number) : null,
        haulRun: hr === null || hr === undefined ? null : Number(hr),
        haulWick: hw === null || hw === undefined ? null : Number(hw),
        haulApp: ha === null || ha === undefined ? null : Number(ha),
      });
    });
    return map;
  }, [allMatchPoints]);

  /** Sheet total: booster day → base × 3 (or × 6 franchise Icon); else stored × Icon / C / VC. */
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
      if (DISABLE_SHEET_AUTOCOMPUTE_ON_MANUAL_OVERRIDE && manualOverrideKeySet.has(key)) {
        return raw;
      }
      const d = matchDateKeyIST(m.date_time);
      const iconId = franchiseIconRows.find((r) => r.team_id === franchiseId)?.player_id ?? null;
      const active = activeCvcForMatchDate(franchiseCvcRows, franchiseId, d);
      const det = matchPointsDetailByKey.get(key);
      const basePts = det?.base ?? undefined;
      const haulApp = det?.haulApp ?? null;
      const momRow = momByMatchId.get(m.id);
      const momBonus =
        momRow && momRow.player_id === playerId
          ? Number(momRow.bonus_points) || MOM_BONUS_DEFAULT
          : 0;
      return franchiseMatchSheetDisplay({
        storedPoints: raw,
        basePoints: basePts,
        franchiseId,
        playerId,
        franchiseIconPlayerId: iconId,
        matchDateKeyIST: d,
        boosterRows: franchiseBoosterRows,
        activeCvc: active,
        momBonusPoints: momBonus,
        haulAppliedMult: haulApp,
      }).display;
    },
    [
      teamSchedules,
      matchByNo,
      matchPointsCellMap,
      matchPointsDetailByKey,
      manualOverrideKeySet,
      franchiseCvcRows,
      franchiseIconRows,
      franchiseBoosterRows,
      momByMatchId,
    ]
  );

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
    setSheetCellFocusKey(null);
    setSheetCellDraft({});
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
      const [teamsRes, matchesRes, scheduleRes, playersCatRes, cvcRes, iconRes, boosterRes, momRes] = await Promise.all([
        supabase.from("profiles").select("*").neq("role", "Viewer").order("team_name", { ascending: true }),
        supabase.from("matches").select("*").order("match_no", { ascending: true }),
        supabase
          .from("fixtures_cricapi")
          .select("match_no,team1_short,team2_short,date_time_gmt")
          .order("date_time_gmt", { ascending: true }),
        supabase
          .from("players")
          .select("player_name, team, type, role, auction_status")
          .eq("auction_status", "sold")
          .order("player_name", { ascending: true }),
        supabase.from("franchise_cvc_selections").select("*"),
        supabase.from("franchise_icon_selection").select("*"),
        supabase.from("franchise_booster_days").select("*"),
        supabase.from("match_man_of_the_match").select("match_id, player_id, bonus_points"),
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
      if (boosterRes.data) setFranchiseBoosterRows(boosterRes.data as FranchiseBoosterRow[]);
      if (momRes.data) setMomRows(momRes.data as { match_id: string; player_id: string; bonus_points: number }[]);
    } finally { setTimeout(() => setLoading(false), 300); }
  };

  /** All auction franchises’ squads + persisted match points (sheets tab). */
  const fetchSheetsData = async () => {
    setSubLoading(true);
    try {
      const [playersRes, pointsRes, schedRes, cvcRes, iconRes, boosterRes, cfgRes, momRes] = await Promise.all([
        supabase.from("players").select("*").eq("auction_status", "sold").order("player_name", { ascending: true }),
        supabase.from(sheetMatchPointsTable).select("*"),
        supabase
          .from("fixtures_cricapi")
          .select("match_no,team1_short,team2_short,date_time_gmt")
          .order("date_time_gmt", { ascending: true }),
        supabase.from("franchise_cvc_selections").select("*"),
        supabase.from("franchise_icon_selection").select("*"),
        supabase.from("franchise_booster_days").select("*"),
        supabase.from("auction_config").select("id,match_points_source").limit(1).maybeSingle(),
        supabase.from("match_man_of_the_match").select("match_id, player_id, bonus_points"),
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
      if (boosterRes.data) setFranchiseBoosterRows(boosterRes.data as FranchiseBoosterRow[]);
      const src = String((cfgRes.data as any)?.match_points_source ?? "").toLowerCase();
      if (src === "espn" || src === "cricapi") {
        setMatchPointsSource(src as any);
        const desiredTable = src === "cricapi" ? MATCH_POINTS_CRICAPI_TABLE : MATCH_POINTS_ESPN_TABLE;
        if (desiredTable !== sheetMatchPointsTable) {
          const { data: refetched } = await supabase.from(desiredTable).select("*");
          setAllMatchPoints(refetched || []);
        }
      }
      const cid = (cfgRes.data as any)?.id;
      if (typeof cid === "string" && cid) setAuctionConfigId(cid);
      if (momRes.data) setMomRows(momRes.data as { match_id: string; player_id: string; bonus_points: number }[]);
    } finally {
      setSubLoading(false);
    }
  };

  const fetchStandingsData = async () => {
    setTabLoading(true);
    try {
      // Must include `team` (IPL side) or G-column mapping and charts read 0 for every cell.
      const [{ data: soldPlayers }, { data: pts }, { data: schedRes }, { data: cvcRows }, { data: iconRows }, { data: boosterRows }, { data: cfgRes }, { data: momData }] =
        await Promise.all([
        supabase.from("players").select("*").eq("auction_status", "sold").order("player_name", { ascending: true }),
        supabase.from(sheetMatchPointsTable).select("*"),
        supabase
          .from("fixtures_cricapi")
          .select("match_no,team1_short,team2_short,date_time_gmt")
          .order("date_time_gmt", { ascending: true }),
        supabase.from("franchise_cvc_selections").select("*"),
        supabase.from("franchise_icon_selection").select("*"),
        supabase.from("franchise_booster_days").select("*"),
        supabase.from("auction_config").select("id,match_points_source").limit(1).maybeSingle(),
        supabase.from("match_man_of_the_match").select("match_id, player_id, bonus_points"),
      ]);
      setAllPlayers(soldPlayers || []);
      setAllMatchPoints(pts || []);
      if (schedRes?.length) setIplScheduleRows(schedRes as IplScheduleRow[]);
      if (cvcRows) setFranchiseCvcRows(cvcRows as FranchiseCvcRow[]);
      if (iconRows) setFranchiseIconRows(iconRows as FranchiseIconRow[]);
      if (boosterRows) setFranchiseBoosterRows(boosterRows as FranchiseBoosterRow[]);
      const src = String((cfgRes as any)?.match_points_source ?? "").toLowerCase();
      if (src === "espn" || src === "cricapi") {
        setMatchPointsSource(src as any);
        const desiredTable = src === "cricapi" ? MATCH_POINTS_CRICAPI_TABLE : MATCH_POINTS_ESPN_TABLE;
        if (desiredTable !== sheetMatchPointsTable) {
          const { data: refetched } = await supabase.from(desiredTable).select("*");
          setAllMatchPoints(refetched || []);
        }
      }
      const cid = (cfgRes as any)?.id;
      if (typeof cid === "string" && cid) setAuctionConfigId(cid);
      if (momData) setMomRows(momData as { match_id: string; player_id: string; bonus_points: number }[]);
    } finally {
      setTabLoading(false);
    }
  };

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
      const detailMap = new Map<string, { stored: number | null; base: number | null; haulApp: number | null }>();
      (points || []).forEach((pt: any) => {
        if (!pt?.player_id || !pt?.match_id) return;
        const key = `${pt.player_id}_${pt.match_id}`;
        const raw = pt.points;
        const stored = raw === null || raw === undefined ? null : Number(raw) || 0;
        const bp = pt.base_points;
        const base = bp === null || bp === undefined ? null : Number(bp);
        const ha = pt.haul_applied_mult;
        const haulApp = ha === null || ha === undefined ? null : Number(ha);
        detailMap.set(key, { stored, base, haulApp });
      });
      Object.values(pendingEdits || {}).forEach((ed: any) => {
        if (!ed?.player_id || !ed?.match_id) return;
        const key = `${ed.player_id}_${ed.match_id}`;
        const raw = ed.points;
        const stored = raw === null || raw === undefined ? null : Number(raw) || 0;
        const existing = detailMap.get(key);
        detailMap.set(key, { stored, base: existing?.base ?? null, haulApp: existing?.haulApp ?? null });
      });

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
            if (!detailMap.has(key)) return;
            matchHasPoints = true;
            const det = detailMap.get(key)!;
            if (det.stored === null) return;
            const raw = det.stored;
            const iconId = franchiseIconRows.find((r) => r.team_id === team.id)?.player_id ?? null;
            const d = matchDateKeyIST(m.date_time);
            const active = activeCvcForMatchDate(franchiseCvcRows, team.id, d);
            const momRec = momByMatchId.get(m.id);
            const momBonus =
              momRec && momRec.player_id === player.id
                ? Number(momRec.bonus_points) || MOM_BONUS_DEFAULT
                : 0;
            const { display } = franchiseMatchSheetDisplay({
              storedPoints: raw,
              basePoints: det.base,
              franchiseId: team.id,
              playerId: player.id,
              franchiseIconPlayerId: iconId,
              matchDateKeyIST: d,
              boosterRows: franchiseBoosterRows,
              activeCvc: active,
              momBonusPoints: momBonus,
              haulAppliedMult: det.haulApp,
            });
            matchTotal += display;
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
          avgPerMatch: matchesPlayed > 0 ? toPoints2(totalPoints / matchesPlayed) : 0,
          squadSize: teamPlayers.length,
        };
      }).sort((a, b) => b.totalPoints - a.totalPoints);
      setStandings(standingsData);
    },
    [
      franchises,
      allMatches,
      playerBelongsToTeam,
      franchiseCvcRows,
      franchiseIconRows,
      franchiseBoosterRows,
      pendingEdits,
      momByMatchId,
    ]
  );

  useEffect(() => {
    if (activeTab !== "standings") return;
    if (!franchises.length || !allMatches.length) return;
    calculateStandings(allPlayers, allMatchPoints);
  }, [
    activeTab,
    allMatchPoints,
    allPlayers,
    allMatches,
    franchises,
    calculateStandings,
    franchiseCvcRows,
    franchiseIconRows,
    franchiseBoosterRows,
    pendingEdits,
    momByMatchId,
  ]);

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
    if (DISABLE_SHEET_AUTOCOMPUTE_ON_MANUAL_OVERRIDE) {
      setSeasonMatchPoints(pId, teamGameSlot, toPoints2(displayPts));
      return;
    }
    const fr = franchises.find((f) => f.id === sheetFranchiseId);
    const player = allPlayers.find((p) => p.id === pId);
    if (!fr || !player) return;
    const short = resolvePlayerTeamToShort(player.team);
    const leagueMn = short ? teamSchedules.get(short)?.[teamGameSlot - 1] : undefined;
    const match = leagueMn != null ? allMatches.find((m) => m.match_no === leagueMn) : undefined;
    if (!match?.date_time) return;
    const key = `${pId}_${match.id}`;
    const pe = pendingEdits[key];
    let storedPoints = 0;
    if (pe && pe.points !== undefined) {
      if (pe.points === null) return;
      storedPoints = Number(pe.points) || 0;
    } else {
      const v = matchPointsCellMap.get(key);
      if (v === null) return;
      storedPoints = v === undefined ? 0 : Number(v) || 0;
    }
    const det = matchPointsDetailByKey.get(key);
    const basePoints = det?.base ?? undefined;
    const haulApp = det?.haulApp ?? null;
    const d = matchDateKeyIST(match.date_time);
    const iconId = franchiseIconRows.find((r) => r.team_id === fr.id)?.player_id ?? null;
    const active = activeCvcForMatchDate(franchiseCvcRows, fr.id, d);
    const momRec = momByMatchId.get(match.id);
    const momBonus =
      momRec && momRec.player_id === pId ? Number(momRec.bonus_points) || MOM_BONUS_DEFAULT : 0;
    const raw = storedPointsFromFranchiseSheetDisplay({
      displayPts,
      storedPoints,
      basePoints,
      franchiseId: fr.id,
      playerId: pId,
      franchiseIconPlayerId: iconId,
      matchDateKeyIST: d,
      boosterRows: franchiseBoosterRows,
      activeCvc: active,
      momBonusPoints: momBonus,
      haulAppliedMult: haulApp,
    });
    setSeasonMatchPoints(pId, teamGameSlot, raw);
  };

  const persistMatchMom = async (matchId: string, playerId: string, checked: boolean) => {
    if (profile?.role !== "Admin") return;
    const cur = momByMatchId.get(matchId);
    if (checked) {
      const { error } = await supabase.from("match_man_of_the_match").upsert(
        {
          match_id: matchId,
          player_id: playerId,
          bonus_points: MOM_BONUS_DEFAULT,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "match_id" }
      );
      if (error) {
        toast.error(error.message);
        return;
      }
      setMomRows((prev) => {
        const rest = prev.filter((r) => r.match_id !== matchId);
        return [...rest, { match_id: matchId, player_id: playerId, bonus_points: MOM_BONUS_DEFAULT }];
      });
      toast.success("Man of the Match saved (+50 base before haul)");
    } else {
      if (cur?.player_id !== playerId) return;
      const { error } = await supabase.from("match_man_of_the_match").delete().eq("match_id", matchId);
      if (error) {
        toast.error(error.message);
        return;
      }
      setMomRows((prev) => prev.filter((r) => r.match_id !== matchId));
      toast.success("MoM cleared");
    }
  };

  const handleSyncMatchPoints = async () => {
    setSyncingPoints(true);
    try {
      const res = await fetch("/api/match-points/sync", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof json?.error === "string" ? json.error : `Sync failed (${res.status})`);
        return;
      }
      const { data: pts } = await supabase.from(sheetMatchPointsTable).select("*");
      setAllMatchPoints(pts || []);
      const skipM = json.rowsSkippedManual ?? 0;
      const skipU = json.rowsSkippedUnmapped ?? 0;
      const sample = Array.isArray(json.unmappedNameSample) ? json.unmappedNameSample : [];
      const espnU = typeof json.espn?.rowsUpserted === "number" ? json.espn.rowsUpserted : null;
      const crU = typeof json.cricapi?.rowsUpserted === "number" ? json.cricapi.rowsUpserted : null;
      const sourceHint =
        espnU != null && crU != null && (espnU > 0 || crU > 0)
          ? crU === 0
            ? ` (${espnU} from ESPN scorecards)`
            : espnU === 0
              ? ` (${crU} from CricAPI scorecards)`
              : ` (${espnU} ESPN, ${crU} CricAPI)`
          : "";
      const title = `Synced: ${json.rowsUpserted ?? 0} row(s) from ${json.fixturesProcessed ?? 0} fixture(s).${sourceHint}`;
      const detailParts: string[] = [];
      if (skipM) detailParts.push(`Skipped ${skipM} manual row(s).`);
      if (skipU) {
        detailParts.push(
          `No DB player for ${skipU} scorecard name(s) (matched by player name).` +
            (sample.length ? ` Examples: ${sample.slice(0, 8).join(", ")}` : "")
        );
      }
      const errNotes = Array.isArray(json.errors) && json.errors.length ? json.errors.slice(0, 5).join("; ") : "";
      if (errNotes) detailParts.push(`Notes: ${errNotes}`);
      const description = detailParts.length ? detailParts.join("\n\n") : undefined;
      if (Array.isArray(json.errors) && json.errors.length) {
        toast.warning(title, { description, duration: 14_000 });
      } else {
        toast.success(title, { description, duration: description ? 12_000 : 7000 });
      }
    } finally {
      setSyncingPoints(false);
    }
  };

  const refreshSheetPointsFromSource = async () => {
    const { data: pts } = await supabase.from(sheetMatchPointsTable).select("*");
    setAllMatchPoints(pts || []);
  };

  const setSheetSource = async (src: "espn" | "cricapi") => {
    const isAdmin = profile?.role === "Admin";
    if (!isAdmin) return;
    if (!auctionConfigId) {
      toast.error("Missing auction_config row id. Refresh and try again.");
      return;
    }
    const { error } = await supabase
      .from("auction_config")
      .update({ match_points_source: src, updated_at: new Date().toISOString() })
      .eq("id", auctionConfigId);
    if (error) {
      toast.error(`Could not update sheet source: ${error.message}`);
      return;
    }
    setMatchPointsSource(src);
    toast.success(`Sheet source: ${src === "espn" ? "ESPN" : "CricAPI"}`);
    // Reload points for the newly selected table.
    // Also refresh standings if that tab is active.
    if (activeTab === "standings") await fetchStandingsData();
    if (activeTab === "sheets") await fetchSheetsData();
  };

  const handleSyncEspnOnly = async () => {
    setSyncingEspn(true);
    try {
      const res = await fetch("/api/match-points/sync/espn", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof json?.error === "string" ? json.error : `Sync failed (${res.status})`);
        return;
      }
      await refreshSheetPointsFromSource();
      const title = `ESPN synced: ${json.rowsUpserted ?? 0} row(s) from ${json.fixturesProcessed ?? 0} fixture(s).`;
      const detailParts: string[] = [];
      if (json.rowsSkippedManual) detailParts.push(`Skipped ${json.rowsSkippedManual} manual row(s).`);
      if (json.rowsSkippedUnmapped) {
        detailParts.push(
          `Unmapped ${json.rowsSkippedUnmapped} scorecard name(s).` +
            (Array.isArray(json.unmappedNameSample) && json.unmappedNameSample.length
              ? ` Examples: ${json.unmappedNameSample.slice(0, 8).join(", ")}`
              : "")
        );
      }
      if (Array.isArray(json.errors) && json.errors.length) {
        detailParts.push(`Notes: ${json.errors.slice(0, 5).join("; ")}`);
      }
      const description = detailParts.length ? detailParts.join("\n\n") : undefined;
      if (Array.isArray(json.errors) && json.errors.length) {
        toast.warning(title, { description, duration: 14_000 });
      } else {
        toast.success(title, { description, duration: description ? 12_000 : 7000 });
      }
    } finally {
      setSyncingEspn(false);
    }
  };

  const handleSyncCricapiOnly = async () => {
    setSyncingCricapi(true);
    try {
      const res = await fetch("/api/match-points/sync/cricapi", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof json?.error === "string" ? json.error : `Sync failed (${res.status})`);
        return;
      }
      await refreshSheetPointsFromSource();
      const title = `CricAPI synced: ${json.rowsUpserted ?? 0} row(s) from ${json.fixturesProcessed ?? 0} fixture(s).`;
      const detailParts: string[] = [];
      if (json.rowsSkippedManual) detailParts.push(`Skipped ${json.rowsSkippedManual} manual row(s).`);
      if (json.rowsSkippedUnmapped) {
        detailParts.push(
          `Unmapped ${json.rowsSkippedUnmapped} scorecard name(s).` +
            (Array.isArray(json.unmappedNameSample) && json.unmappedNameSample.length
              ? ` Examples: ${json.unmappedNameSample.slice(0, 8).join(", ")}`
              : "")
        );
      }
      if (Array.isArray(json.errors) && json.errors.length) {
        detailParts.push(`Notes: ${json.errors.slice(0, 5).join("; ")}`);
      }
      const description = detailParts.length ? detailParts.join("\n\n") : undefined;
      if (Array.isArray(json.errors) && json.errors.length) {
        toast.warning(title, { description, duration: 14_000 });
      } else {
        toast.success(title, { description, duration: description ? 12_000 : 7000 });
      }
    } finally {
      setSyncingCricapi(false);
    }
  };

  const refreshWorkflowRuns = useCallback(async () => {
    setRefreshingRunStatus(true);
    setRunStatusMessage("Checking latest scraper status...");
    try {
      const res = await fetch("/api/workflows/espn-scraper/runs");
      if (!res.ok) {
        setWorkflowRuns(null);
        setRunStatusMessage("Could not refresh right now. Please try again.");
        return;
      }
      const json = (await res.json().catch(() => ({}))) as {
        runs?: Array<{ conclusion: string | null; status: string; htmlUrl: string; createdAt: string; updatedAt: string; event: string; actor: string | null; runNumber: number }>;
        triggerAudit?: Array<{ app_user_email: string | null; github_run_number: number | null; created_at: string }>;
        latestRunJobs?: Array<{ name: string; status: string; conclusion: string | null; steps: Array<{ number: number; name: string; status: string; conclusion: string | null }> }>;
      };
      setWorkflowRuns(json.runs ?? []);
      setWorkflowTriggerAudit(json.triggerAudit ?? []);
      setLatestRunJobs(json.latestRunJobs ?? []);
      setRunStatusMessage(`Updated just now (${new Date().toLocaleTimeString()}).`);
    } finally {
      setRefreshingRunStatus(false);
    }
  }, []);

  useEffect(() => {
    void refreshWorkflowRuns();
  }, [refreshWorkflowRuns]);

  const handleTriggerEspnWorkflow = async () => {
    setTriggeringWorkflow(true);
    try {
      const res = await fetch("/api/workflows/espn-scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateIst: workflowDateIst }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof json?.error === "string" ? json.error : `Workflow trigger failed (${res.status})`);
        return;
      }
      toast.success(
        `Scraper started for ${workflowDateIst}. We will save the scorecards and send an email after it finishes.`
      );
      void refreshWorkflowRuns();
    } finally {
      setTriggeringWorkflow(false);
    }
  };

  const handleBulkSave = async () => {
    if (!profile?.id || sheetFranchiseId !== profile.id) return;
    setSaving(true);
    const { error } = await supabase
      .from(sheetMatchPointsTable)
      .upsert(Object.values(pendingEdits), { onConflict: "player_id,match_id" });
    if (!error) setPendingEdits({});
    // Keep Sheets + Standings consistent immediately after saving.
    // Without this, the grid keeps showing stale values until a refresh/refetch.
    if (!error) {
      const { data: pts } = await supabase.from(sheetMatchPointsTable).select("*");
      setAllMatchPoints(pts || []);
    }
    setSaving(false);
  };

  const fixtureTeamOptions = useMemo(() => {
    const set = new Set<string>();
    for (const f of fixtures) {
      const a = teamDisplayLabel(f, 1);
      const b = teamDisplayLabel(f, 2);
      if (a) set.add(a);
      if (b) set.add(b);
    }
    return Array.from(set).sort((x, y) => x.localeCompare(y));
  }, [fixtures]);

  const fixturesForTeam = useMemo(() => {
    if (!fixtureTeamFilter) return fixtures;
    return fixtures.filter(
      (f) => teamDisplayLabel(f, 1) === fixtureTeamFilter || teamDisplayLabel(f, 2) === fixtureTeamFilter
    );
  }, [fixtures, fixtureTeamFilter]);

  const scheduledFixturesTab = useMemo(
    () => fixturesForTeam.filter((f) => f.match_date > today),
    [fixturesForTeam, today]
  );

  const resultFixturesTab = useMemo(
    () => fixturesForTeam.filter((f) => f.match_date <= today),
    [fixturesForTeam, today]
  );

  const filteredFixtures = useMemo(
    () => (fixtureListView === "scheduled" ? scheduledFixturesTab : resultFixturesTab),
    [fixtureListView, scheduledFixturesTab, resultFixturesTab]
  );

  const groupedFixtures = useMemo(() => {
    const ordered =
      fixtureListView === "results"
        ? [...filteredFixtures].sort(compareCompletedFixturesByDateTimeDesc)
        : filteredFixtures;
    const map = new Map<string, Fixture[]>();
    ordered.forEach((f) => {
      if (!map.has(f.match_date)) map.set(f.match_date, []);
      map.get(f.match_date)!.push(f);
    });
    return Array.from(map.entries());
  }, [filteredFixtures, fixtureListView]);

  /** Standings charts: franchise-adjusted column totals; X-axis only through last gameweek with any points. */
  const standingsFranchiseChart = useMemo(() => {
    const squadForTeam = (team: { id: string; team_name?: string }) =>
      allPlayers.filter((p) => p.sold_to_id === team.id || p.sold_to === team.team_name);

    let lastActiveSlot = 0;
    for (let s = 1; s <= SHEET_GAME_SLOTS; s++) {
      let anyPositive = false;
      for (const team of standings) {
        let colSum = 0;
        for (const tp of squadForTeam(team)) {
          colSum += getFranchiseSheetPoints(tp.id, tp.team, s, team.id);
        }
        if (colSum > 0) anyPositive = true;
      }
      if (anyPositive) lastActiveSlot = s;
    }

    const matchPlayedFallback = standings.length
      ? Math.max(0, ...standings.map((t: { matchesPlayed?: number }) => Number(t.matchesPlayed) || 0))
      : 0;
    let gamesToShow =
      lastActiveSlot > 0 ? lastActiveSlot : Math.max(1, matchPlayedFallback > 0 ? matchPlayedFallback : 1);
    gamesToShow = Math.min(SHEET_GAME_SLOTS, Math.max(1, gamesToShow));

    const marginalPerGame: Record<string, string | number>[] = [];
    const cumulativePerGame: Record<string, string | number>[] = [];
    const running = new Map<string, number>();
    for (let s = 1; s <= gamesToShow; s++) {
      const row: Record<string, string | number> = { game: `G${s}` };
      const cumRow: Record<string, string | number> = { game: `G${s}` };
      for (const team of standings) {
        let colSum = 0;
        for (const tp of squadForTeam(team)) {
          colSum += getFranchiseSheetPoints(tp.id, tp.team, s, team.id);
        }
        const teamName = String(team.team_name ?? "");
        const rounded = Math.round(colSum * 100) / 100;
        row[teamName] = rounded;
        running.set(teamName, (running.get(teamName) || 0) + rounded);
        cumRow[teamName] = Math.round((running.get(teamName) || 0) * 100) / 100;
      }
      marginalPerGame.push(row);
      cumulativePerGame.push(cumRow);
    }

    const baseline: Record<string, string | number> = { game: "0" };
    for (const team of standings) {
      baseline[String(team.team_name ?? "")] = 0;
    }
    const cumulativeWithStart = [baseline, ...cumulativePerGame];

    return { gamesToShow, marginalPerGame, cumulativePerGame: cumulativeWithStart };
  }, [standings, allPlayers, getFranchiseSheetPoints]);

  const squadPointsBreakdown = useMemo(() => {
    const team = analyticsTeamId ? franchises.find((f) => f.id === analyticsTeamId) : standings[0];
    const g = standingsFranchiseChart.gamesToShow;
    if (!team?.id) {
      return {
        contributors: [] as { name: string; value: number }[],
        roles: [] as { name: string; value: number }[],
      };
    }
    const players = allPlayers.filter((p) => p.sold_to_id === team.id || p.sold_to === team.team_name);
    const withPts = players.map((p) => {
      let pts = 0;
      for (let s = 1; s <= g; s++) {
        pts += getFranchiseSheetPoints(p.id, p.team, s, team.id);
      }
      return {
        name: String(p.player_name ?? ""),
        points: pts,
        role: cleanRoleLabel(p.role),
      };
    });
    withPts.sort((a, b) => b.points - a.points);
    const contributors = withPts.slice(0, 10).map((p) => ({
      name: p.name.length > 20 ? `${p.name.slice(0, 18)}…` : p.name,
      value: Math.round(p.points * 10) / 10,
    }));
    const roleBuckets = new Map<string, number>();
    for (const p of withPts) {
      roleBuckets.set(p.role, (roleBuckets.get(p.role) || 0) + p.points);
    }
    const roles = [...roleBuckets.entries()]
      .map(([name, value]) => ({ name, value: Math.round((value || 0) * 10) / 10 }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    return { contributors, roles };
  }, [analyticsTeamId, franchises, standings, allPlayers, standingsFranchiseChart.gamesToShow, getFranchiseSheetPoints]);

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
            <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-[2rem] p-6 border shadow-sm min-h-[20rem] flex flex-col">
                      <h3 className="text-sm font-black uppercase italic">Points per game</h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-3 leading-snug">
                        Grouped bars = each franchise’s total for that sheet column (G1, G2, …). Uses the same rules as the
                        score sheet (Icon, Captain/Vice, booster days). Only G1–G{standingsFranchiseChart.gamesToShow} are shown — trailing empty
                        weeks are hidden. Bar charts compare weeks side-by-side more clearly than a cumulative line when few
                        games have been played.
                      </p>
                      <div className="flex-1 min-h-[220px] w-full min-w-0">
                        {standings.length && standingsFranchiseChart.marginalPerGame.length ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChartRecharts
                              data={standingsFranchiseChart.marginalPerGame}
                              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                              <XAxis dataKey="game" tick={{ fontSize: 10, fontWeight: 700 }} />
                              <YAxis tick={{ fontSize: 10, fontWeight: 700 }} width={36} />
                              <Tooltip
                                formatter={formatRechartsTooltipPoints}
                                contentStyle={{
                                  borderRadius: 12,
                                  border: "none",
                                  boxShadow: "0 5px 15px rgba(0,0,0,0.1)",
                                }}
                              />
                              <Legend wrapperStyle={{ fontSize: 10 }} />
                              {standings.map((t, i) => (
                                <Bar
                                  key={t.id}
                                  dataKey={t.team_name}
                                  fill={TEAM_COLORS[i % TEAM_COLORS.length]}
                                  radius={[3, 3, 0, 0]}
                                  maxBarSize={28}
                                />
                              ))}
                            </BarChartRecharts>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full min-h-[180px] items-center justify-center text-[10px] font-bold uppercase text-slate-400">
                            No standings data yet
                          </div>
                        )}
                      </div>
                      <div className="mt-4 min-h-[180px] w-full min-w-0">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-2 leading-snug">
                          Cumulative total
                        </p>
                        {standings.length && standingsFranchiseChart.cumulativePerGame.length ? (
                          <ResponsiveContainer width="100%" height={180}>
                            <LineChartRecharts
                              data={standingsFranchiseChart.cumulativePerGame}
                              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                              <XAxis
                                dataKey="game"
                                tick={{ fontSize: 10, fontWeight: 700 }}
                                type="category"
                              />
                              <YAxis
                                domain={[0, "auto"]}
                                tick={{ fontSize: 10, fontWeight: 700 }}
                                width={36}
                              />
                              <Tooltip
                                formatter={formatRechartsTooltipPoints}
                                contentStyle={{
                                  borderRadius: 12,
                                  border: "none",
                                  boxShadow: "0 5px 15px rgba(0,0,0,0.1)",
                                }}
                              />
                              <Legend wrapperStyle={{ fontSize: 10 }} />
                              {standings.map((t, i) => (
                                <Line
                                  key={t.id}
                                  type="monotone"
                                  dataKey={t.team_name}
                                  stroke={TEAM_COLORS[i % TEAM_COLORS.length]}
                                  strokeWidth={2}
                                  dot={false}
                                  name={t.team_name}
                                />
                              ))}
                            </LineChartRecharts>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-[180px] items-center justify-center text-[10px] font-bold uppercase text-slate-400">
                            No cumulative totals yet
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="bg-slate-900 rounded-[2rem] p-6 shadow-xl min-h-[20rem] flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-black uppercase italic text-white">
                            {(analyticsTeamId
                              ? franchises.find((f) => f.id === analyticsTeamId)?.team_name
                              : standings[0]?.team_name) ?? "Franchise"}{" "}
                            — squad split
                          </h3>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-1 max-w-md leading-snug">
                            Same franchise points as the sheet (stored{" "}
                            <code className="font-mono">{SHEET_MATCH_POINTS_TABLE}</code> after Sync). Top players and role buckets for
                            G1–G{standingsFranchiseChart.gamesToShow}.
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1 max-w-[14rem]">
                          {franchises.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setAnalyticsTeamId(f.id)}
                              className={cn(
                                "text-[7px] font-black uppercase px-1.5 py-1 rounded whitespace-nowrap",
                                analyticsTeamId === f.id ||
                                  (!analyticsTeamId && standings[0]?.id === f.id)
                                  ? "bg-white text-slate-900"
                                  : "bg-white/10 text-white/50 hover:text-white/80"
                              )}
                            >
                              {(f.team_name || "").split(" ")[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid flex-1 grid-cols-1 gap-4 min-h-0 sm:grid-cols-2">
                        <div className="min-h-[160px] w-full min-w-0">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">
                            Top contributors
                          </p>
                          {squadPointsBreakdown.contributors.length ? (
                            <ResponsiveContainer width="100%" height={240}>
                              <BarChartRecharts
                                layout="vertical"
                                data={squadPointsBreakdown.contributors}
                                margin={{ left: 4, right: 12, top: 4, bottom: 4 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                <XAxis
                                  type="number"
                                  stroke="#64748b"
                                  tick={{ fill: "#94a3b8", fontSize: 9 }}
                                />
                                <YAxis
                                  type="category"
                                  dataKey="name"
                                  width={96}
                                  stroke="#64748b"
                                  tick={{ fill: "#cbd5e1", fontSize: 8 }}
                                  interval={0}
                                />
                                <Tooltip
                                  formatter={formatRechartsTooltipPoints}
                                  contentStyle={{
                                    background: "#0f172a",
                                    border: "1px solid #334155",
                                    borderRadius: 8,
                                    fontSize: 11,
                                  }}
                                />
                                <Bar dataKey="value" fill="#38bdf8" radius={[0, 4, 4, 0]} name="Points" />
                              </BarChartRecharts>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex h-[240px] items-center justify-center text-[9px] font-bold uppercase text-slate-500">
                              No points yet
                            </div>
                          )}
                        </div>
                        <div className="min-h-[160px] w-full min-w-0">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">By role</p>
                          {squadPointsBreakdown.roles.length ? (
                            <ResponsiveContainer width="100%" height={200}>
                              <BarChartRecharts
                                layout="vertical"
                                data={squadPointsBreakdown.roles}
                                margin={{ left: 4, right: 12, top: 4, bottom: 4 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                <XAxis
                                  type="number"
                                  stroke="#64748b"
                                  tick={{ fill: "#94a3b8", fontSize: 9 }}
                                />
                                <YAxis
                                  type="category"
                                  dataKey="name"
                                  width={72}
                                  stroke="#64748b"
                                  tick={{ fill: "#cbd5e1", fontSize: 9 }}
                                />
                                <Tooltip
                                  formatter={formatRechartsTooltipPoints}
                                  contentStyle={{
                                    background: "#0f172a",
                                    border: "1px solid #334155",
                                    borderRadius: 8,
                                    fontSize: 11,
                                  }}
                                />
                                <Bar dataKey="value" fill="#a78bfa" radius={[0, 4, 4, 0]} name="Points" />
                              </BarChartRecharts>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex h-[200px] items-center justify-center text-[9px] font-bold uppercase text-slate-500">
                              No role totals
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <Card className="relative min-w-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
                    {tabLoading && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-50 flex items-center justify-center">
                        <Loader2 className="animate-spin text-slate-900" />
                      </div>
                    )}
                    <CardHeader className="bg-slate-50/50 p-8 border-b">
                      <CardTitle className="text-xl font-black uppercase italic text-slate-900">
                        Season Standings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="min-w-0 overflow-x-auto overscroll-x-contain touch-pan-x p-0 [-webkit-overflow-scrolling:touch]">
                      <table className="w-full min-w-[800px] text-left">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Rank</th>
                            <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Franchise</th>
                            <th className="px-6 py-5 text-center text-[10px] font-black text-slate-400">Squad</th>
                            <th className="px-6 py-5 text-center text-[10px] font-black text-slate-400">Games</th>
                            <th className="px-8 py-5 text-right text-[10px] font-black text-slate-900">
                              Total Points
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {standings.map((t, idx) => (
                            <tr key={t.id} className="border-b hover:bg-slate-50 transition-colors">
                              <td className="px-8 py-6">
                                <span
                                  className={cn(
                                    "h-10 w-10 flex items-center justify-center rounded-2xl font-black",
                                    idx === 0 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"
                                  )}
                                >
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="px-8 py-6">
                                <div className="font-black italic uppercase text-slate-900">{t.team_name}</div>
                              </td>
                              <td className="px-6 py-6 text-center font-black text-slate-500">{t.squadSize}</td>
                              <td className="px-6 py-6 text-center font-black text-slate-500">{t.matchesPlayed}</td>
                              <td className="px-8 py-6 text-right font-black italic text-2xl text-slate-900">
                                {formatPoints2(t.totalPoints)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
            </>
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
                          {SHOW_CRICAPI_FIXTURE_UI ? (
                            <div className="h-8 w-24 rounded-lg bg-slate-200 animate-pulse" />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex items-center gap-2 text-slate-500 shrink-0">
                      <Users className="h-4 w-4" aria-hidden />
                      <span className="text-[10px] font-black uppercase tracking-widest">Team</span>
                    </div>
                    <select
                      value={fixtureTeamFilter ?? ""}
                      onChange={(e) => setFixtureTeamFilter(e.target.value ? e.target.value : null)}
                      className={cn(
                        "w-full sm:max-w-md min-h-[44px] touch-manipulation rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm font-bold text-slate-900",
                        "focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400"
                      )}
                      aria-label="Filter fixtures by team"
                    >
                      <option value="">All teams</option>
                      {fixtureTeamOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-slate-500 shrink-0">
                      <Zap className="h-4 w-4" aria-hidden />
                      <span className="text-[10px] font-black uppercase tracking-widest">ESPN sync</span>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end w-full">
                      <Input
                        type="date"
                        value={workflowDateIst}
                        max={today}
                        onChange={(e) => setWorkflowDateIst(e.target.value)}
                        className="h-11 sm:w-[12rem] border-slate-200 rounded-xl font-bold"
                        aria-label="Target IST date for ESPN workflow"
                      />
                      <Button
                        variant="outline"
                        disabled={triggeringWorkflow}
                        onClick={handleTriggerEspnWorkflow}
                        className="h-11 border-slate-200 rounded-xl font-black uppercase tracking-widest flex gap-2 text-slate-700 px-4 shadow-sm text-[10px]"
                        title="Trigger GitHub ESPN scraper workflow for selected IST date"
                      >
                        {triggeringWorkflow ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        Scrape ESPN Scorecards
                      </Button>
                    </div>
                  </div>
                  {workflowRuns && workflowRuns.length > 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-600">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-slate-500 uppercase tracking-wide">Last scraper update</span>
                        <button
                          type="button"
                          disabled={refreshingRunStatus}
                          className={cn(
                            "text-[10px] font-black uppercase tracking-widest",
                            refreshingRunStatus ? "text-slate-400" : "text-blue-600"
                          )}
                          onClick={() => void refreshWorkflowRuns()}
                        >
                          {refreshingRunStatus ? "Refreshing..." : "Refresh"}
                        </button>
                      </div>
                      {runStatusMessage ? <p className="mt-1 text-[11px] text-slate-500">{runStatusMessage}</p> : null}
                      <p className="mt-1 text-[11px]">
                        Status:{" "}
                        <span className="font-bold">
                          {workflowRuns[0].conclusion === "success"
                            ? "Completed successfully"
                            : workflowRuns[0].conclusion
                              ? `Completed (${workflowRuns[0].conclusion})`
                              : workflowRuns[0].status}
                        </span>
                      </p>
                      <p className="mt-1 text-[11px]">
                        Started: {new Date(workflowRuns[0].createdAt).toLocaleString()} · Last updated:{" "}
                        {new Date(workflowRuns[0].updatedAt).toLocaleString()}
                      </p>
                      {(() => {
                        const audit =
                          workflowTriggerAudit?.find((a) => a.github_run_number === workflowRuns[0].runNumber) ??
                          workflowTriggerAudit?.[0];
                        if (!audit) return null;
                        return (
                          <p className="mt-1 text-[11px]">
                            Started from app by: <span className="font-bold">{audit.app_user_email || "unknown user"}</span>
                          </p>
                        );
                      })()}
                      <a
                        href={workflowRuns[0].htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-[11px] font-bold text-blue-600 underline"
                      >
                        View full technical log
                      </a>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setFixtureListView("results")}
                      className={cn(
                        "touch-manipulation px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        fixtureListView === "results"
                          ? "bg-slate-900 text-white shadow-lg"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      )}
                    >
                      Live/Results
                      <span
                        className={cn(
                          "ml-2 text-[9px] px-1.5 py-0.5 rounded-md font-black",
                          fixtureListView === "results" ? "bg-white/20" : "bg-slate-200"
                        )}
                      >
                        {resultFixturesTab.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFixtureListView("scheduled")}
                      className={cn(
                        "touch-manipulation px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        fixtureListView === "scheduled"
                          ? "bg-slate-900 text-white shadow-lg"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      )}
                    >
                      Upcoming
                      <span
                        className={cn(
                          "ml-2 text-[9px] px-1.5 py-0.5 rounded-md font-black",
                          fixtureListView === "scheduled" ? "bg-white/20" : "bg-slate-200"
                        )}
                      >
                        {scheduledFixturesTab.length}
                      </span>
                    </button>
                  </div>
                </div>

                {groupedFixtures.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-24 bg-white rounded-[2rem] border border-slate-200 shadow-sm px-4">
                    <Calendar className="h-10 w-10 text-slate-200 shrink-0" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                      {fixtureListView === "scheduled" ? "No scheduled matches" : "No results yet"}
                    </p>
                    {fixtureTeamFilter ? (
                      <p className="text-xs font-bold text-slate-400 text-center max-w-sm">
                        Try &quot;All teams&quot; or switch between Scheduled and Results.
                      </p>
                    ) : null}
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
                        if (SHOW_CRICAPI_FIXTURE_UI) {
                          if (espnReady && cricReady) return null;
                          if (!espnReady && !cricReady) return "ESPN and CricAPI data not ready yet";
                          if (!espnReady) return "ESPN points pending";
                          return "CricAPI sync pending";
                        }
                        if (espnReady) return null;
                        return "ESPN data not ready yet";
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
                            <div
                              className={cn(
                                "grid gap-2 w-full sm:max-w-sm sm:ml-auto",
                                SHOW_CRICAPI_FIXTURE_UI ? "grid-cols-2" : "grid-cols-1"
                              )}
                            >
                              <button
                                type="button"
                                disabled={!espnReady}
                                onClick={() => {
                                  if (!espnReady) return;
                                  const mn = espnMatchNo(match);
                                  if (mn != null) void fetchEspnScorecardForMatchNo(mn);
                                  setFixtureModalTab("scorecard");
                                  setExpandedPersistedFantasyPlayerId(null);
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
                              {SHOW_CRICAPI_FIXTURE_UI ? (
                                <button
                                  type="button"
                                  disabled={!cricReady}
                                  onClick={() => {
                                    if (!cricReady) return;
                                    setFixtureModalTab("scorecard");
                                    setExpandedPersistedFantasyPlayerId(null);
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
                              ) : null}
                            </div>
                            {syncStatusLine ? (
                              <p className="text-[9px] font-bold text-slate-500 text-center sm:text-right uppercase tracking-wide leading-snug">
                                {syncStatusLine}
                              </p>
                            ) : null}
                            {!espnReady &&
                            !(SHOW_CRICAPI_FIXTURE_UI && cricReady) &&
                            !match.match_ended ? (
                              <p className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded uppercase text-center sm:text-right w-fit sm:ml-auto">
                                Live soon
                              </p>
                            ) : null}
                         </div>
                      </div>
                      </div>
                   );
                   })}
                </div>
             ))}
              </>
            )}
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
                    {fixtureModalMatchNo == null ? (
                      <p className="text-center text-sm font-bold text-slate-400 py-16 uppercase tracking-wide px-2">
                        Need <code className="font-mono">match_no</code> to load sheet points for this fixture.
                      </p>
                    ) : !fixtureModalLeagueMatchId ? (
                      <p className="text-center text-sm font-bold text-slate-400 py-16 uppercase tracking-wide px-2 leading-relaxed">
                        No league match in <code className="font-mono">matches</code> for this{" "}
                        <code className="font-mono">match_no</code>.
                      </p>
                    ) : (
                      <PersistedFantasyMatchTable
                        rows={fixtureModalPersistedRows}
                        sourceTableLabel={sheetMatchPointsTable}
                        expandedPlayerId={expandedPersistedFantasyPlayerId}
                        onToggleExpand={setExpandedPersistedFantasyPlayerId}
                        loading={fixtureModalPersistedLoading}
                        emptyMessage="No persisted points for this match yet — run Sync on the Sheets tab."
                        renderScorecardDetail={renderFixtureModalScorecardDetail}
                      />
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
                    <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sheet source</span>
                      <span
                        className={cn(
                          "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                          sheetMatchPointsTable === MATCH_POINTS_ESPN_TABLE
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        )}
                        title={
                          sheetMatchPointsTable === MATCH_POINTS_ESPN_TABLE
                            ? "Using ESPN persisted points (match_points_espn)"
                            : "Using CricAPI persisted points (match_points)"
                        }
                      >
                        {sheetMatchPointsTable === MATCH_POINTS_ESPN_TABLE ? "ESPN" : "CricAPI"}
                      </span>
                      {profile?.role === "Admin" ? (
                        <div className="flex rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                          <button
                            type="button"
                            onClick={() => void setSheetSource("espn")}
                            className={cn(
                              "px-3 py-2 text-[9px] font-black uppercase tracking-widest",
                              sheetMatchPointsTable === MATCH_POINTS_ESPN_TABLE
                                ? "bg-slate-900 text-white"
                                : "bg-white text-slate-700 hover:bg-slate-50"
                            )}
                            title="Switch Sheets to ESPN points (match_points_espn)"
                          >
                            ESPN
                          </button>
                          <button
                            type="button"
                            onClick={() => void setSheetSource("cricapi")}
                            className={cn(
                              "px-3 py-2 text-[9px] font-black uppercase tracking-widest",
                              sheetMatchPointsTable === MATCH_POINTS_CRICAPI_TABLE
                                ? "bg-slate-900 text-white"
                                : "bg-white text-slate-700 hover:bg-slate-50"
                            )}
                            title="Switch Sheets to CricAPI points (match_points)"
                          >
                            CricAPI
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <Button 
                      variant="outline" 
                      disabled={syncingEspn}
                      onClick={handleSyncEspnOnly}
                      className="h-11 border-slate-200 rounded-xl font-black uppercase tracking-widest flex gap-2 text-slate-600 px-6 shadow-sm text-[10px]"
                      title="Sync ESPN scorecards (fixtures.scorecard) → match_points_espn. Skips manual_override rows."
                    >
                       {syncingEspn ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                       Sync ESPN
                    </Button>
                    <Button
                      variant="outline"
                      disabled={syncingCricapi}
                      onClick={handleSyncCricapiOnly}
                      className="h-11 border-slate-200 rounded-xl font-black uppercase tracking-widest flex gap-2 text-slate-600 px-6 shadow-sm text-[10px]"
                      title="Sync CricAPI scorecards (fixtures_cricapi.scorecard) → match_points. Skips manual_override rows."
                    >
                      {syncingCricapi ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                      Sync CricAPI
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        const escapeCsv = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
                        const header = [
                          "Auction Franchise",
                          "Player",
                          "IPL Team",
                          "Role",
                          ...Array.from({ length: SHEET_GAME_SLOTS }, (_, i) => `G${i + 1}`),
                        ];
                        let csv = header.map(escapeCsv).join(",") + "\n";

                        const pointsMap = matchPointsCellMap; // already from selected sheetMatchPointsTable
                        const baseMap = matchPointsDetailByKey;

                        const franchisesSorted = [...franchises].sort((a: any, b: any) =>
                          String(a.team_name || a.full_name || "").localeCompare(String(b.team_name || b.full_name || ""))
                        );

                        for (const franchise of franchisesSorted) {
                          const squad = allPlayers
                            .filter((p: any) => p.sold_to_id === franchise.id || p.sold_to === franchise.team_name)
                            .sort((a: any, b: any) => String(a.player_name || "").localeCompare(String(b.player_name || "")));

                          for (const p of squad) {
                            const row: any[] = [
                              franchise.team_name || franchise.full_name || "",
                              p.player_name || "",
                              p.team || "",
                              p.role || "",
                            ];

                            for (let slot = 1; slot <= SHEET_GAME_SLOTS; slot++) {
                              const short = resolvePlayerTeamToShort(p.team);
                              const leagueMn = short ? teamSchedules.get(short)?.[slot - 1] : undefined;
                              const match = leagueMn != null ? allMatches.find((m: any) => m.match_no === leagueMn) : undefined;
                              if (!match) {
                                row.push("");
                                continue;
                              }
                              if (!isMatchPlayed(match)) {
                                row.push(0);
                                continue;
                              }

                              const key = `${p.id}_${match.id}`;
                              const stored = pointsMap.get(key);
                              if (stored === undefined) {
                                row.push(""); // no_data
                                continue;
                              }
                              if (stored === null) {
                                row.push("DNP");
                                continue;
                              }

                              const storedPoints = Number(stored) || 0;
                              const det = baseMap.get(key);
                              const basePoints = det?.base ?? undefined;
                              const haulApp = det?.haulApp ?? null;
                              const dKey = matchDateKeyIST(match.date_time);
                              const iconId = franchiseIconRows.find((r) => r.team_id === franchise.id)?.player_id ?? null;
                              const activeCvc = activeCvcForMatchDate(franchiseCvcRows, franchise.id, dKey);
                              const momRec = momByMatchId.get(match.id);
                              const momBonus =
                                momRec && momRec.player_id === p.id
                                  ? Number(momRec.bonus_points) || MOM_BONUS_DEFAULT
                                  : 0;
                              const sheet = franchiseMatchSheetDisplay({
                                storedPoints,
                                basePoints,
                                franchiseId: franchise.id,
                                playerId: p.id,
                                franchiseIconPlayerId: iconId,
                                matchDateKeyIST: dKey,
                                boosterRows: franchiseBoosterRows,
                                activeCvc,
                                momBonusPoints: momBonus,
                                haulAppliedMult: haulApp,
                              });
                              row.push(formatPoints2(sheet.display));
                            }

                            csv += row.map(escapeCsv).join(",") + "\n";
                          }
                        }

                        const link = document.createElement("a");
                        link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + csv));
                        link.setAttribute(
                          "download",
                          `Points_${sheetMatchPointsTable}_${new Date().toISOString().slice(0, 10)}.csv`
                        );
                        link.click();
                      }} 
                      className="h-11 border-slate-200 rounded-xl font-black uppercase tracking-widest flex gap-2 text-slate-600 px-6 shadow-sm text-[10px]"
                    >
                       <Download size={16} /> Export points
                    </Button>
                    </div>
                 </div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    Rows are ordered by IPL team name, then player. Row tint follows IPL franchise (CSK, MI, RCB, etc.), matching the auction room and dashboard.
                    Each game column G1–G{SHEET_GAME_SLOTS} is that player’s IPL team’s 1st, 2nd, … match of the season (not the league schedule round). If CSK have played twice, only G1–G2 apply for CSK players.
                    The database stores <span className="font-black text-slate-600">PJ base points</span> (<code className="font-mono text-slate-500">base_points</code>) and <span className="font-black text-slate-600">stored fantasy</span> (<code className="font-mono text-slate-500">points</code>) = <span className="font-black text-slate-600">base × max(batting-haul tier, bowling-haul tier)</span> (runs and wicket tiers from the rules; the higher tier applies once to the whole base). The green subline shows <span className="font-black text-slate-600">max(bat,bowl)</span> when sync has written haul columns; otherwise the effective × until you re-sync. The big cell value is usually <span className="font-black text-slate-600">stored × Icon (2×) or Captain / Vice</span> (franchise Icon wins if both apply). On <span className="font-black text-slate-600">booster days</span>, the sheet uses <span className="font-black text-slate-600">base × 3</span> (or × 6 for franchise Icon). Fill the grid with <span className="font-black text-slate-600">Sync points</span>: ESPN →{" "}
                    <code className="font-mono">match_points_espn</code>, optional CricAPI →{" "}
                    <code className="font-mono">match_points</code>. This tab reads{" "}
                    <code className="font-mono">{SHEET_MATCH_POINTS_TABLE}</code> (set in{" "}
                    <code className="font-mono">lib/featureFlags.ts</code>). Manual{" "}
                    <span className="font-black text-slate-600">manual_override</span> rows are skipped by Sync.
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
                            return formatPoints2(teamTotal);
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
                      <FranchiseBoosterPanel
                        franchiseId={franchise.id}
                        franchiseLabel={franchise.team_name || franchise.full_name || ""}
                        rows={franchiseBoosterRows}
                        canEdit={canEdit}
                        onSaved={async () => {
                          const { data } = await supabase.from("franchise_booster_days").select("*");
                          setFranchiseBoosterRows((data as FranchiseBoosterRow[]) || []);
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
                    <div className="min-w-0 w-full overflow-x-auto overscroll-x-contain touch-pan-x touch-pan-y [-webkit-overflow-scrolling:touch]">
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
                                    const noDataKey = `${p.id}_${mObj.id}`;
                                    const noDataCommitted = "";
                                    const noDataFocused = sheetCellFocusKey === noDataKey;
                                    const noDataValue = noDataFocused
                                      ? (sheetCellDraft[noDataKey] ?? noDataCommitted)
                                      : noDataCommitted;

                                    return (
                                      <td key={i} className={cn("px-1.5 py-3 text-center sm:px-3 sm:py-4", teamStyle.bg)}>
                                        <div className="flex flex-col items-center gap-0.5">
                                          <Input
                                            type="text"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            value={noDataValue}
                                            onFocus={() => {
                                              setSheetCellFocusKey(noDataKey);
                                              setSheetCellDraft((prev) => ({ ...prev, [noDataKey]: noDataCommitted }));
                                            }}
                                            onChange={(e) => {
                                              setSheetCellDraft((prev) => ({ ...prev, [noDataKey]: e.target.value }));
                                            }}
                                            onBlur={() => {
                                              const raw = (sheetCellDraft[noDataKey] ?? noDataCommitted).trim();
                                              setSheetCellFocusKey((k) => (k === noDataKey ? null : k));
                                              setSheetCellDraft((prev) => {
                                                const n = { ...prev };
                                                delete n[noDataKey];
                                                return n;
                                              });
                                              const n = parseSheetPointsBlur(raw);
                                              if (n === undefined) return;
                                              updateSeasonPoint(p.id, slot, String(n));
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                            }}
                                            className={cn(
                                              "h-8 min-w-[4rem] sm:min-w-[4.5rem] mx-auto text-[10px] font-black text-center border-none rounded-lg",
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
                                  const ptsKey = mObj ? `${p.id}_${mObj.id}` : "";
                                  const mpDet = ptsKey ? matchPointsDetailByKey.get(ptsKey) : undefined;
                                  const basePts = mpDet?.base != null ? mpDet.base : undefined;
                                  const haulAppCol = mpDet?.haulApp ?? null;
                                  const dKey = mObj?.date_time ? matchDateKeyIST(mObj.date_time) : "";
                                  const iconId =
                                    franchiseIconRows.find((r) => r.team_id === franchise.id)?.player_id ?? null;
                                  const activeCvc = mObj
                                    ? activeCvcForMatchDate(franchiseCvcRows, franchise.id, dKey)
                                    : null;
                                  const momRecCell = mObj ? momByMatchId.get(mObj.id) : undefined;
                                  const momBonusCell =
                                    momRecCell && momRecCell.player_id === p.id
                                      ? Number(momRecCell.bonus_points) || MOM_BONUS_DEFAULT
                                      : 0;
                                  const isManualOverride =
                                    !!ptsKey &&
                                    DISABLE_SHEET_AUTOCOMPUTE_ON_MANUAL_OVERRIDE &&
                                    manualOverrideKeySet.has(ptsKey);
                                  const sheet: {
                                    display: number;
                                    breakdown: FranchiseMatchSheetBreakdown;
                                  } = isManualOverride
                                    ? {
                                        display: rawPts,
                                        breakdown: {
                                          mode: "franchise_mult",
                                          mult: 1,
                                          tag: null,
                                          storedPoints: rawPts,
                                        },
                                      }
                                    : mObj
                                      ? franchiseMatchSheetDisplay({
                                          storedPoints: rawPts,
                                          basePoints: basePts,
                                          franchiseId: franchise.id,
                                          playerId: p.id,
                                          franchiseIconPlayerId: iconId,
                                          matchDateKeyIST: dKey,
                                          boosterRows: franchiseBoosterRows,
                                          activeCvc,
                                          momBonusPoints: momBonusCell,
                                          haulAppliedMult: haulAppCol,
                                        })
                                      : {
                                          display: rawPts,
                                          breakdown: {
                                            mode: "franchise_mult",
                                            mult: 1,
                                            tag: null,
                                            storedPoints: rawPts,
                                          },
                                        };
                                  const displayPts = sheet.display;
                                  const { breakdown } = sheet;
                                  const synthAfterHaul =
                                    basePts != null
                                      ? syntheticStoredAfterHaulWithMom({
                                          basePoints: basePts,
                                          dbStoredPoints: rawPts,
                                          haulAppliedMult: haulAppCol,
                                          momBonus: momBonusCell,
                                        })
                                      : rawPts;
                                  const baseForHaulLine =
                                    basePts != null ? basePts + momBonusCell : null;
                                  const hasHaulCols =
                                    mpDet?.haulRun != null &&
                                    mpDet?.haulWick != null &&
                                    mpDet?.haulApp != null &&
                                    Number.isFinite(mpDet.haulRun) &&
                                    Number.isFinite(mpDet.haulWick) &&
                                    Number.isFinite(mpDet.haulApp);
                                  const showPjHaulLine =
                                    breakdown.mode !== "booster" && basePts != null && basePts > 0;
                                  const effHaulMult =
                                    baseForHaulLine != null && baseForHaulLine > 0
                                      ? synthAfterHaul / baseForHaulLine
                                      : basePts != null && basePts > 0
                                        ? rawPts / basePts
                                        : null;
                                  const storedLabel =
                                    breakdown.mode === "franchise_mult" ? breakdown.storedPoints : rawPts;
                                  const momNote =
                                    momBonusCell > 0 ? ` MoM +${momBonusCell} base before haul.` : "";
                                  const titleBooster =
                                    breakdown.mode === "booster"
                                      ? `Booster day: base ${formatPoints2(breakdown.baseUsed)} × ${breakdown.sheetMult} (${breakdown.isFranchiseIcon ? "Franchise Icon" : "booster"}) = ${formatPoints2(displayPts)}${momNote}`
                                      : null;
                                  const titleFranchise =
                                    breakdown.mode === "franchise_mult" && breakdown.mult > 1
                                      ? `After haul ${formatPoints2(Number(storedLabel))} × ${breakdown.mult} (${breakdown.tag === "icon" ? "Icon" : breakdown.tag === "c" ? "C" : "VC"}) = ${formatPoints2(displayPts)}${momNote}`
                                      : null;
                                  const cellKey = ptsKey;
                                  const committedStr = formatPoints2(displayPts);
                                  const isCellFocused = canEdit && !!cellKey && sheetCellFocusKey === cellKey;
                                  const inputValue = !canEdit
                                    ? committedStr
                                    : isCellFocused
                                      ? (sheetCellDraft[cellKey] ?? committedStr)
                                      : committedStr;

                                  return (
                                    <td key={i} className={cn("px-1.5 py-3 text-center sm:px-3 sm:py-4", teamStyle.bg)}>
                                      <div className="flex flex-col items-center gap-0.5">
                                        <Input
                                          type="text"
                                          inputMode="decimal"
                                          autoComplete="off"
                                          value={inputValue}
                                          readOnly={!canEdit}
                                          onFocus={() => {
                                            if (!canEdit || !cellKey) return;
                                            setSheetCellFocusKey(cellKey);
                                            setSheetCellDraft((prev) => ({ ...prev, [cellKey]: committedStr }));
                                          }}
                                          onChange={(e) => {
                                            if (!canEdit || !cellKey) return;
                                            setSheetCellDraft((prev) => ({ ...prev, [cellKey]: e.target.value }));
                                          }}
                                          onBlur={() => {
                                            if (!canEdit || !cellKey) return;
                                            const raw = (sheetCellDraft[cellKey] ?? committedStr).trim();
                                            setSheetCellFocusKey((k) => (k === cellKey ? null : k));
                                            setSheetCellDraft((prev) => {
                                              const n = { ...prev };
                                              delete n[cellKey];
                                              return n;
                                            });
                                            const n = parseSheetPointsBlur(raw);
                                            if (n === undefined) return;
                                            updateSeasonPoint(p.id, slot, String(n));
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                          }}
                                          className={cn(
                                            "h-8 min-w-[4rem] sm:min-w-[4.5rem] mx-auto text-[10px] font-black text-center border-none rounded-lg",
                                            isDirty
                                              ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                                              : "bg-white/70 text-slate-900",
                                            !canEdit && "cursor-not-allowed opacity-85"
                                          )}
                                          placeholder="0"
                                          title={
                                            isManualOverride
                                              ? "Manual override: this cell is not auto-computed (no Icon/C/VC/booster multipliers)."
                                              :
                                            titleBooster ??
                                            (showPjHaulLine && basePts != null
                                              ? hasHaulCols
                                                ? `PJ base ${momBonusCell > 0 ? `(${formatPoints2(basePts)}+${momBonusCell} MoM)` : formatPoints2(basePts)} × max(batting haul ${fmtHaulTier(mpDet!.haulRun!)}, bowling haul ${fmtHaulTier(mpDet!.haulWick!)}) = ${fmtHaulTier(mpDet!.haulApp!)}× → after haul ${formatPoints2(synthAfterHaul)}; franchise cell → ${formatPoints2(displayPts)}`
                                                : `PJ base ${momBonusCell > 0 ? `(${formatPoints2(basePts)}+${momBonusCell} MoM)` : formatPoints2(basePts)} × haul (effective ${effHaulMult != null ? fmtHaulTier(effHaulMult) : "?"})× → after haul ${formatPoints2(synthAfterHaul)}; franchise cell → ${formatPoints2(displayPts)}`
                                              : titleFranchise ?? undefined)
                                          }
                                        />
                                        {showPjHaulLine && basePts != null ? (
                                          <span
                                            className="text-[7px] font-black uppercase tracking-tight text-emerald-800/90 tabular-nums leading-tight text-center max-w-[5.5rem] sm:max-w-none"
                                            title="Total fantasy points = PJ base × max(batting-haul tier, bowling-haul tier). Re-sync populates haul columns."
                                          >
                                            {hasHaulCols ? (
                                              <>
                                                base{" "}
                                                {momBonusCell > 0
                                                  ? `(${formatPoints2(basePts)}+${momBonusCell})`
                                                  : formatPoints2(basePts)}
                                                ×max(
                                                {fmtHaulTier(mpDet!.haulRun!)},{fmtHaulTier(mpDet!.haulWick!)})=
                                                {fmtHaulTier(mpDet!.haulApp!)}→{formatPoints2(synthAfterHaul)}
                                              </>
                                            ) : effHaulMult != null ? (
                                              <>
                                                base{" "}
                                                {momBonusCell > 0
                                                  ? `(${formatPoints2(basePts)}+${momBonusCell})`
                                                  : formatPoints2(basePts)}
                                                ×{fmtHaulTier(effHaulMult)}→{formatPoints2(synthAfterHaul)}
                                                <span className="block font-bold text-emerald-950/70 normal-case">
                                                  (re-sync for bat/bowl tiers)
                                                </span>
                                              </>
                                            ) : (
                                              <>
                                                base{" "}
                                                {momBonusCell > 0
                                                  ? `(${formatPoints2(basePts)}+${momBonusCell})`
                                                  : formatPoints2(basePts)}
                                                →{formatPoints2(synthAfterHaul)}
                                              </>
                                            )}
                                          </span>
                                        ) : null}
                                        {breakdown.mode === "booster" ? (
                                          <span
                                            className="text-[7px] font-black uppercase tracking-tight text-violet-900 tabular-nums"
                                            title="Booster day: base × 3 (× 6 franchise Icon); Captain/Vice and normal Icon 2× do not apply"
                                          >
                                            base {formatPoints2(breakdown.baseUsed)}×{breakdown.sheetMult} booster={formatPoints2(displayPts)}
                                          </span>
                                        ) : breakdown.mode === "franchise_mult" && breakdown.mult > 1 ? (
                                          <span
                                            className="text-[7px] font-black uppercase tracking-tight text-violet-900 tabular-nums"
                                            title="Franchise multiplier on points after haul (includes MoM in base before haul)"
                                          >
                                            {formatPoints2(Number(storedLabel))}×{breakdown.mult}
                                            {breakdown.tag === "icon"
                                              ? " Icon"
                                              : breakdown.tag === "c"
                                                ? " C"
                                                : " VC"}
                                            ={formatPoints2(displayPts)}
                                          </span>
                                        ) : null}
                                        {profile?.role === "Admin" && mObj && isMatchPlayed(mObj) ? (
                                          <label className="mt-0.5 flex cursor-pointer items-center justify-center gap-1 text-[7px] font-black uppercase tracking-tight text-amber-900">
                                            <input
                                              type="checkbox"
                                              className="h-3 w-3 rounded border-amber-700/40 accent-amber-700"
                                              checked={momByMatchId.get(mObj.id)?.player_id === p.id}
                                              onChange={(e) => {
                                                void persistMatchMom(mObj.id, p.id, e.target.checked);
                                              }}
                                            />
                                            MoM +50
                                          </label>
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
                                  {formatPoints2(total)}
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
                                    {v ? formatPoints2(v) : ""}
                                  </td>
                                ))}
                                <td className="bg-slate-900 px-3 py-4 text-right font-black italic text-sm static z-auto sm:sticky sm:right-0 sm:z-10 sm:px-8 sm:py-5 max-sm:shadow-none sm:shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.3)]">
                                  {formatPoints2(teamGrandTotal)}
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
