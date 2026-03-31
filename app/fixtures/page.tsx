"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Calendar, MapPin, Clock, ChevronDown, Trophy, Loader2, XCircle, User, Zap, ChevronRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import ScorecardViewer from "@/components/scoreboard/ScorecardViewer";
import { adaptCricApiToScorecardViewer } from "@/lib/adapters/cricapiScorecard";

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

export default function FixturesPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "upcoming" | "completed">("all");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [scorecardData, setScorecardData] = useState<any>(null);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  
  const today = useMemo(() => getTodayIST(), []);

  useEffect(() => {
    const fetchFixtures = async () => {
      // Old source (ESPN-driven): .from("fixtures")
      const { data, error } = await supabase
        .from("fixtures_cricapi")
        .select("*")
        // `match_no` might not exist yet; date_time_gmt is always present in CricAPI payload.
        .order("date_time_gmt", { ascending: true });

      if (error) console.error("Error fetching fixtures:", error);
      if (data) setFixtures(data);
      setLoading(false);
    };
    fetchFixtures();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "upcoming") return fixtures.filter(f => f.match_date >= today);
    if (filter === "completed") return fixtures.filter(f => f.match_ended || f.match_date < today);
    return fixtures;
  }, [fixtures, filter, today]);

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

  // Scroll to today on load
  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        const el = document.getElementById(`date-${today}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [loading, today]);

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

  const totalMatches = fixtures.length;
  const completedCount = fixtures.filter(f => f.match_ended || f.match_date < today).length;
  const todayMatches = fixtures.filter(f => f.match_date === today);

  return (
    <div className="min-h-screen bg-slate-50">
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
              style={{ width: `${(completedCount / totalMatches) * 100}%` }}
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2">
            {([
              { key: "all", label: "All Matches", count: totalMatches },
              { key: "upcoming", label: "Upcoming", count: totalMatches - completedCount },
              { key: "completed", label: "Completed", count: completedCount },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all",
                  filter === tab.key
                    ? "bg-slate-900 text-white shadow-lg"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                )}
              >
                {tab.label}
                <span className={cn(
                  "ml-1.5 text-[10px] px-1.5 py-0.5 rounded-md font-black",
                  filter === tab.key ? "bg-white/20" : "bg-slate-200"
                )}>
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
              <div className={cn(
                "flex items-center gap-3 mb-3 px-1",
              )}>
                <div className={cn(
                  "text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl flex items-center gap-2",
                  isToday 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
                    : isPast 
                      ? "bg-slate-200 text-slate-500" 
                      : "bg-slate-100 text-slate-600"
                )}>
                  {isToday && <Zap className="h-3 w-3 fill-current animate-pulse" />}
                  {isToday ? "Today's Matches" : formatDate(date)}
                </div>
                {isToday && (
                  <span className="text-[10px] font-black text-blue-600/60 uppercase tracking-tighter">
                    {formatDate(date)}
                  </span>
                )}
                <div className="flex-1 border-t border-dashed border-slate-200" />
                {matches.length > 1 && (
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {matches.length} matches
                  </span>
                )}
              </div>

              {/* Match Cards */}
              <div className="space-y-3">
                {matches.map(match => {
                  const isMatchToday = match.match_date === today;
                  const isCompleted = match.match_ended || match.match_date < today;
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
                        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-500 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full animate-pulse">
                          <div className="h-1.5 w-1.5 bg-white rounded-full" />
                          LIVE
                        </div>
                      )}

                      {/* Completed badge */}
                      {isCompleted && !isLive && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          <Trophy className="h-3 w-3" />
                          Completed
                        </div>
                      )}

                      <div className="p-4 sm:p-5">
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
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-900 truncate">
                                {cleanShort(match.team1_short) || match.team1_name}
                              </div>
                            </div>
                          </div>

                          {/* VS / Score */}
                          <div className="flex flex-col items-center gap-1 flex-shrink-0 min-w-[60px]">
                            {match.scorecard?.livescore && match.scorecard.livescore !== "N/A" ? (
                              <div className={cn(
                                "text-sm font-black px-3 py-1.5 rounded-xl whitespace-nowrap shadow-sm border animate-in fade-in zoom-in duration-300",
                                isLive 
                                  ? "bg-red-50 text-red-600 border-red-100" 
                                  : "bg-slate-900 text-white border-slate-800"
                              )}>
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
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-900 truncate">
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
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] sm:text-xs font-bold text-slate-400">
                          {match.date_time_gmt && (
                            <div className="flex items-center gap-1.5 truncate">
                              <Clock className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">
                                {formatTime(match.date_time_gmt)} IST
                                {(() => {
                                  const local = formatLocalTime(match.date_time_gmt);
                                  return local.tz !== "IST" ? ` • ${local.time} ${local.tz}` : "";
                                })()}
                              </span>
                            </div>
                          )}
                          {match.venue && (
                            <div className="flex items-center gap-1.5 truncate">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{match.venue.split(",")[0]}</span>
                            </div>
                          )}
                        </div>

                        {/* View Scorecard Button / Pending Status */}
                        {match.match_ended && match.points_synced ? (
                          <div className="mt-4 pt-4 border-t border-slate-50">
                            <button
                               onClick={() => {
                                 setSelectedMatchId(match.api_match_id);
                                 setScorecardLoading(false);
                                 setScorecardData(adaptCricApiToScorecardViewer(match.scorecard));
                               }}
                               className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-slate-200 group"
                            >
                              <FileText className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-400 transition-colors" />
                              View Full Scorecard
                              <ChevronRight className="h-3.5 w-3.5 ml-1 opacity-50 group-hover:opacity-100 transition-opacity" />
                            </button>
                          </div>
                        ) : match.match_ended && !match.points_synced ? (
                          <div className="mt-4 pt-4 border-t border-slate-50">
                            <div className="flex items-center justify-center gap-2 py-3 bg-blue-50/50 rounded-xl text-[10px] font-black uppercase tracking-widest text-blue-600 border border-blue-100/50 italic">
                               <Loader2 className="h-3 w-3 animate-spin" />
                               Processing points
                            </div>
                          </div>
                        ) : (isMatchToday || isPast) && (
                          <div className="mt-4 pt-4 border-t border-slate-50">
                            <div className="flex items-center justify-center gap-2 py-3 bg-blue-50/50 rounded-xl text-[10px] font-black uppercase tracking-widest text-blue-600 border border-blue-100/50 italic">
                               <Zap className="h-3 w-3 animate-pulse fill-blue-600" />
                               Points available 30m after match
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Calendar className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <p className="text-lg font-black text-slate-300 uppercase tracking-tight">No matches found</p>
          </div>
        )}
      </div>

      {/* Scorecard Modal */}
      {selectedMatchId && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedMatchId(null)} />
          
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-500">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
                  <Trophy className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-lg font-black uppercase tracking-tight text-slate-900">
                    {scorecardData?.match_info?.title || "Full Scorecard"}
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    CricAPI scorecard
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedMatchId(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors group"
              >
                <XCircle className="h-6 w-6 text-slate-300 group-hover:text-slate-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-10 no-scrollbar">
              {scorecardLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                   <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing Stats...</p>
                </div>
              ) : scorecardData?.innings ? (
                <ScorecardViewer scorecard={scorecardData} />
              ) : null}
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
               <button 
                  onClick={() => setSelectedMatchId(null)}
                  className="px-8 py-3 bg-white border border-slate-200 text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm"
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
