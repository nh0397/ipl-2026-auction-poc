"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  Calendar,
  MapPin,
  Clock,
  Trophy,
  Loader2,
  XCircle,
  Zap,
  Radio,
  Database,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SHOW_CRICAPI_FIXTURE_UI, SHEET_MATCH_POINTS_TABLE } from "@/lib/featureFlags";
import { MATCH_POINTS_CRICAPI_TABLE, MATCH_POINTS_ESPN_TABLE } from "@/lib/matchPointsTables";
import ScorecardViewer from "@/components/scoreboard/ScorecardViewer";
import { adaptCricApiToScorecardViewer } from "@/lib/adapters/cricapiScorecard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { aggregateFantasyRowsFromCricApiMatchData } from "@/lib/cricapiFantasyAggregate";
import {
  computeEspnPjBreakdownRows,
  type PlayerCatalogRow,
} from "@/lib/espnPjBreakdownFromScorecard";
import { FantasyPjBreakdownPanel } from "@/components/fantasy/FantasyPjBreakdownPanel";
import { PersistedFantasyMatchTable } from "@/components/fantasy/PersistedFantasyMatchTable";
import { buildPersistedFantasyRowsForMatch, type PersistedFantasyRow } from "@/lib/persistedFantasyRowsFromMatchPoints";

interface Fixture {
  id: string;
  api_match_id: string;
  /** Joins to `public.fixtures` (ESPN scrape) for scorecard. */
  match_no?: number | null;
  title: string;
  match_name?: string | null;
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
  scorecard: any;
}

// Today in YYYY-MM-DD (IST = UTC+5:30)
function getTodayIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().split("T")[0];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(dateTimeGMT: string): string {
  const d = new Date(dateTimeGMT);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}

