"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Gavel, Lock, Play, SkipForward, Trophy, XCircle, 
  Loader2, Users, Zap, ArrowUp, Pause, ChevronRight, Hand, Shuffle, RefreshCw, Clock, Search, User, Shield, ArrowLeft, Settings, Save, History, Briefcase, Activity, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, getPlayerImage, iplColors } from "@/lib/utils";
import { TeamNamePrompt } from "@/components/auction/TeamNamePrompt";

// Pool configuration
const POOL_CONFIG: Record<string, { basePrice: number; minIncrement: number }> = {
  "Marquee":  { basePrice: 5,   minIncrement: 0.5  },
  "Pool 1":   { basePrice: 2,   minIncrement: 0.25 },
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
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [customBid, setCustomBid] = useState("");
  const [poolCounts, setPoolCounts] = useState<Record<string, { total: number; remaining: number }>>({});
  const [startPool, setStartPool] = useState("Marquee");
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [selectionMethod, setSelectionMethod] = useState<"random" | "manual">("random");
  const [playerSearch, setPlayerSearch] = useState("");
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [auctionTab, setAuctionTab] = useState<"live" | "history" | "teams">("live");
  const [selectionTab, setSelectionTab] = useState<string>("All");
  const [selectedPool, setSelectedPool] = useState<string>("Marquee");
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [pendingPlayers, setPendingPlayers] = useState<any[]>([]);
  const [manualPickId, setManualPickId] = useState<string>("");
  const [mySquad, setMySquad] = useState<any[]>([]);

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

    // Pool counts & All Players for History
    const { data: playersData } = await supabase.from("players").select("*");
    if (playersData) {
      setAllPlayers(playersData || []);
      const counts: Record<string, { total: number; remaining: number }> = {};
      for (const pool of POOL_ORDER) {
        const poolPlayers = playersData.filter(p => p.pool === pool);
        counts[pool] = {
          total: poolPlayers.length,
          remaining: poolPlayers.filter(p => p.auction_status === "pending" || p.auction_status === "on_block").length,
        };
      }
      setPoolCounts(counts);

      // Pending players in current pool (for manual pick)
      const currentPoolName = config?.current_pool || "Marquee";
      const poolPending = playersData.filter(p => p.pool === currentPoolName && p.auction_status === "pending");
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

      const { data: squad } = await supabase
        .from("players")
        .select("*")
        .eq("sold_to_id", session.user.id)
        .order("player_name", { ascending: true });
      setMySquad(squad || []);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => fetchAll());
      
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const onlineIds = Object.keys(state).map(k => (state[k][0] as any)?.presence?.key).filter(Boolean);
      setOnlineUsers(onlineIds);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ presence: { key: profile?.id || "anonymous" } });
      }
    });

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, fetchAll]);

  // Helper: get singleton row IDs fresh from DB (avoids stale React state)
  const getAuctionIds = async () => {
    const { data: c } = await supabase.from("auction_config").select("id").limit(1).single();
    const { data: s } = await supabase.from("auction_state").select("id").limit(1).single();
    return { configId: c?.id, stateId: s?.id };
  };

  const logAction = async (actionType: string, details: any = {}) => {
    if (!profile) return;
    await supabase.from("audit_logs").insert({
      admin_id: profile.id,
      admin_name: profile.team_name || profile.full_name || "Unknown",
      action_type: actionType,
      details,
    });
  };

  const returnToPool = async (player: any) => {
    if (!isAdmin) return;
    if (!confirm(`Are you sure you want to return ${player.player_name} to their original pool? This will remove them from ${player.sold_to}'s team.`)) return;

    setActionLoading(true);
    
    // Reset player status
    const { error } = await supabase
      .from("players")
      .update({
        status: "Available",
        auction_status: "pending",
        sold_to: null,
        sold_to_id: null,
        sold_price: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", player.id);

    if (error) {
      alert("Error returning player to pool: " + error.message);
    } else {
      await logAction("RETURN_TO_POOL", {
        player_id: player.id,
        player_name: player.player_name,
        previous_buyer: player.sold_to,
        previous_price: player.sold_price
      });
      await fetchAll();
    }
    
    setActionLoading(false);
  };

  // ─── Phase Actions ───
  const freezePools = async () => {
    setActionLoading(true);
    const { configId } = await getAuctionIds();
    await supabase.from("auction_config").update({ pools_frozen: true, status: "frozen", updated_at: new Date().toISOString() }).eq("id", configId);
    await logAction("FREEZE_POOLS");
    await fetchAll();
    setActionLoading(false);
  };

  const startAuction = async () => {
    setActionLoading(true);
    const { configId } = await getAuctionIds();
    await supabase.from("auction_config").update({ status: "live", current_pool: startPool, updated_at: new Date().toISOString() }).eq("id", configId);
    await logAction("START_AUCTION", { initial_pool: startPool });
    await pickNextPlayer(startPool);
    setActionLoading(false);
  };

  const pauseAuction = async () => {
    setActionLoading(true);
    const { configId } = await getAuctionIds();
    await supabase.from("auction_config").update({ status: "paused", updated_at: new Date().toISOString() }).eq("id", configId);
    await logAction("PAUSE_AUCTION");
    await fetchAll();
    setActionLoading(false);
  };

  const switchPool = async (pool: string) => {
    setActionLoading(true);
    const { configId } = await getAuctionIds();
    await supabase.from("auction_config").update({ current_pool: pool, updated_at: new Date().toISOString() }).eq("id", configId);
    await logAction("SWITCH_POOL", { new_pool: pool });
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
        await logAction("POOL_EXHAUSTED_MOVING_TO_NEXT", { exhausted_pool: pool, next_pool: nextPool });
        await pickNextPlayer(nextPool);
      } else {
        // Pool exhausted AND no more pools left
        await supabase.from("auction_config").update({ status: "paused", updated_at: new Date().toISOString() }).eq("id", configId);
        await supabase.from("auction_state").update({
          status: "waiting",
          current_player_id: null,
          current_bid: 0,
          current_bidder_id: null,
          current_bidder_name: null,
          passed_user_ids: [],
        }).eq("id", stateId);
        await logAction("AUCTION_PAUSED_ALL_POOLS_FINISHED");
        alert("All players in the final pool have been auctioned. Auction paused. If you wish to end the auction, it is an irreversible action — please do so from the Admin Command Center.");
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
      await logAction("PICK_SPECIFIC_PLAYER", { player_id: chosenPlayer.id, player_name: chosenPlayer.player_name, pool: pool });
    } else {
      chosenPlayer = pending[Math.floor(Math.random() * pending.length)];
      setSelectionMethod("random");
      await logAction("PICK_RANDOM_PLAYER", { player_id: chosenPlayer.id, player_name: chosenPlayer.player_name, pool: pool });
    }

    const poolCfg = POOL_CONFIG[pool] || POOL_CONFIG["Pool 3"];
    // Use player's specific base price from DB if available, fallback to pool default
    const basePrice = chosenPlayer.base_price_numeric ?? poolCfg.basePrice;

    // Update player AND auction state in rapid succession (state first so UI updates atomically)
    await supabase.from("auction_state").update({
      current_player_id: chosenPlayer.id,
      status: "active",
      base_price: basePrice,
      current_bid: basePrice,
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
      sold_to_id: buyerId,
    }).eq("id", playerId);

    // Update auction state
    await supabase.from("auction_state").update({
      status: "sold",
      updated_at: new Date().toISOString(),
    }).eq("id", stateId);

    await logAction("MARK_SOLD", {
      player_id: playerId,
      player_name: currentPlayer.player_name,
      buyer_id: buyerId,
      buyer_name: buyerName,
      sale_price: salePrice,
    });

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

    await logAction("MARK_UNSOLD", { player_id: currentPlayer.id, player_name: currentPlayer.player_name });

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
    await logAction("SKIP_PLAYER", { player_id: currentPlayer.id, player_name: currentPlayer.player_name, current_pool: freshConfig?.current_pool });
    await pickNextPlayer(freshConfig?.current_pool || "Marquee");
    setActionLoading(false);
  };

  const nextPlayer = async () => {
    setActionLoading(true);
    // Fetch fresh config to get the current pool
    const { data: freshConfig } = await supabase.from("auction_config").select("current_pool").limit(1).single();
    await logAction("NEXT_PLAYER", { current_pool: freshConfig?.current_pool });
    await pickNextPlayer(freshConfig?.current_pool || "Marquee");
    setActionLoading(false);
  };

  // Pick a specific player (manual selection)
  const pickSpecificPlayer = async (playerId?: string) => {
    const idToPick = playerId || manualPickId;
    if (!idToPick) return;
    setActionLoading(true);
    const { data: freshConfig } = await supabase.from("auction_config").select("current_pool").limit(1).single();
    await logAction("ADMIN_PICK_SPECIFIC_PLAYER", { player_id: idToPick, current_pool: freshConfig?.current_pool });
    await pickNextPlayer(freshConfig?.current_pool || "Marquee", idToPick);
    setManualPickId("");
    setActionLoading(false);
  };

  const endAuction = async () => {
    if (!isAdmin) return;
    if (!confirm("CRITICAL: Are you sure you want to END the auction? This is irreversible and will finalize all squads. Proceed only if the auction is fully complete.")) return;
    
    setActionLoading(true);
    const { configId } = await getAuctionIds();
    await supabase.from("auction_config").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", configId);
    await logAction("MANUAL_END_AUCTION");
    await fetchAll();
    setActionLoading(false);
  };

  // ─── Participant Bid ───
  const placeBid = async () => {
    if (!profile || !auctionState || !currentPlayer) return;
    setActionLoading(true);

    const isFirstBid = (auctionState.current_bid === 0 || auctionState.current_bid === null);
    const newBid = isFirstBid 
      ? auctionState.base_price 
      : auctionState.current_bid + auctionState.min_increment;

    await executeBid(newBid);
  };

  // Place a custom manual bid
  const placeCustomBid = async () => {
    if (!profile || !currentPlayer || !auctionState || !customBid) return;
    
    const bidAmount = parseFloat(customBid);
    if (isNaN(bidAmount)) {
      alert("Please enter a valid number");
      return;
    }

    const isFirstBid = auctionState.current_bid === 0;
    const minRequiredBid = isFirstBid 
      ? auctionState.base_price 
      : auctionState.current_bid + auctionState.min_increment;

    if (bidAmount < minRequiredBid) {
      alert(`Bid must be at least ${minRequiredBid} Cr`);
      return;
    }

    await executeBid(bidAmount);
    setCustomBid("");
  };

  // Shared bid execution logic
  const executeBid = async (newBid: number) => {
    setActionLoading(true);

    const totalSpent = mySquad.reduce((sum, p) => {
      const priceValue = typeof p.sold_price === 'string' 
        ? parseFloat(p.sold_price.replace(/[^\d.]/g, '')) 
        : (p.sold_price || 0);
      return sum + (isNaN(priceValue) ? 0 : priceValue);
    }, 0);

    const budget = auctionConfig?.budget_per_team || 150;
    const remainingPurse = budget - totalSpent;

    if (newBid > remainingPurse) {
      alert(`Insufficient purse! You have ${remainingPurse.toFixed(2)} Cr left.`);
      setActionLoading(false);
      return;
    }

    const { data: result, error: rpcError } = await supabase.rpc("place_bid", {
      p_player_id: currentPlayer.id,
      p_bidder_id: profile.id,
      p_bidder_name: profile.team_name || profile.full_name || "Unknown",
      p_amount: newBid
    });

    if (rpcError) {
      alert(`System Error: ${rpcError.message}`);
    } else if (result && !result.success) {
      alert(result.message);
    } else {
      await logAction("PLACE_BID", { 
        player_id: currentPlayer.id, 
        player_name: currentPlayer.player_name, 
        bidder_id: profile.id, 
        bidder_name: profile.team_name || profile.full_name, 
        amount: newBid 
      });
    }

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
  const maxPlayers = auctionConfig?.max_players ?? 25;

  const totalSpent = mySquad.reduce((sum, p) => {
    const val = typeof p.sold_price === 'string' ? parseFloat(p.sold_price.replace(/[^\d.]/g, '')) : (p.sold_price || 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
  const initialPurse = auctionConfig?.budget_per_team || 150;
  const remainingPurse = initialPurse - totalSpent;

  return (
    <div className="min-h-screen bg-[#FDFDFF] p-4 md:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Gavel className="h-5 w-5 text-blue-600" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">The Auction House</span>
            </div>
            <h1 className="text-4xl font-black italic tracking-tighter uppercase text-slate-900 leading-none">Auction Room</h1>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setAuctionTab("live")}
              className={cn(
                "px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                auctionTab === "live" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Live
            </button>
            <button
              onClick={() => setAuctionTab("teams")}
              className={cn(
                "px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                auctionTab === "teams" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Teams
            </button>
            <button
              onClick={() => setAuctionTab("history")}
              className={cn(
                "px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                auctionTab === "history" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              History
            </button>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-6">
            {profile && profile.role !== "Viewer" && (
              <div className="flex items-center gap-6 bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Remaining Purse</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-slate-900">{remainingPurse.toFixed(2)}</span>
                    <span className="text-[8px] font-black uppercase text-slate-400 mb-1">Cr</span>
                  </div>
                </div>
                <div className="h-8 w-[1px] bg-slate-100" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Players</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-slate-900">{mySquad.length}</span>
                    <span className="text-[8px] font-black uppercase text-slate-400 mb-1">/{maxPlayers}</span>
                  </div>
                </div>
              </div>
            )}
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
        </div>

        {auctionTab === "live" ? (
          <div className="space-y-8 animate-in fade-in duration-500">
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
                      isHighest ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                      hasPassed ? "bg-red-50 border-red-200 text-red-400 line-through opacity-60" :
                      "bg-slate-50 border-slate-100 text-slate-700"
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
            
            {auctionConfig?.status === "live" && (
              <Button 
                onClick={pauseAuction} 
                disabled={actionLoading} 
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-4 flex gap-2"
              >
                <Pause size={14} /> Pause
              </Button>
            )}

            {auctionConfig?.status === "paused" && (
              <Button 
                onClick={() => startAuction()} 
                disabled={actionLoading} 
                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-4 flex gap-2"
              >
                <Play size={14} /> Resume
              </Button>
            )}

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
                  {POOL_ORDER.filter(p => (poolCounts[p]?.remaining ?? 0) > 0).map(p => (
                    <option key={p} value={p} className="text-slate-900">{p} ({poolCounts[p]?.remaining} left)</option>
                  ))}
                  {POOL_ORDER.filter(p => (poolCounts[p]?.remaining ?? 0) > 0).length === 0 && (
                    <option value="" className="text-slate-900">No players left</option>
                  )}
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
                  {POOL_ORDER.filter(p => (poolCounts[p]?.remaining ?? 0) > 0).map(p => (
                    <option key={p} value={p} className="text-slate-900">{p} ({poolCounts[p]?.remaining} left)</option>
                  ))}
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
                  {POOL_ORDER.filter(p => (poolCounts[p]?.remaining ?? 0) > 0).map(p => (
                    <option key={p} value={p} className="text-slate-900">{p} ({poolCounts[p]?.remaining} left)</option>
                  ))}
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
                <Button onClick={() => pickSpecificPlayer()} disabled={actionLoading || !manualPickId} className="bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-5 flex gap-2 disabled:opacity-30">
                  <SkipForward size={14} /> Select
                </Button>
                <div className="h-6 w-[1px] bg-white/10 ml-4" />
                <div className="flex flex-col items-end">
                  <Button 
                    onClick={endAuction}
                    disabled={actionLoading}
                    className="bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 rounded-xl font-black uppercase text-[8px] tracking-[0.2em] h-10 px-4 transition-all"
                  >
                    End Auction ⚠️
                  </Button>
                  <span className="text-[7px] font-bold text-red-400 uppercase tracking-tighter mt-1 opacity-60">Irreversible Action</span>
                </div>
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

        {/* ── Waiting for Next Player State ── */}
        {isLive && (!currentPlayer || !isActive) && (
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-8 flex flex-col gap-6">
            {!isAdmin ? (
               <div className="py-16 flex flex-col items-center justify-center text-center">
                 <div className="h-20 w-20 rounded-full bg-slate-50 text-slate-300 animate-pulse mb-6 flex justify-center items-center">
                   <Clock size={40} />
                 </div>
                 <h2 className="text-3xl font-black italic uppercase text-slate-900 tracking-tight">Intermission</h2>
                 <p className="text-slate-400 font-medium mt-2 max-w-sm">Waiting for the Auctioneer to bring the next player to the block...</p>
               </div>
            ) : (
                 <div className="w-full">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 px-4">
                     <div className="flex flex-col">
                       <h2 className="text-2xl md:text-3xl font-black italic uppercase text-slate-900 tracking-tight">Select Next Player</h2>
                       <p className="text-sm font-bold text-slate-400">Click a player to place them on the block</p>
                     </div>
                     <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest self-start sm:self-auto border border-blue-100">
                       {currentPool} Pool
                     </div>
                   </div>

                   {/* Sub-tabs for Roles */}
                   <div className="flex flex-wrap gap-2 px-4 mb-6">
                     {["All", "Batter", "Bowler", "All-Rounder", "Wicketkeeper"].map(role => (
                       <button
                         key={role}
                         onClick={() => setSelectionTab(role)}
                         className={cn(
                           "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                           selectionTab === role 
                             ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200" 
                             : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                         )}
                       >
                         {role}
                       </button>
                     ))}
                   </div>
                   
                   {pendingPlayers.length === 0 ? (
                     <div className="py-16 text-center">
                       <div className="h-16 w-16 mx-auto rounded-full bg-slate-50 text-slate-300 flex justify-center items-center mb-4"><Users size={32} /></div>
                       <h3 className="text-lg font-black text-slate-900 uppercase">Pool Empty</h3>
                       <p className="text-slate-400 font-medium">No players remaining. Switch pools above.</p>
                     </div>
                   ) : (
                     <div className="max-w-2xl w-full mx-auto">
                       <div className="relative mb-4 px-4">
                         <Search size={18} className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-400" />
                         <input 
                           type="text" 
                           placeholder="Search by player name..." 
                           value={playerSearch}
                           onChange={(e) => setPlayerSearch(e.target.value)}
                           className="w-full h-12 pl-12 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-slate-900 placeholder:text-slate-400"
                         />
                       </div>
                       <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col max-h-[400px]">
                         <div className="overflow-y-auto w-full p-2 space-y-1">
                           {pendingPlayers
                             .filter(p => selectionTab === "All" || p.role === selectionTab)
                             .filter(p => p.player_name.toLowerCase().includes(playerSearch.toLowerCase()))
                             .length === 0 ? (
                             <div className="p-8 text-center text-sm font-bold text-slate-400">No players found matching your filters</div>
                           ) : (
                             pendingPlayers
                               .filter(p => selectionTab === "All" || p.role === selectionTab)
                               .filter(p => p.player_name.toLowerCase().includes(playerSearch.toLowerCase()))
                               .map(p => (
                               <button 
                                 key={p.id} 
                                 disabled={actionLoading}
                                 className="w-full p-3 rounded-xl hover:bg-blue-50 transition-all group flex items-center gap-4 text-left disabled:opacity-50 disabled:cursor-not-allowed" 
                                 onClick={() => {
                                   pickSpecificPlayer(p.id);
                                   setPlayerSearch("");
                                 }}
                               >
                                 <div className="h-10 w-10 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center text-slate-400 shrink-0">
                                   {p.image_url ? <img src={getPlayerImage(p.image_url)!} className="h-full w-full object-cover" alt=""/> : <User size={20} />}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                   <h3 className="font-black text-slate-900 truncate uppercase tracking-tight text-sm group-hover:text-blue-700 transition-colors">{p.player_name}</h3>
                                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{p.role} • {p.country}</p>
                                 </div>
                                 <div className="opacity-0 group-hover:opacity-100 h-8 w-8 rounded-full bg-blue-100 text-blue-600 transition-all flex items-center justify-center shrink-0">
                                   <SkipForward size={14} />
                                 </div>
                               </button>
                             ))
                           )}
                         </div>
                       </div>
                     </div>
                   )}
                 </div>
            )}
          </div>
        )}

          </div>
        ) : auctionTab === "teams" ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Legend - Ported from squads page */}
            <div className="flex flex-wrap gap-2 items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-2">IPL Team Legend:</span>
              {Object.entries(iplColors).map(([team, colors]: [string, any]) => (
                <div key={team} className={cn("px-2 py-1 flex items-center gap-1.5 rounded-lg border", colors.bg, colors.border)}>
                  <div className={cn("text-[9px] font-black uppercase tracking-widest", colors.text)}>{team}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
              {/* Sidebar - Teams List */}
              <div className="w-full lg:w-80 shrink-0 flex flex-col gap-2">
                {allProfiles.map(team => {
                   const teamPlayers = allPlayers.filter(p => p.sold_to_id === team.id || p.sold_to === team.team_name);
                   const isSelected = (activeTeamId === team.id) || (!activeTeamId && allProfiles[0]?.id === team.id);
                   if (!activeTeamId && allProfiles[0]?.id === team.id && !isSelected) {
                     // Initial state handled by ternary in UI below
                   }
                   
                   const spent = teamPlayers.reduce((sum, p) => {
                      const val = typeof p.sold_price === 'string' ? parseFloat(p.sold_price.replace(/[^\d.]/g, '')) : (p.sold_price || 0);
                      return sum + (isNaN(val) ? 0 : val);
                   }, 0);
                   const budget = auctionConfig?.budget_per_team || 150;
                   
                   return (
                    <button
                      key={team.id}
                      onClick={() => setActiveTeamId(team.id)}
                      className={cn(
                        "p-5 rounded-2xl border text-left transition-all relative overflow-hidden group",
                        isSelected
                          ? "bg-slate-900 border-slate-800 text-white shadow-xl scale-[1.02]" 
                          : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <Briefcase size={60} />
                        </div>
                      )}
                      <div className="relative z-10">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex justify-between items-center">
                          {team.full_name}
                          {isSelected && <Activity className="text-emerald-400 h-3 w-3" />}
                        </div>
                        <div className={cn(
                          "text-lg font-black uppercase tracking-tighter leading-none mb-3",
                          isSelected ? "text-white" : "text-slate-900"
                        )}>
                          {team.team_name || team.full_name}
                        </div>
                        
                        <div className="flex gap-4">
                          <div className="flex flex-col">
                             <span className={cn("text-[9px] font-black uppercase tracking-widest", isSelected ? "text-slate-400" : "text-slate-300")}>Purse Remaining</span>
                             <span className={cn("text-sm font-black italic", isSelected ? "text-emerald-400" : "text-slate-600")}>{(budget - spent).toFixed(2)} Cr</span>
                          </div>
                          <div className="flex flex-col">
                             <span className={cn("text-[9px] font-black uppercase tracking-widest", isSelected ? "text-slate-400" : "text-slate-300")}>Players</span>
                             <span className={cn("text-sm font-black italic", isSelected ? "text-blue-400" : "text-slate-600")}>{teamPlayers.length} / {auctionConfig?.max_players || 28}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                   );
                })}
              </div>

              {/* Detail Pane */}
              <div className="flex-1 w-full bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
                {(() => {
                  const activeTeam = allProfiles.find(t => t.id === activeTeamId) || allProfiles[0];
                  if (!activeTeam) return null;
                  
                  const teamPlayers = allPlayers.filter(p => p.sold_to_id === activeTeam.id || p.sold_to === activeTeam.team_name);
                  const spent = teamPlayers.reduce((sum, p) => {
                    const val = typeof p.sold_price === 'string' ? parseFloat(p.sold_price.replace(/[^\d.]/g, '')) : (p.sold_price || 0);
                    return sum + (isNaN(val) ? 0 : val);
                  }, 0);
                  const budget = auctionConfig?.budget_per_team || 150;
                  const remaining = budget - spent;
                  const avgSpent = teamPlayers.length > 0 ? spent / teamPlayers.length : 0;
                  const minRemaining = Math.max(0, (auctionConfig?.min_players || 23) - teamPlayers.length);
                  const maxRemaining = Math.max(0, (auctionConfig?.max_players || 28) - teamPlayers.length);

                  const batters = teamPlayers.filter(p => (p.role || '').toLowerCase().includes('batter') || (p.role || '').toLowerCase().includes('wk')).length;
                  const bowlers = teamPlayers.filter(p => (p.role || '').toLowerCase().includes('bowler')).length;
                  const allRounders = teamPlayers.filter(p => (p.role || '').toLowerCase().includes('all-rounder')).length;

                  return (
                    <>
                      {/* Header Detail */}
                      <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Live Roster For</span>
                          <h2 className="text-4xl font-black italic uppercase tracking-tighter text-slate-900">{activeTeam.team_name}</h2>
                          <div className="text-xs font-bold text-slate-500 tracking-widest mt-1 uppercase">{activeTeam.full_name}</div>
                        </div>
                        
                        <div className="flex flex-wrap gap-3">
                            <div className="p-3 bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center min-w-[80px]">
                              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Bat/WK</span>
                              <span className="text-xl font-black text-slate-800">{batters}</span>
                            </div>
                            <div className="p-3 bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center min-w-[80px]">
                              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Bowl</span>
                              <span className="text-xl font-black text-slate-800">{bowlers}</span>
                            </div>
                            <div className="p-3 bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center min-w-[80px]">
                              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">All-R</span>
                              <span className="text-xl font-black text-slate-800">{allRounders}</span>
                            </div>
                        </div>
                      </div>

                      {/* Squad Table - With Fixed Height & Scroll */}
                      <div className="flex-1 p-6 md:p-8 flex flex-col min-h-0 overflow-hidden">
                        <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
                        {teamPlayers.length === 0 ? (
                           <div className="h-48 flex items-center justify-center text-center text-slate-400 font-black uppercase tracking-widest bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                              No players acquired yet
                           </div>
                        ) : (
                          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse whitespace-nowrap">
                              <thead className="bg-slate-100">
                                <tr>
                                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Player Name</th>
                                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Team</th>
                                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Type</th>
                                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Role</th>
                                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Bid</th>
                                </tr>
                              </thead>
                              <tbody>
                                {teamPlayers.map(player => {
                                  return (
                                    <tr key={player.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                       <td className="px-6 py-4">
                                         <div className="flex items-center gap-4">
                                           <div className="h-10 w-10 shrink-0 bg-white rounded-lg overflow-hidden border border-slate-200">
                                              {player.image_url ? <img src={getPlayerImage(player.image_url)!} alt="" className="w-full h-full object-cover object-top" /> : <Users size={20} className="m-auto opacity-20 mt-2" />}
                                           </div>
                                           <span className="font-bold text-slate-900">{player.player_name}</span>
                                         </div>
                                       </td>
                                       <td className="px-6 py-4 text-center">
                                         <span className="text-sm font-black text-slate-700 italic">{player.team}</span>
                                       </td>
                                       <td className="px-6 py-4 text-center">
                                         <div className="flex flex-col items-center">
                                           <span className="text-sm font-semibold text-slate-700">{player.type}</span>
                                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{player.country}</span>
                                         </div>
                                       </td>
                                       <td className="px-6 py-4 text-center">
                                         <span className="text-xs font-black uppercase tracking-widest bg-slate-100 px-2 py-1 rounded text-slate-600">
                                           {player.role}
                                         </span>
                                       </td>
                                       <td className="px-6 py-4 text-right">
                                         <span className="text-lg font-black text-slate-900">
                                            {player.sold_price}
                                         </span>
                                       </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                        </div>

                        {/* Financial Summary - Simplified Budget Logic */}
                        <div className="mt-6 bg-slate-50 rounded-2xl border border-slate-200 p-5 shrink-0">
                           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Financial & Roster Summary</h3>
                           <div className="grid grid-cols-4 lg:grid-cols-7 gap-3">
                              <div className="p-2.5 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Bought</span>
                                <span className="text-lg font-black text-blue-600">{teamPlayers.length}</span>
                              </div>
                              <div className="p-2.5 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Min Left</span>
                                <span className="text-lg font-black text-amber-500">{minRemaining}</span>
                              </div>
                              <div className="p-2.5 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Max Left</span>
                                <span className="text-lg font-black text-slate-700">{maxRemaining}</span>
                              </div>
                              <div className="p-2.5 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Initial Purse</span>
                                <span className="text-lg font-black text-slate-900">{budget}</span>
                              </div>
                              <div className="p-2.5 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Used</span>
                                <span className="text-lg font-black text-rose-600">{spent.toFixed(2)}</span>
                              </div>
                              <div className="p-2.5 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5 whitespace-nowrap">Avg/Player</span>
                                <span className="text-lg font-black text-slate-600">{avgSpent.toFixed(2)}</span>
                              </div>
                              <div className="p-2.5 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm bg-emerald-50/50 border-emerald-100 lg:col-span-1 col-span-2">
                                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest block mb-0.5">Purse Remaining</span>
                                <span className="text-xl font-black text-emerald-600">{remaining.toFixed(2)}</span>
                              </div>
                           </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden animate-in fade-in duration-500 flex flex-col min-h-[600px]">
            <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <h2 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">Sold History</h2>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-2 flex items-center gap-2">
                  <History size={12} />
                  Archive of all successful acquisitions
                </p>
              </div>
              <div className="flex items-center gap-3">
                 <div className="text-sm font-black uppercase tracking-widest text-blue-600 px-5 py-2.5 bg-blue-50/50 border border-blue-100 rounded-2xl">
                   {allPlayers.filter(p => p.status === 'Sold').length} Players Acquired
                 </div>
              </div>
            </div>
            
            <div className="flex-1 p-6 md:p-8 flex flex-col min-h-0">
              {allPlayers.filter(p => p.status === 'Sold').length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-[2rem] border border-slate-100 border-dashed py-20 px-10">
                  <div className="h-20 w-20 bg-white rounded-3xl flex items-center justify-center text-slate-200 shadow-sm border border-slate-100 mb-6 group-hover:scale-110 transition-transform">
                    <History size={32} />
                  </div>
                  <h3 className="text-slate-900 font-black uppercase italic tracking-tighter text-lg mb-2">No History Yet</h3>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest max-w-[200px] leading-relaxed">The auction history will populate as players are sold on the block.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto no-scrollbar rounded-2xl border border-slate-200 shadow-sm bg-white">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead className="bg-slate-100 sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest pl-8">Player</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">IPL Team</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Sold To</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right pr-8">Final Bid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allPlayers
                        .filter(p => p.status === 'Sold')
                        .sort((a,b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
                        .map(player => (
                          <tr key={player.id} className="hover:bg-slate-50/80 transition-all group">
                            <td className="px-6 py-4 pl-8">
                              <div className="flex items-center gap-4">
                                <div className="h-12 w-12 shrink-0 bg-white rounded-xl overflow-hidden border border-slate-200 p-0.5 shadow-sm">
                                   <img 
                                     src={getPlayerImage(player.image_url) || undefined} 
                                     alt="" 
                                     className="w-full h-full object-cover object-top rounded-[10px]" 
                                   />
                                </div>
                                <div>
                                   <div className="font-black text-slate-900 uppercase tracking-tighter leading-none mb-1 group-hover:text-blue-600 transition-colors">{player.player_name}</div>
                                   <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100/50 px-1.5 py-0.5 rounded inline-block">{player.role}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                               <div className="flex flex-col items-center">
                                 <span className="text-sm font-black text-slate-700 italic">{player.team}</span>
                               </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                               <span className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest italic shadow-sm">
                                 {player.sold_to}
                               </span>
                            </td>
                            <td className="px-6 py-4 text-right pr-8 flex items-center justify-end gap-4">
                               <div className="flex items-baseline justify-end gap-1">
                                 <span className="text-2xl font-black tracking-tighter text-slate-900">{player.sold_price?.replace(' Cr', '')}</span>
                                 <span className="text-[10px] font-black italic text-slate-400">CR</span>
                               </div>

                               {isAdmin && (
                                 <button
                                   onClick={() => returnToPool(player)}
                                   disabled={actionLoading}
                                   className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-100 hover:bg-red-50 transition-all shadow-sm group/undo"
                                   title="Undo Sale / Return to Pool"
                                 >
                                   <RotateCcw className="h-4 w-4 group-hover/undo:rotate-[-45deg] transition-transform" />
                                 </button>
                               )}
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
