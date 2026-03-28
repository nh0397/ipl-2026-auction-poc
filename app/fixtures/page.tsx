"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Calendar, MapPin, Clock, ChevronDown, Trophy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Fixture {
  id: string;
  api_match_id: string;
  match_no: number;
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

function cleanShort(short: string | null): string {
  if (!short) return "";
  return short.endsWith("W") && short.length > 2 ? short.slice(0, -1) : short;
}

export default function FixturesPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "upcoming" | "completed">("all");
  
  const today = useMemo(() => getTodayIST(), []);

  useEffect(() => {
    const fetchFixtures = async () => {
      const { data, error } = await supabase
        .from("fixtures")
        .select("*")
        .order("match_no", { ascending: true });

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
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
            <div key={date} id={`date-${date}`}>
              {/* Date Divider */}
              <div className={cn(
                "flex items-center gap-3 mb-3 px-1",
              )}>
                <div className={cn(
                  "text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg",
                  isToday 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200" 
                    : isPast 
                      ? "bg-slate-200 text-slate-500" 
                      : "bg-slate-100 text-slate-600"
                )}>
                  {isToday ? "🏏 Today" : formatDate(date)}
                </div>
                {isToday && (
                  <span className="text-xs font-bold text-blue-600 animate-pulse">
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
                          Match {match.match_no}
                        </div>

                        {/* Teams */}
                        <div className="flex items-center justify-between gap-3 mb-4">
                          {/* Team 1 */}
                          <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                            {match.team1_img && (
                              <img 
                                src={match.team1_img} 
                                alt={match.team1_short || ""} 
                                className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl object-contain bg-slate-50 border border-slate-100 p-1 flex-shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-900 truncate">
                                {cleanShort(match.team1_short) || match.team1_name}
                              </div>
                              <div className="text-[10px] sm:text-xs font-bold text-slate-400 truncate hidden sm:block">
                                {match.team1_name}
                              </div>
                            </div>
                          </div>

                          {/* VS */}
                          <div className={cn(
                            "text-xs font-black uppercase px-3 py-1.5 rounded-xl flex-shrink-0",
                            isMatchToday && !isCompleted
                              ? "bg-blue-50 text-blue-600"
                              : isCompleted
                                ? "bg-slate-50 text-slate-400"
                                : "bg-slate-50 text-slate-500"
                          )}>
                            VS
                          </div>

                          {/* Team 2 */}
                          <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 justify-end text-right">
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-900 truncate">
                                {cleanShort(match.team2_short) || match.team2_name}
                              </div>
                              <div className="text-[10px] sm:text-xs font-bold text-slate-400 truncate hidden sm:block">
                                {match.team2_name}
                              </div>
                            </div>
                            {match.team2_img && (
                              <img 
                                src={match.team2_img} 
                                alt={match.team2_short || ""} 
                                className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl object-contain bg-slate-50 border border-slate-100 p-1 flex-shrink-0"
                              />
                            )}
                          </div>
                        </div>

                        {/* Meta info */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] sm:text-xs font-bold text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {formatTime(match.date_time_gmt)} IST
                          </div>
                          {match.venue && (
                            <div className="flex items-center gap-1.5 truncate">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{match.venue.split(",")[0]}</span>
                            </div>
                          )}
                        </div>
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
    </div>
  );
}