function formatLocalTime(dateTimeGMT: string): { time: string; tz: string } {
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

/** Same label as team rows on cards — used for filter options and matching. */
function teamDisplayLabel(f: Fixture, side: 1 | 2): string {
  const short = side === 1 ? f.team1_short : f.team2_short;
  const name = side === 1 ? f.team1_name : f.team2_name;
  return (cleanShort(short) || name || "").trim();
}

function isFixtureResult(f: Fixture, today: string): boolean {
  return f.match_ended || f.match_date < today;
}

function deriveMatchNo(f: any): number | null {
  const n = Number(f?.match_no);
  if (Number.isFinite(n) && n > 0) return n;
  const s = String(f?.title || f?.match_name || f?.name || "");
  const m = s.match(/(\d+)(st|nd|rd|th)\s+Match/i);
  if (m?.[1]) return Number(m[1]);
  const m2 = s.match(/\bMatch\s+(\d+)\b/i);
  if (m2?.[1]) return Number(m2[1]);
  return null;
}

/** Same as Scoreboard: only stored `match_no` links to `public.fixtures`. */
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

export default function FixturesPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  /** Scheduled = not yet a result; Results = finished or past date (same as match cards). */
  const [listView, setListView] = useState<"scheduled" | "results">("scheduled");
  /** Filter to fixtures involving this team (display label); null = all teams. */
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  /** Modal: which data source + which CricAPI fixture row. */
  const [modal, setModal] = useState<{ source: "espn" | "cricapi"; fixture: Fixture } | null>(null);
  const [modalTab, setModalTab] = useState<"scorecard" | "fantasy">("scorecard");
  const [espnScoreByMatchNo, setEspnScoreByMatchNo] = useState<Record<number, any | null>>({});
  const [espnLoading, setEspnLoading] = useState<Record<number, boolean>>({});
  /** `public.fixtures.points_synced` keyed by ESPN `match_no`. */
  const [espnPointsSyncedByMatchNo, setEspnPointsSyncedByMatchNo] = useState<Record<number, boolean>>({});
  const [allMatches, setAllMatches] = useState<{ id: string; match_no?: number | null }[]>([]);
  const [matchPointsSource, setMatchPointsSource] = useState<"espn" | "cricapi" | null>(null);
  const [modalFixtureFresh, setModalFixtureFresh] = useState<Fixture | null>(null);
  const [modalRefreshing, setModalRefreshing] = useState(false);
  const [expandedPersistedFantasyPlayerId, setExpandedPersistedFantasyPlayerId] = useState<string | null>(null);
  const [modalPersistedRows, setModalPersistedRows] = useState<PersistedFantasyRow[]>([]);
  const [modalPersistedLoading, setModalPersistedLoading] = useState(false);
  const [playersCatalog, setPlayersCatalog] = useState<PlayerCatalogRow[]>([]);

  const sheetMatchPointsTable =
    matchPointsSource === "cricapi"
      ? MATCH_POINTS_CRICAPI_TABLE
      : matchPointsSource === "espn"
        ? MATCH_POINTS_ESPN_TABLE
        : SHEET_MATCH_POINTS_TABLE;

  const today = useMemo(() => getTodayIST(), []);

  useEffect(() => {
    const load = async () => {
      const [cricRes, espnSyncRes, matchesRes, cfgRes, catRes] = await Promise.all([
        supabase.from("fixtures_cricapi").select("*").order("date_time_gmt", { ascending: true }),
        supabase.from("fixtures").select("match_no,points_synced"),
        supabase.from("matches").select("id,match_no"),
        supabase.from("auction_config").select("match_points_source").limit(1).maybeSingle(),
        supabase
          .from("players")
          .select("player_name, team, type, role")
          .eq("auction_status", "sold")
          .order("player_name", { ascending: true }),
      ]);
      if (cricRes.error) console.error("Error fetching fixtures:", cricRes.error);
      if (cricRes.data) setFixtures(cricRes.data as Fixture[]);
      if (espnSyncRes.data) {
        const m: Record<number, boolean> = {};
        for (const row of espnSyncRes.data as { match_no?: number | null; points_synced?: boolean | null }[]) {
          const n = Number(row.match_no);
          if (Number.isFinite(n)) m[n] = !!row.points_synced;
        }
        setEspnPointsSyncedByMatchNo(m);
      }
      if (matchesRes.data) setAllMatches(matchesRes.data as { id: string; match_no?: number | null }[]);
      if (cfgRes.data) {
        const src = String((cfgRes.data as { match_points_source?: string | null }).match_points_source ?? "").toLowerCase();
        if (src === "espn" || src === "cricapi") setMatchPointsSource(src);
        else setMatchPointsSource(null);
      }
      if (catRes.data) setPlayersCatalog(catRes.data as PlayerCatalogRow[]);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (!modal) {
      setModalFixtureFresh(null);
      return;
    }
    let cancelled = false;
    if (modal.source === "cricapi") {
      setModalRefreshing(true);
      (async () => {
        const { data, error } = await supabase.from("fixtures_cricapi").select("*").eq("id", modal.fixture.id).maybeSingle();
        if (cancelled) return;
        if (!error && data) {
          setModalFixtureFresh(data as Fixture);
          setFixtures((prev) => prev.map((f) => (f.id === modal.fixture.id ? { ...f, ...data } : f)));
        }
        setModalRefreshing(false);
      })();
      return () => {
        cancelled = true;
      };
    }
    if (modal.source === "espn") {
      const mn = espnMatchNo(modal.fixture);
      if (mn == null) return;
      setEspnLoading((p) => ({ ...p, [mn]: true }));
      (async () => {
        const { data, error } = await supabase.from("fixtures").select("scorecard").eq("match_no", mn).maybeSingle();
        if (cancelled) return;
        if (error) setEspnScoreByMatchNo((p) => ({ ...p, [mn]: null }));
        else setEspnScoreByMatchNo((p) => ({ ...p, [mn]: data?.scorecard ?? null }));
        setEspnLoading((p) => ({ ...p, [mn]: false }));
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [modal]);

  const closeModal = () => {
    setModal(null);
    setModalTab("scorecard");
    setExpandedPersistedFantasyPlayerId(null);
    setModalPersistedRows([]);
    setModalPersistedLoading(false);
  };

  const cricapiModalData = modal?.source === "cricapi" ? modalFixtureFresh ?? modal.fixture : null;
  const cricapiViewer = useMemo(() => {
    const raw = cricapiModalData?.scorecard;
    if (!raw) return null;
    return adaptCricApiToScorecardViewer(raw);
  }, [cricapiModalData?.scorecard]);

  const espnModalMn = modal?.source === "espn" ? espnMatchNo(modal.fixture) : null;
  const espnModalScore = espnModalMn != null ? espnScoreByMatchNo[espnModalMn] : undefined;
  const espnModalLoading = espnModalMn != null ? !!espnLoading[espnModalMn] : false;

  const matchByNo = useMemo(() => {
    const map = new Map<number, { id: string; match_no?: number | null }>();
    (allMatches || []).forEach((m) => {
      const n = Number(m?.match_no);
      if (Number.isFinite(n)) map.set(n, m);
    });
    return map;
  }, [allMatches]);

  const modalLeagueMatchNo = modal ? espnMatchNo(modal.fixture) : null;
  const modalLeagueMatchId =
    modalLeagueMatchNo != null ? (matchByNo.get(modalLeagueMatchNo)?.id as string | undefined) : undefined;

  useEffect(() => {
    if (!modal || !modalLeagueMatchId) {
      setModalPersistedRows([]);
      setModalPersistedLoading(false);
      return;
    }
    const matchId = modalLeagueMatchId;
    let cancelled = false;
    setModalPersistedLoading(true);
    (async () => {
      const { data: pts, error } = await supabase.from(sheetMatchPointsTable).select("*").eq("match_id", matchId);
      if (cancelled) return;
      if (error) {
        console.error("[fixtures modal] persisted fantasy fetch", error);
        setModalPersistedRows([]);
        setModalPersistedLoading(false);
        return;
      }
      if (!pts?.length) {
        setModalPersistedRows([]);
        setModalPersistedLoading(false);
        return;
      }
      const ids = [...new Set(pts.map((p: { player_id?: string }) => p.player_id).filter(Boolean))] as string[];
      const { data: pls, error: pErr } = await supabase.from("players").select("id, player_name, team").in("id", ids);
      if (cancelled) return;
      if (pErr) {
        console.error("[fixtures modal] players fetch", pErr);
        setModalPersistedRows([]);
        setModalPersistedLoading(false);
        return;
      }
      setModalPersistedRows(buildPersistedFantasyRowsForMatch(matchId, pts, pls || []));
      setModalPersistedLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [modal, modalLeagueMatchId, sheetMatchPointsTable]);

  const modalCricapiFantasyById = useMemo(() => {
    if (modal?.source !== "cricapi") return new Map<string, ReturnType<typeof aggregateFantasyRowsFromCricApiMatchData>[number]>();
    const raw = cricapiModalData?.scorecard as Record<string, unknown> | null | undefined;
    if (!raw) return new Map();
    const rows = aggregateFantasyRowsFromCricApiMatchData(raw);
    return new Map(rows.map((r) => [r.player_id, r] as const));
  }, [modal?.source, cricapiModalData?.scorecard]);

  const modalEspnFantasyByNameTeam = useMemo(() => {
    if (modal?.source !== "espn" || !espnModalScore?.innings?.length || !modal) {
      return new Map<string, ReturnType<typeof computeEspnPjBreakdownRows>[number]>();
    }
    const rows = computeEspnPjBreakdownRows(espnModalScore, modal.fixture, playersCatalog);
    const m = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      m.set(`${normFantasyLookupKeyPart(r.n)}_${normFantasyLookupKeyPart(r.team)}`, r);
    }
    return m;
  }, [modal, espnModalScore, playersCatalog]);

  const renderModalScorecardDetail = useCallback(
    (row: PersistedFantasyRow): React.ReactNode => {
      if (!modal) return null;
      if (modal.source === "cricapi") {
        const d = modalCricapiFantasyById.get(row.player_id);
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
      const e = modalEspnFantasyByNameTeam.get(k);
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
    [modal, modalCricapiFantasyById, modalEspnFantasyByNameTeam]
  );

  const teamOptions = useMemo(() => {
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
    if (!teamFilter) return fixtures;
    return fixtures.filter((f) => {
      return teamDisplayLabel(f, 1) === teamFilter || teamDisplayLabel(f, 2) === teamFilter;
    });
  }, [fixtures, teamFilter]);

  const scheduledFixtures = useMemo(
    () => fixturesForTeam.filter((f) => !isFixtureResult(f, today)),
    [fixturesForTeam, today]
  );

  const resultFixtures = useMemo(
    () => fixturesForTeam.filter((f) => isFixtureResult(f, today)),
    [fixturesForTeam, today]
  );

  const filtered = listView === "scheduled" ? scheduledFixtures : resultFixtures;

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, Fixture[]>();
    filtered.forEach(f => {
      const key = f.match_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    });
    return Array.from(map.entries());
  }, [filtered]);

  // Scroll to today on load (scheduled list — where “today” matters most)
  useEffect(() => {
    if (!loading && listView === "scheduled") {
      setTimeout(() => {
        const el = document.getElementById(`date-${today}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [loading, listView, today]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b border-slate-100 mb-6">
          <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse">
            <div className="h-10 w-48 bg-slate-200 rounded-xl mb-4" />
            <div className="h-2 w-full bg-slate-100 rounded-full mb-4" />
            <div className="flex gap-2">
              <div className="h-10 w-24 bg-slate-100 rounded-xl" />
              <div className="h-10 w-24 bg-slate-100 rounded-xl" />
            </div>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
               <div className="h-6 w-32 bg-slate-200 rounded-lg mb-3" />
               <div className="h-32 w-full bg-white rounded-2xl border border-slate-100 shadow-sm" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalMatches = fixturesForTeam.length;
  const completedCount = fixturesForTeam.filter((f) => isFixtureResult(f, today)).length;

  return (
    <div className="min-h-screen min-w-0 bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-5 sm:py-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900">
                IPL 2026 Fixtures
              </h1>
              <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider">
                {completedCount} of {totalMatches} completed
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${totalMatches > 0 ? (completedCount / totalMatches) * 100 : 0}%` }}
            />
          </div>

          {/* Team filter */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 mb-4">
            <div className="flex items-center gap-2 text-slate-500 shrink-0">
              <Users className="h-4 w-4" aria-hidden />
              <span className="text-[10px] font-black uppercase tracking-widest">Team</span>
            </div>
            <select
              value={teamFilter ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setTeamFilter(v ? v : null);
              }}
              className={cn(
                "w-full sm:max-w-xs min-h-[44px] touch-manipulation rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 shadow-sm",
                "focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              )}
              aria-label="Filter by team name"
            >
              <option value="">All teams</option>
              {teamOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Scheduled vs Results */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:overflow-visible sm:pb-0 sm:mx-0 sm:px-0">
            {([
              { key: "scheduled" as const, label: "Scheduled", count: scheduledFixtures.length },
              { key: "results" as const, label: "Results", count: resultFixtures.length },
            ]).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setListView(tab.key)}
                className={cn(
                  "shrink-0 touch-manipulation px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all",
                  listView === tab.key
                    ? "bg-slate-900 text-white shadow-lg"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "ml-1.5 text-[10px] px-1.5 py-0.5 rounded-md font-black",
                    listView === tab.key ? "bg-white/20" : "bg-slate-200"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Match List */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {grouped.map(([date, matches]) => {
          const isToday = date === today;
          const isPast = date < today;

          return (
            <div key={date} id={`date-${date}`} className={cn(
              "space-y-4 p-1 rounded-3xl transition-all",
              isToday && "bg-blue-50/30 ring-1 ring-blue-100/50 shadow-inner"
            )}>
              {/* Date Divider */}
              <div className="flex flex-wrap items-center gap-y-2 gap-x-3 mb-3 px-1 min-w-0">
                <div
                  className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-3 sm:px-4 py-2 rounded-xl flex items-center gap-2 max-w-full",
                    isToday
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                      : isPast
                        ? "bg-slate-200 text-slate-500"
                        : "bg-slate-100 text-slate-600"
                  )}
                >
                  {isToday && <Zap className="h-3 w-3 shrink-0 fill-current animate-pulse" />}
                  <span className="break-words text-left leading-tight">
                    {isToday ? "Today's Matches" : formatDate(date)}
                  </span>
                </div>
                {isToday && (
                  <span className="text-[10px] font-black text-blue-600/60 uppercase tracking-tighter break-words">
                    {formatDate(date)}
                  </span>
                )}
                <div className="hidden min-[400px]:block flex-1 border-t border-dashed border-slate-200 min-w-[2rem]" />
                {matches.length > 1 && (
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                    {matches.length} matches
                  </span>
                )}
              </div>

              {/* Match Cards */}
              <div className="space-y-3">
                {matches.map(match => {
                  const isMatchToday = match.match_date === today;
                  const isCompleted = isFixtureResult(match, today);
                  const isLive = match.match_started && !match.match_ended;

                  return (
                    <div
                      key={match.id}
                      className={cn(
                        "relative bg-white rounded-2xl border overflow-hidden transition-all",
                        isMatchToday && !isCompleted
                          ? "border-blue-200 shadow-lg shadow-blue-100 ring-2 ring-blue-100"
                          : isCompleted
                            ? "border-slate-100 opacity-75"
                            : "border-slate-100 shadow-sm hover:shadow-md"
                      )}
                    >
                      {/* Live indicator */}
                      {isLive && (
                        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-[1] flex items-center gap-1.5 bg-red-500 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-1 sm:px-2.5 rounded-full animate-pulse max-w-[calc(100%-1rem)]">
                          <div className="h-1.5 w-1.5 shrink-0 bg-white rounded-full" />
                          <span className="truncate">LIVE</span>
                        </div>
                      )}

                      {/* Completed badge */}
                      {isCompleted && !isLive && (
                        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-[1] flex items-start gap-1 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider text-right max-w-[min(11rem,46%)] leading-tight">
                          <Trophy className="h-3 w-3 shrink-0 mt-0.5" />
                          <span className="break-words">Completed</span>
                        </div>
                      )}

                      <div className="p-4 sm:p-5 pt-10 sm:pt-5">
                        {/* Match number */}
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                          Match {deriveMatchNo(match) ?? "—"}
                        </div>

                        {/* Teams */}
                        <div className="flex items-center justify-between gap-3 mb-2">
                          {/* Team 1 */}
                          <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                            {match.team1_img && (
                              <img 
                                src={match.team1_img.replace('p.imgci.com/lsci/', 'img1.hscicdn.com/inline/').replace('/lsci/', '/').startsWith('https') ? match.team1_img.replace('p.imgci.com/lsci/', 'img1.hscicdn.com/inline/').replace('/lsci/', '/') : `https://img1.hscicdn.com/inline${match.team1_img.replace('/lsci/', '/')}`} 
                                alt={match.team1_short || ""} 
                                className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl object-contain bg-slate-50 border border-slate-100 p-1 flex-shrink-0"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-xs sm:text-sm md:text-base font-black uppercase tracking-tight text-slate-900 leading-snug break-words hyphens-auto">
                                {cleanShort(match.team1_short) || match.team1_name}
                              </div>
                            </div>
                          </div>

                          {/* VS / Score */}
                          <div className="flex flex-col items-center gap-1 flex-shrink-0 min-w-[3.25rem] sm:min-w-[60px] px-0.5">
                            {match.scorecard?.livescore && match.scorecard.livescore !== "N/A" ? (
                              <div
                                className={cn(
                                  "max-w-[min(100%,9rem)] text-center text-[11px] sm:text-sm font-black px-2 py-1.5 sm:px-3 rounded-xl shadow-sm border animate-in fade-in zoom-in duration-300 leading-tight break-words",
                                  isLive
                                    ? "bg-red-50 text-red-600 border-red-100"
                                    : "bg-slate-900 text-white border-slate-800"
                                )}
                              >
                                {match.scorecard.livescore}
                              </div>
                            ) : (
                              <div className={cn(
                                "text-xs font-black uppercase px-3 py-1.5 rounded-xl",
                                isMatchToday && !isCompleted
                                  ? "bg-blue-50 text-blue-600"
                                  : isCompleted
                                    ? "bg-slate-50 text-slate-400"
                                    : "bg-slate-50 text-slate-500"
                              )}>
                                VS
                              </div>
                            )}
                          </div>

                          {/* Team 2 */}
                          <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 justify-end text-right">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs sm:text-sm md:text-base font-black uppercase tracking-tight text-slate-900 leading-snug break-words hyphens-auto text-right">
                                {cleanShort(match.team2_short) || match.team2_name}
                              </div>
                            </div>
                            {match.team2_img && (
                              <img 
                                src={match.team2_img.replace('p.imgci.com/lsci/', 'img1.hscicdn.com/inline/').replace('/lsci/', '/').startsWith('https') ? match.team2_img.replace('p.imgci.com/lsci/', 'img1.hscicdn.com/inline/').replace('/lsci/', '/') : `https://img1.hscicdn.com/inline${match.team2_img.replace('/lsci/', '/')}`} 
                                alt={match.team2_short || ""} 
                                className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl object-contain bg-slate-50 border border-slate-100 p-1 flex-shrink-0"
                              />
                            )}
                          </div>
                        </div>

                        {/* Match Status/Update */}
                        {match.status && match.status !== "Upcoming" && (
                          <div className="mb-3">
                            <div className={cn(
                              "text-center text-[10px] font-black uppercase tracking-wider py-1 rounded-lg",
                              isLive ? "bg-red-50 text-red-500" : "bg-slate-50 text-slate-500"
                            )}>
                              {match.status}
                            </div>
                          </div>
                        )}

                        {/* Meta info */}
                        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start gap-x-4 gap-y-2 text-[10px] sm:text-xs font-bold text-slate-400 min-w-0">
                          {match.date_time_gmt && (
                            <div className="flex items-start gap-1.5 min-w-0 max-w-full">
                              <Clock className="h-3 w-3 shrink-0 mt-0.5" />
                              <span className="leading-snug break-words">
                                {formatTime(match.date_time_gmt)} IST
                                {(() => {
                                  const local = formatLocalTime(match.date_time_gmt);
                                  return local.tz !== "IST" ? ` • ${local.time} ${local.tz}` : "";
                                })()}
                              </span>
                            </div>
                          )}
                          {match.venue && (
                            <div className="flex items-start gap-1.5 min-w-0 max-w-full">
                              <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                              <span className="leading-snug break-words">{match.venue.split(",")[0]}</span>
                            </div>
                          )}
                        </div>

                        {/* ESPN (+ optional CricAPI DB modal) */}
                        <div
                          className={cn(
                            "mt-4 pt-4 border-t border-slate-50 grid gap-2 min-w-0",
                            SHOW_CRICAPI_FIXTURE_UI ? "grid-cols-2" : "grid-cols-1"
                          )}
                        >
                          {(() => {
                            const mn = espnMatchNo(match);
                            const espnReady = mn != null && !!espnPointsSyncedByMatchNo[mn];
                            const cricReady = !!match.points_synced;
                            return (
                              <>
                                <button
                                  type="button"
                                  disabled={!espnReady}
                                  onClick={() => {
                                    if (!espnReady) return;
                                    setModalTab("scorecard");
                                    setExpandedPersistedFantasyPlayerId(null);
                                    setModal({ source: "espn", fixture: match });
                                  }}
                                  className={cn(
                                    "touch-manipulation min-h-[48px] flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wide sm:tracking-widest transition-all border text-center leading-tight",
                                    espnReady
                                      ? "bg-white border-slate-200 text-slate-800 active:bg-slate-100 hover:bg-slate-50 shadow-sm"
                                      : "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                                  )}
                                >
                                  <Radio className="h-3.5 w-3.5 shrink-0" />
                                  <span className="break-words">ESPN</span>
                                </button>
                                {SHOW_CRICAPI_FIXTURE_UI ? (
                                  <button
                                    type="button"
                                    disabled={!cricReady}
                                    onClick={() => {
                                      if (!cricReady) return;
                                      setModalTab("scorecard");
                                      setExpandedPersistedFantasyPlayerId(null);
                                      setModal({ source: "cricapi", fixture: match });
                                    }}
                                    className={cn(
                                      "touch-manipulation min-h-[48px] flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wide sm:tracking-widest transition-all border text-center leading-tight",
                                      cricReady
                                        ? "bg-slate-900 text-white border-slate-900 active:bg-slate-800 hover:bg-black shadow-md"
                                        : "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                                    )}
                                  >
                                    <Database className="h-3.5 w-3.5 shrink-0" />
                                    <span className="break-words">CricAPI</span>
                                  </button>
                                ) : null}
                              </>
                            );
                          })()}
                        </div>
                        {SHOW_CRICAPI_FIXTURE_UI && match.match_ended && !match.points_synced ? (
                          <p className="mt-2 text-[10px] font-bold text-blue-600 text-center uppercase tracking-wide">
                            CricAPI sync pending (points_synced)
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 px-2">
            <Calendar className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <p className="text-lg font-black text-slate-300 uppercase tracking-tight">
              {listView === "scheduled" ? "No scheduled matches" : "No results yet"}
            </p>
            {teamFilter ? (
              <p className="mt-2 text-sm font-bold text-slate-400">
                Try &quot;All teams&quot; or switch between Scheduled and Results.
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* ESPN / CricAPI modal — Scorecard + Fantasy (DB-backed) */}
      {modal && (
        <div className="fixed inset-0 z-[100] flex items-stretch sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeModal} />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fixtures-modal-title"
            className="relative box-border flex min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-none bg-white shadow-2xl animate-in slide-in-from-bottom duration-500 h-[100dvh] max-h-[100dvh] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:h-auto sm:max-h-[min(90vh,calc(100dvh-2rem))] sm:rounded-3xl sm:pt-0 sm:pb-0"
          >
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-start gap-2 sm:gap-4 bg-white shrink-0">
              <div className="flex items-start gap-2 sm:gap-4 min-w-0 flex-1">
                <div
                  className={cn(
                    "h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shadow-lg shrink-0 mt-0.5",
                    modal.source === "espn" ? "bg-white border border-slate-200" : "bg-blue-600 shadow-blue-100"
                  )}
                >
                  {modal.source === "espn" ? (
                    <Radio className="h-4 w-4 sm:h-5 sm:w-5 text-slate-800" />
                  ) : (
                    <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1 pr-1">
                  <h2
                    id="fixtures-modal-title"
                    className="text-sm sm:text-lg font-black uppercase tracking-tight text-slate-900 leading-snug break-words"
                  >
                    {modal.fixture.title || modal.fixture.match_name || "Match"}
                  </h2>
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wide sm:tracking-widest mt-1 leading-relaxed break-words">
                    {modal.source === "espn" ? "ESPN (fixtures table)" : "CricAPI (fixtures_cricapi)"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 -mr-1 hover:bg-slate-100 rounded-full transition-colors group shrink-0 touch-manipulation"
                aria-label="Close"
              >
                <XCircle className="h-6 w-6 text-slate-300 group-hover:text-slate-600" />
              </button>
            </div>

            <Tabs
              value={modalTab}
              onValueChange={(v) => setModalTab(v as "scorecard" | "fantasy")}
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
                {modal.source === "cricapi" && (
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
                {modal.source === "espn" && (
                  <>
                    {espnModalMn == null ? (
                      <p className="text-center text-sm font-bold text-slate-400 py-16 uppercase tracking-wide">
                        No <code className="font-mono">match_no</code> — link this fixture to ESPN in Supabase.
                      </p>
                    ) : espnModalLoading ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="h-10 w-10 text-slate-600 animate-spin" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading ESPN scorecard from database…</p>
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
                {modalLeagueMatchNo == null ? (
                  <p className="text-center text-sm font-bold text-slate-400 py-16 uppercase tracking-wide px-2">
                    Need <code className="font-mono">match_no</code> on this fixture to load sheet points.
                  </p>
                ) : !modalLeagueMatchId ? (
                  <p className="text-center text-sm font-bold text-slate-400 py-16 uppercase tracking-wide px-2 leading-relaxed">
                    No league match in <code className="font-mono">matches</code> for this{" "}
                    <code className="font-mono">match_no</code>.
                  </p>
                ) : (
                  <PersistedFantasyMatchTable
                    rows={modalPersistedRows}
                    sourceTableLabel={sheetMatchPointsTable}
                    expandedPlayerId={expandedPersistedFantasyPlayerId}
                    onToggleExpand={setExpandedPersistedFantasyPlayerId}
                    loading={modalPersistedLoading}
                    emptyMessage="No persisted points for this match yet — run Sync on the Scoreboard Sheets tab."
                    renderScorecardDetail={renderModalScorecardDetail}
                  />
                )}
              </TabsContent>
            </Tabs>

            <div className="p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-slate-50 border-t border-slate-100 text-center shrink-0">
              <button
                type="button"
                onClick={closeModal}
                className="w-full sm:w-auto min-h-[48px] px-8 py-3 bg-white border border-slate-200 text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm touch-manipulation active:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
