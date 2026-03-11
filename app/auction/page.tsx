"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Gavel, Lock, Play, SkipForward, Trophy, XCircle, 
  Loader2, Users, Zap, ArrowUp, Pause, ChevronRight, Hand, Shuffle, RefreshCw 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, getPlayerImage } from "@/lib/utils";
import { TeamNamePrompt } from "@/components/auction/TeamNamePrompt";

// Pool configuration
const POOL_CONFIG: Record<string, { basePrice: number; minIncrement: number }> = {
  "Marquee":  { basePrice: 2,   minIncrement: 0.5  },
  "Pool 1":   { basePrice: 1.5, minIncrement: 0.25 },
  "Pool 2":   { basePrice: 1,   minIncrement: 0.25 },
  "Pool 3":   { basePrice: 0.5, minIncrement: 0.25 },
  "Unsold":   { basePrice: 0.5, minIncrement: 0.25 },
};

const POOL_ORDER = ["Marquee", "Pool 1", "Pool 2", "Pool 3", "Unsold"];

export default function AuctionPage() {
  const [profile, setProfile] = useState<any>(null);
  const [auctionConfig, setAuctionConfig] = useState<any>(null);
  const [auctionState, setAuctionState] = useState<any>(null);
  const [currentPlayer, setCurrentPlayer] = useState<any>(null);
  const [bidHistory, setBidHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [poolCounts, setPoolCounts] = useState<Record<string, { total: number; remaining: number }>>({});
  const [startPool, setStartPool] = useState("Marquee");
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [selectionMethod, setSelectionMethod] = useState<"random" | "manual">("random");
  const [pendingPlayers, setPendingPlayers] = useState<any[]>([]);
  const [manualPickId, setManualPickId] = useState<string>("");

  const isAdmin = profile?.role === "Admin";
  const isParticipant = profile?.role === "Admin" || profile?.role === "Participant";

  // ─── Data Fetching ───
  const fetchAll = useCallback(async () => {
    // Public data (no auth needed — viewers can see this)
    const { data: config } = await supabase.from("auction_config").select("*").limit(1).single();
    setAuctionConfig(config);

    const { data: state } = await supabase.from("auction_state").select("*").limit(1).single();
    setAuctionState(state);

    // Current player
    if (state?.current_player_id) {
      const { data: player } = await supabase.from("players").select("*").eq("id", state.current_player_id).single();
      setCurrentPlayer(player);

      const { data: bids } = await supabase
        .from("bids")
        .select("*")
        .eq("player_id", state.current_player_id)
        .order("created_at", { ascending: false })
        .limit(20);
      setBidHistory(bids || []);
    } else {
      setCurrentPlayer(null);
      setBidHistory([]);
    }

    // Pool counts
    const { data: allPlayers } = await supabase.from("players").select("pool, auction_status");
    if (allPlayers) {
      const counts: Record<string, { total: number; remaining: number }> = {};
      for (const pool of POOL_ORDER) {
        const poolPlayers = allPlayers.filter(p => p.pool === pool);
        counts[pool] = {
          total: poolPlayers.length,
          remaining: poolPlayers.filter(p => p.auction_status === "pending").length,
        };
      }
      setPoolCounts(counts);

      // Pending players in current pool (for manual pick)
      const currentPoolName = config?.current_pool || "Marquee";
      const poolPending = allPlayers.filter(p => p.pool === currentPoolName && p.auction_status === "pending");
      setPendingPlayers(poolPending);
    }

    // All profiles (for franchise status panel) — only participants/admins
    const { data: profiles } = await supabase.from("profiles").select("*");
    if (profiles) {
      const participants = profiles.filter(p => p.role === "Admin" || p.role === "Participant");
      setAllProfiles(participants);
      setTotalParticipants(participants.length);
    }

    // Auth-dependent data (profile)
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      setProfile(prof);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();

    // Real-time subscriptions
    const channel = supabase
      .channel("auction-room")
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_state" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_config" }, () => fetchAll())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bids" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => fetchAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  // Helper: get singleton row IDs fresh from DB (avoids stale React state)
  const getAuctionIds = async () => {
    const { data: config } = await supabase.from("auction_config").select("id").limit(1).single();
    const { data: state } = await supabase.from("auction_state").select("id").limit(1).single();
    return { configId: config?.id, stateId: state?.id };
  };

  const freezePools = async () => {
    setActionLoading(true);
    const { configId } = await getAuctionIds();
    await supabase.from("auction_config").update({ pools_frozen: true, status: "frozen", updated_at: new Date().toISOString() }).eq("id", configId);
    await fetchAll();
    setActionLoading(false);
  };

  const startAuction = async () => {
    setActionLoading(true);
    const { configId } = await getAuctionIds();
    await supabase.from("auction_config").update({ status: "live", current_pool: startPool, updated_at: new Date().toISOString() }).eq("id", configId);
    await pickNextPlayer(startPool);
    setActionLoading(false);
  };

  const switchPool = async (pool: string) => {
    setActionLoading(true);
    const { configId } = await getAuctionIds();
    await supabase.from("auction_config").update({ current_pool: pool, updated_at: new Date().toISOString() }).eq("id", configId);
    await pickNextPlayer(pool);
    setActionLoading(false);
  };

  const pickNextPlayer = async (pool: string, specificPlayerId?: string) => {
    const { configId, stateId } = await getAuctionIds();

    // Get pending players from pool
    const { data: pending } = await supabase
      .from("players")
      .select("*")
      .eq("pool", pool)
      .eq("auction_status", "pending");

    if (!pending || pending.length === 0) {
      // Pool exhausted — move to next
      const currentIndex = POOL_ORDER.indexOf(pool);
      if (currentIndex < POOL_ORDER.length - 1) {
        const nextPool = POOL_ORDER[currentIndex + 1];
        await supabase.from("auction_config").update({ current_pool: nextPool, updated_at: new Date().toISOString() }).eq("id", configId);
        await pickNextPlayer(nextPool);
      } else {
        await supabase.from("auction_config").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", configId);
        await supabase.from("auction_state").update({
          status: "waiting",
          current_player_id: null,
          current_bid: 0,
          current_bidder_id: null,
          current_bidder_name: null,
          passed_user_ids: [],
        }).eq("id", stateId);
        setSelectionMethod("random");
        await fetchAll();
      }
      return;
    }

    // Pick player: specific or random
    let chosenPlayer;
    if (specificPlayerId) {
      chosenPlayer = pending.find(p => p.id === specificPlayerId);
      if (!chosenPlayer) chosenPlayer = pending[Math.floor(Math.random() * pending.length)];
      setSelectionMethod("manual");
    } else {
      chosenPlayer = pending[Math.floor(Math.random() * pending.length)];
      setSelectionMethod("random");
    }

    const poolCfg = POOL_CONFIG[pool] || POOL_CONFIG["Pool 3"];

    // Update player AND auction state in rapid succession (state first so UI updates atomically)
    await supabase.from("auction_state").update({
      current_player_id: chosenPlayer.id,
      status: "active",
      base_price: poolCfg.basePrice,
      current_bid: poolCfg.basePrice,
      current_bidder_id: null,
      current_bidder_name: null,
      min_increment: poolCfg.minIncrement,
      passed_user_ids: [],
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", stateId);

    await supabase.from("players").update({ auction_status: "on_block" }).eq("id", chosenPlayer.id);

    await fetchAll();
  };

  const markSold = async () => {
    if (!auctionState?.current_bidder_id || !currentPlayer) return;
    setActionLoading(true);
    const { stateId } = await getAuctionIds();

    // Capture values before any updates
    const buyerId = auctionState.current_bidder_id;
    const buyerName = auctionState.current_bidder_name;
    const salePrice = auctionState.current_bid;
    const playerId = currentPlayer.id;

    // Update player record
    await supabase.from("players").update({
      status: "Sold",
      auction_status: "sold",
      sold_to: buyerName,
      sold_price: `${salePrice} Cr`,
    }).eq("id", playerId);

    // Deduct budget from buyer
    const { data: buyer } = await supabase.from("profiles").select("budget").eq("id", buyerId).single();
    if (buyer) {
      await supabase.from("profiles").update({
        budget: buyer.budget - salePrice,
      }).eq("id", buyerId);
    }

    // Update auction state
    await supabase.from("auction_state").update({
      status: "sold",
      updated_at: new Date().toISOString(),
    }).eq("id", stateId);

    await fetchAll();
    setActionLoading(false);
  };

  const markUnsold = async () => {
    if (!currentPlayer) return;
    setActionLoading(true);
    const { stateId } = await getAuctionIds();

    // Move player to Unsold pool so they can be re-auctioned
    await supabase.from("players").update({ 
      auction_status: "pending",
      pool: "Unsold",
    }).eq("id", currentPlayer.id);
    await supabase.from("auction_state").update({
      status: "unsold",
      updated_at: new Date().toISOString(),
    }).eq("id", stateId);

    await fetchAll();
    setActionLoading(false);
  };

  // Skip current player (put back to pending, pick another)
  const skipPlayer = async () => {
    if (!currentPlayer) return;
    setActionLoading(true);
    
    // Put current player back to pending
    await supabase.from("players").update({ auction_status: "pending" }).eq("id", currentPlayer.id);
    
    // Pick a new one from current pool
    const { data: freshConfig } = await supabase.from("auction_config").select("current_pool").limit(1).single();
    await pickNextPlayer(freshConfig?.current_pool || "Marquee");
    setActionLoading(false);
  };

  const nextPlayer = async () => {
    setActionLoading(true);
    // Fetch fresh config to get the current pool
    const { data: freshConfig } = await supabase.from("auction_config").select("current_pool").limit(1).single();
    await pickNextPlayer(freshConfig?.current_pool || "Marquee");
    setActionLoading(false);
  };

  // Pick a specific player (manual selection)
  const pickSpecificPlayer = async () => {
    if (!manualPickId) return;
    setActionLoading(true);
    const { data: freshConfig } = await supabase.from("auction_config").select("current_pool").limit(1).single();
    await pickNextPlayer(freshConfig?.current_pool || "Marquee", manualPickId);
    setManualPickId("");
    setActionLoading(false);
  };

  // ─── Participant Bid ───
  const placeBid = async () => {
    if (!profile || !auctionState || !currentPlayer) return;
    setActionLoading(true);

    const newBid = auctionState.current_bid + auctionState.min_increment;

    // Check budget
    if (newBid > profile.budget) {
      alert("Insufficient purse! You cannot afford this bid.");
      setActionLoading(false);
      return;
    }

    // Insert bid
    await supabase.from("bids").insert({
      player_id: currentPlayer.id,
      bidder_id: profile.id,
      bidder_name: profile.full_name || profile.team_name || "Unknown",
      amount: newBid,
    });
    // Update auction state
    const { stateId: bidStateId } = await getAuctionIds();
    await supabase.from("auction_state").update({
      current_bid: newBid,
      current_bidder_id: profile.id,
      current_bidder_name: profile.team_name || profile.full_name || "Unknown",
      updated_at: new Date().toISOString(),
    }).eq("id", bidStateId);

    await fetchAll();
    setActionLoading(false);
  };

  // ─── Pass / Out ───
  const passOnPlayer = async () => {
    if (!profile) return;
    setActionLoading(true);

    const { stateId } = await getAuctionIds();
    // Fetch fresh state to avoid stale passed_user_ids
    const { data: freshState } = await supabase.from("auction_state").select("*").eq("id", stateId).single();
    if (!freshState) { setActionLoading(false); return; }

    const currentPassed: string[] = freshState.passed_user_ids || [];
    if (currentPassed.includes(profile.id)) {
      setActionLoading(false);
      return;
    }

    const newPassed = [...currentPassed, profile.id];

    // Update auction state with new pass
    await supabase.from("auction_state").update({
      passed_user_ids: newPassed,
      updated_at: new Date().toISOString(),
    }).eq("id", stateId);

    // Check if ALL participants have passed → auto unsold
    if (newPassed.length >= totalParticipants && totalParticipants > 0) {
      if (freshState.current_player_id) {
        await supabase.from("players").update({ auction_status: "unsold" }).eq("id", freshState.current_player_id);
      }
      await supabase.from("auction_state").update({ status: "unsold", updated_at: new Date().toISOString() }).eq("id", stateId);
    }

    await fetchAll();
    setActionLoading(false);
  };

  // ─── Render ───
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFDFF] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isLive = auctionConfig?.status === "live";
  const isActive = auctionState?.status === "active";
  const currentPool = auctionConfig?.current_pool || "Marquee";
  const poolConfig = POOL_CONFIG[currentPool] || POOL_CONFIG["Pool 3"];

  return (
    <div className="min-h-screen bg-[#FDFDFF] p-4 md:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Gavel className="h-5 w-5 text-blue-600" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Live Auction Room</span>
            </div>
            <h1 className="text-4xl font-black italic tracking-tighter uppercase text-slate-900 leading-none">The Bidding Arena</h1>
          </div>

          {/* Status Badge */}
          <div className={cn(
            "px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-3",
            auctionConfig?.status === "setup" && "bg-slate-100 text-slate-500",
            auctionConfig?.status === "frozen" && "bg-amber-50 text-amber-600 border border-amber-200",
            auctionConfig?.status === "live" && "bg-emerald-50 text-emerald-600 border border-emerald-200",
            auctionConfig?.status === "paused" && "bg-orange-50 text-orange-600 border border-orange-200",
            auctionConfig?.status === "completed" && "bg-blue-50 text-blue-600 border border-blue-200",
          )}>
            {auctionConfig?.status === "live" && <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />}
            {auctionConfig?.status?.toUpperCase() || "SETUP"}
          </div>
        </div>

        {/* Team Name Prompt */}
        {profile && profile.role !== "Viewer" && (
          <TeamNamePrompt profile={profile} onUpdated={fetchAll} />
        )}

        {/* ── Participant Status Panel ── */}
        {allProfiles.length > 0 && isLive && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 block mb-3">Franchise Status</span>
            <div className="flex flex-wrap gap-3">
              {allProfiles.map(p => {
                const hasPassed = (auctionState?.passed_user_ids || []).includes(p.id);
                const isHighest = auctionState?.current_bidder_id === p.id;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all text-sm font-bold",
                      isHighest
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : hasPassed
                          ? "bg-red-50 border-red-200 text-red-400 line-through opacity-60"
                          : "bg-slate-50 border-slate-100 text-slate-700"
                    )}
                  >
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="h-6 w-6 rounded-full" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500">
                        {p.team_name?.[0] || "?"}
                      </div>
                    )}
                    <span className="italic">{p.team_name || p.full_name || "New Franchise"}</span>
                    {isHighest && <Trophy size={12} className="text-emerald-600" />}
                    {hasPassed && <Hand size={12} className="text-red-400" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Pool Progress ── */}
        <div className="grid grid-cols-5 gap-3">
          {POOL_ORDER.map(pool => (
            <div key={pool} className={cn(
              "bg-white rounded-2xl p-4 border transition-all cursor-pointer hover:shadow-md",
              currentPool === pool && isLive ? "border-blue-300 ring-2 ring-blue-100 shadow-lg" : "border-slate-100",
              pool === "Unsold" && (poolCounts[pool]?.remaining ?? 0) > 0 && "border-amber-200 bg-amber-50/50"
            )}
            onClick={() => isAdmin && isLive && switchPool(pool)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{pool}</span>
                {currentPool === pool && isLive && <Zap size={12} className="text-blue-600" />}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900">{poolCounts[pool]?.remaining ?? "—"}</span>
                <span className="text-xs font-bold text-slate-300">/ {poolCounts[pool]?.total ?? "—"}</span>
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-300 mt-1 block">Remaining</span>
            </div>
          ))}
        </div>

        {/* ── Admin Controls ── */}
        {isAdmin && (
          <div className="bg-slate-900 rounded-[2rem] p-6 flex flex-wrap items-center gap-4">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/30 mr-auto">Auctioneer Console</span>

            {auctionConfig?.status === "setup" && (
              <Button onClick={freezePools} disabled={actionLoading} className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-6 flex gap-2">
                <Lock size={14} /> Freeze Pools
              </Button>
            )}

            {auctionConfig?.status === "frozen" && (
              <>
                <select
                  value={startPool}
                  onChange={(e) => setStartPool(e.target.value)}
                  className="h-10 px-4 rounded-xl bg-white/10 text-white font-bold text-sm border border-white/20 outline-none appearance-none cursor-pointer hover:bg-white/20 transition-all"
                >
                  {POOL_ORDER.map(p => <option key={p} value={p} className="text-slate-900">{p}</option>)}
                </select>
                <Button onClick={startAuction} disabled={actionLoading} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-6 flex gap-2">
                  <Play size={14} /> Start Auction
                </Button>
              </>
            )}

            {isLive && isActive && (
              <>
                <div className="h-6 w-[1px] bg-white/10" />
                <select
                  value={auctionConfig?.current_pool || "Marquee"}
                  onChange={(e) => switchPool(e.target.value)}
                  className="h-10 px-4 rounded-xl bg-white/10 text-white font-bold text-sm border border-white/20 outline-none cursor-pointer hover:bg-white/20 transition-all"
                >
                  {POOL_ORDER.map(p => <option key={p} value={p} className="text-slate-900">{p}</option>)}
                </select>
                <Button onClick={skipPlayer} disabled={actionLoading} className="bg-white/10 hover:bg-white/20 text-white/70 rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-5 flex gap-2 border border-white/10">
                  <Shuffle size={14} /> Skip
                </Button>
                <div className="h-6 w-[1px] bg-white/10" />
                <Button onClick={markSold} disabled={actionLoading || !auctionState?.current_bidder_id} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-6 flex gap-2 disabled:opacity-30">
                  <Trophy size={14} /> Sold
                </Button>
                <Button onClick={markUnsold} disabled={actionLoading} className="bg-red-500 hover:bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-6 flex gap-2">
                  <XCircle size={14} /> Unsold
                </Button>
              </>
            )}

            {isLive && (auctionState?.status === "sold" || auctionState?.status === "unsold") && (
              <>
                <select
                  value={auctionConfig?.current_pool || "Marquee"}
                  onChange={(e) => switchPool(e.target.value)}
                  className="h-10 px-4 rounded-xl bg-white/10 text-white font-bold text-sm border border-white/20 outline-none cursor-pointer hover:bg-white/20 transition-all"
                >
                  {POOL_ORDER.map(p => <option key={p} value={p} className="text-slate-900">{p}</option>)}
                </select>
                <Button onClick={nextPlayer} disabled={actionLoading} className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-6 flex gap-2">
                  <Shuffle size={14} /> Random Next
                </Button>
                <div className="h-6 w-[1px] bg-white/10" />
                <select
                  value={manualPickId}
                  onChange={(e) => setManualPickId(e.target.value)}
                  className="h-10 px-3 rounded-xl bg-white/10 text-white font-bold text-xs border border-white/20 outline-none cursor-pointer hover:bg-white/20 transition-all max-w-[180px]"
                >
                  <option value="" className="text-slate-900">Pick player...</option>
                  {pendingPlayers.map(p => <option key={p.id} value={p.id} className="text-slate-900">{p.player_name}</option>)}
                </select>
                <Button onClick={pickSpecificPlayer} disabled={actionLoading || !manualPickId} className="bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-5 flex gap-2 disabled:opacity-30">
                  <SkipForward size={14} /> Select
                </Button>
              </>
            )}
          </div>
        )}

        {/* ── Not Live State ── */}
        {!isLive && auctionConfig?.status !== "completed" && (
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-16 text-center flex flex-col items-center gap-6">
            <div className="h-24 w-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
              <Gavel size={48} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black italic uppercase text-slate-900 tracking-tight">
                {auctionConfig?.status === "setup" ? "Auction Not Started" : "Pools Frozen — Awaiting Launch"}
              </h2>
              <p className="text-slate-400 font-medium max-w-md mx-auto">
                {auctionConfig?.status === "setup"
                  ? "The auctioneer needs to freeze the player pools before the bidding can begin."
                  : "The pools have been locked. The auctioneer will start the bidding shortly."}
              </p>
            </div>
          </div>
        )}

        {/* ── Completed State ── */}
        {auctionConfig?.status === "completed" && (
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-16 text-center flex flex-col items-center gap-6">
            <div className="h-24 w-24 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
              <Trophy size={48} />
            </div>
            <h2 className="text-3xl font-black italic uppercase text-slate-900 tracking-tight">Auction Complete</h2>
            <p className="text-slate-400 font-medium">All pools have been exhausted. Check the dashboard for final squad compositions.</p>
          </div>
        )}

        {/* ── Live Auction Block ── */}
        {isLive && currentPlayer && isActive && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Player Card */}
            <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="p-8 flex flex-col md:flex-row items-center gap-8">
                <div className="h-32 w-32 rounded-[2rem] bg-slate-50 overflow-hidden ring-4 ring-white shadow-xl flex items-center justify-center text-slate-300 shrink-0">
                  {currentPlayer.image_url
                    ? <img src={getPlayerImage(currentPlayer.image_url)!} alt="" className="h-full w-full object-cover" />
                    : <Users size={48} />
                  }
                </div>
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                    <span className="text-[11px] font-black text-blue-600 italic uppercase">{currentPlayer.team}</span>
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">•</span>
                    <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded">{currentPool}</span>
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">•</span>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded flex items-center gap-1",
                      selectionMethod === "random" ? "text-blue-500 bg-blue-50" : "text-violet-600 bg-violet-50"
                    )}>
                      {selectionMethod === "random" ? <><Shuffle size={8} /> Random</> : <><SkipForward size={8} /> Selected</>}
                    </span>
                  </div>
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter text-slate-900 leading-none mb-2">{currentPlayer.player_name}</h2>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{currentPlayer.role} • {currentPlayer.country}</p>
                </div>
              </div>

              {/* Bid Display */}
              <div className="border-t border-slate-50 p-8 bg-slate-50/30">
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Base Price</span>
                    <span className="text-2xl font-black text-slate-900">{auctionState.base_price} <span className="text-sm text-slate-400">Cr</span></span>
                  </div>
                  <div className="border-x border-slate-100">
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 block mb-1">Current Bid</span>
                    <span className="text-4xl font-black text-emerald-600">{auctionState.current_bid} <span className="text-sm">Cr</span></span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Min Increment</span>
                    <span className="text-2xl font-black text-slate-900">+{auctionState.min_increment} <span className="text-sm text-slate-400">Cr</span></span>
                  </div>
                </div>

                {/* Current Highest Bidder */}
                {auctionState.current_bidder_name && (
                  <div className="mt-6 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-1 block">Highest Bidder</span>
                    <span className="text-lg font-black text-emerald-700 italic uppercase">{auctionState.current_bidder_name}</span>
                  </div>
                )}

                {/* Bid + Pass Buttons */}
                {profile && isParticipant && (
                  <div className="mt-6 space-y-3">
                    {/* Pass counter */}
                    {(auctionState.passed_user_ids?.length || 0) > 0 && (
                      <div className="text-center">
                        <span className="text-[9px] font-black uppercase tracking-widest text-red-400">
                          {auctionState.passed_user_ids.length} / {totalParticipants} passed
                        </span>
                      </div>
                    )}
                    <div className="flex justify-center gap-3">
                      <Button
                        onClick={placeBid}
                        disabled={
                          actionLoading || 
                          auctionState.current_bidder_id === profile?.id ||
                          (auctionState.passed_user_ids || []).includes(profile?.id)
                        }
                        className="h-14 px-10 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-200 active:scale-95 transition-all disabled:opacity-30 flex gap-3"
                      >
                        <ArrowUp size={18} />
                        Bid {(auctionState.current_bid + auctionState.min_increment).toFixed(2)} Cr
                      </Button>
                      <Button
                        onClick={passOnPlayer}
                        disabled={
                          actionLoading || 
                          (auctionState.passed_user_ids || []).includes(profile?.id)
                        }
                        className={cn(
                          "h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-all disabled:opacity-30 flex gap-2",
                          (auctionState.passed_user_ids || []).includes(profile?.id)
                            ? "bg-red-100 text-red-400 border border-red-200"
                            : "bg-red-500 hover:bg-red-600 text-white shadow-xl shadow-red-200"
                        )}
                      >
                        <Hand size={18} />
                        {(auctionState.passed_user_ids || []).includes(profile?.id) ? "Passed" : "Out"}
                      </Button>
                    </div>
                  </div>
                )}
                {/* Viewer notice */}
                {!profile && (
                  <div className="mt-6 text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">👁 Spectator Mode — Viewing Only</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bid History */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-50">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Bid History</span>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[450px]">
                {bidHistory.length > 0 ? (
                  <div className="divide-y divide-slate-50">
                    {bidHistory.map((bid, i) => (
                      <div key={bid.id} className={cn("px-6 py-4 flex items-center justify-between", i === 0 && "bg-emerald-50/50")}>
                        <div>
                          <span className="text-sm font-black text-slate-900 italic uppercase">{bid.bidder_name}</span>
                          <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest block">
                            {new Date(bid.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <span className={cn("text-lg font-black", i === 0 ? "text-emerald-600" : "text-slate-400")}>
                          {bid.amount} Cr
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center p-12 text-center">
                    <div className="space-y-2">
                      <Gavel size={24} className="mx-auto text-slate-200" />
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No bids yet</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Waiting for next player ── */}
        {isLive && (auctionState?.status === "sold" || auctionState?.status === "unsold") && (
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-12 text-center flex flex-col items-center gap-4">
            <div className={cn(
              "h-16 w-16 rounded-full flex items-center justify-center",
              auctionState.status === "sold" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
            )}>
              {auctionState.status === "sold" ? <Trophy size={32} /> : <XCircle size={32} />}
            </div>
            <h3 className="text-2xl font-black italic uppercase text-slate-900 tracking-tight">
              {currentPlayer?.player_name} — {auctionState.status === "sold" ? "SOLD!" : "UNSOLD"}
            </h3>
            {auctionState.status === "sold" && (
              <p className="text-lg font-bold text-emerald-600">
                {auctionState.current_bid} Cr → {auctionState.current_bidder_name}
              </p>
            )}
            {(
              <p className="text-slate-400 font-medium text-sm">Waiting for the auctioneer to bring the next player...</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
