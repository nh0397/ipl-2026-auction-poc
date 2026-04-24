"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { 
  Gavel, Lock, Play, SkipForward, Trophy, XCircle, 
  Loader2, Users, Zap, ArrowUp, Pause, ChevronRight, Hand, Shuffle, RefreshCw, Clock, Search, User, Shield, ArrowLeft, Settings, Save, History, Briefcase, Activity, RotateCcw, Download, Timer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, getPlayerImage, iplColors } from "@/lib/utils";
import { TeamNamePrompt } from "@/components/auction/TeamNamePrompt";

import { useAuth } from "@/components/auth/AuthProvider";

// Pool configuration
const POOL_CONFIG: Record<string, { basePrice: number; minIncrement: number }> = {
  "Marquee":  { basePrice: 5,   minIncrement: 0.5  },
  "Pool 1":   { basePrice: 2,   minIncrement: 0.5  }, // Was 0.25
  "Pool 2":   { basePrice: 1,   minIncrement: 0.25 }, // Stays 0.25
  "Pool 3":   { basePrice: 0.5, minIncrement: 0.1  }, // Was 0.25
  "Unsold":   { basePrice: 0.5, minIncrement: 0.1  }, // Was 0.25
};

const POOL_ORDER = ["Marquee", "Pool 1", "Pool 2", "Pool 3", "Unsold"];

/** Crore amounts: JS binary floats break sums like 0.7 + 0.1 (RPC would see 0.799999… and reject). */
function roundCr(n: number): number {
  return Number((Number(n) || 0).toFixed(2));
}

/** Lowest possible base price (for purse reservation when filling remaining squad slots). */
const MIN_PLAYER_BASE_PRICE_CR = 0.25;

export default function AuctionPage() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const role = profile?.role;
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
  const [passerNotification, setPasserNotification] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isLockedByPeer, setIsLockedByPeer] = useState(false);
  const [lockingPeerName, setLockingPeerName] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const lockTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isAdmin = role === "Admin";
  const isParticipant = role === "Admin" || role === "Participant";

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (auctionState?.status === "active" && auctionState?.started_at) {
      const startTime = new Date(auctionState.started_at).getTime();
      
      const updateTimer = () => {
        const now = new Date().getTime();
        const diff = Math.floor((now - startTime) / 1000);
        setElapsedSeconds(Math.max(0, diff));
      };

      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [auctionState?.status, auctionState?.started_at]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetTimer = async () => {
    const res = await supabase.from("auction_state").select("id").single();
    const stateId = res.data?.id;
    const now = new Date().toISOString();
    await supabase.from("auction_state").update({ started_at: now }).eq("id", stateId);
    
    // Broadcast immediate reset for smooth UI sync
    channelRef.current?.send({
       type: 'broadcast',
       event: 'timer_reset',
       payload: { started_at: now }
    });
    
    await fetchAuctionState();
  };

  // ─── Data Fetching ───
  const fetchAuctionState = useCallback(async () => {
    const { data: state } = await supabase.from("auction_state").select("*").limit(1).single();
    if (state) {
      setAuctionState(state);
      if (state.current_player_id) {
        // Fetch current player and bids in parallel
        const [playerRes, bidsRes] = await Promise.all([
          supabase.from("players").select("*").eq("id", state.current_player_id).single(),
          supabase.from("bids")
            .select("*")
            .eq("player_id", state.current_player_id)
            .order("created_at", { ascending: false })
            .limit(20)
        ]);
        if (playerRes.data) setCurrentPlayer(playerRes.data);
        if (bidsRes.data) setBidHistory(bidsRes.data);
      } else {
        setCurrentPlayer(null);
        setBidHistory([]);
      }
    }
  }, []);

  const fetchPoolData = useCallback(async () => {
    const { data: playersData } = await supabase.from("players").select("*");
    if (playersData) {
      setAllPlayers(playersData);
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
      const { data: config } = await supabase.from("auction_config").select("current_pool").limit(1).single();
      const currentPoolName = config?.current_pool || "Marquee";
      const poolPending = playersData.filter(p => p.pool === currentPoolName && p.auction_status === "pending");
      setPendingPlayers(poolPending);
    }
  }, []);

  const fetchProfileData = useCallback(async () => {
    if (user) {
      const { data: squad } = await supabase
        .from("players")
        .select("*")
        .eq("sold_to_id", user.id)
        .order("player_name", { ascending: true });
      setMySquad(squad || []);
    }
  }, [user]);

  const fetchAll = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    try {
      if (!silent) setLoading(true);
      const { data: config } = await supabase.from("auction_config").select("*").limit(1).single();
      if (config) setAuctionConfig(config);

      await Promise.all([
        fetchAuctionState(),
        fetchPoolData(),
        fetchProfileData(),
        // All profiles (for franchise status panel)
        supabase.from("profiles").select("*").then(({ data: profiles }) => {
          if (profiles) {
            const participants = profiles.filter(p => p.role === "Admin" || p.role === "Participant");
            setAllProfiles(participants);
            setTotalParticipants(participants.length);
          }
        })
      ]);
    } catch (error) {
      console.error("Error fetching auction data:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [fetchAuctionState, fetchPoolData, fetchProfileData]);

  useEffect(() => {
    fetchAll();

    /** Tab sleep / background: realtime can miss events; resync when user returns. */
    let visibilityDebounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleResync = () => {
      if (document.visibilityState !== "visible") return;
      if (visibilityDebounce) clearTimeout(visibilityDebounce);
      visibilityDebounce = setTimeout(() => {
        void fetchAll({ silent: true });
      }, 250);
    };
    document.addEventListener("visibilitychange", scheduleResync);
    window.addEventListener("focus", scheduleResync);

    // Real-time subscriptions with Payload-First Sync
    const channel = supabase
      .channel("auction-room", { config: { broadcast: { self: false } } })

      // 0. Config (live/paused/completed, pool) — was missing; "Start auction" only touched this table
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_config" }, () => {
        void fetchAll({ silent: true });
      })

      // 1. Auction state — always refetch row + current player + bids (avoids partial merge / stale fields)
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_state" }, () => {
        void fetchAuctionState();
      })

      // 2. Sync Bids (Instant History Update + Clear Lock)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bids" }, (payload: any) => {
        const newBid = payload.new;
        setBidHistory(prev => {
          if (prev.some(b => b.id === newBid.id)) return prev;
          return [newBid, ...prev].slice(0, 20);
        });
        
        // Success! Another bid received, clear any peer lockout
        setIsLockedByPeer(false);
        setLockingPeerName(null);
        if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
      })

      // 3. Sync Player Status (Sold/Unsold/OnBlock)
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, (payload: any) => {
        const updatedPlayer = payload.new;
        setCurrentPlayer((prev: any) => {
          if (prev?.id === updatedPlayer.id) return { ...prev, ...updatedPlayer };
          return prev;
        });
        fetchPoolData();
      })

      // 4. Handle Fast UI Broadcasts (Bypasses DB)
      .on("broadcast", { event: "out" }, (payload) => {
        setPasserNotification(payload.payload.name);
        setTimeout(() => setPasserNotification(null), 3000);
      })
      .on("broadcast", { event: "timer_reset" }, (payload) => {
        setAuctionState((prev: any) => ({ ...prev, started_at: payload.payload.started_at }));
      })
      .on("broadcast", { event: "bidding_start" }, (payload) => {
         // Another user just clicked 'Bid'. Lock our UI for a short duration.
         setIsLockedByPeer(true);
         setLockingPeerName(payload.payload.name);
         
         // Safety timeout in case their RPC fails or network drops
         if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
         lockTimeoutRef.current = setTimeout(() => {
           setIsLockedByPeer(false);
           setLockingPeerName(null);
         }, 2500); 
      });
      
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const onlineIds = Object.keys(state).map(k => (state[k][0] as any)?.presence?.key).filter(Boolean);
      setOnlineUsers(onlineIds);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED" && profile?.id) {
        await channel.track({ presence: { key: profile.id } });
      }
    });

    channelRef.current = channel;

    return () => {
      document.removeEventListener("visibilitychange", scheduleResync);
      window.removeEventListener("focus", scheduleResync);
      if (visibilityDebounce) clearTimeout(visibilityDebounce);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [profile?.id, fetchAuctionState, fetchPoolData, fetchAll]);

  /**
   * While the auction is live, poll DB state — Realtime WebSocket can miss updates (sleeping tabs,
   * reconnect gaps, browser quirks). Polling keeps all participants in sync without refresh.
   */
  useEffect(() => {
    if (auctionConfig?.status !== "live") return;

    const poll = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void fetchAuctionState();
      void fetchPoolData();
    };

    poll();
    const id = setInterval(poll, 2500);
    return () => clearInterval(id);
  }, [auctionConfig?.status, fetchAuctionState, fetchPoolData]);

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
        pool: player.base_pool || player.pool, // Restore to original pool if tracked
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
      await fetchAll({ silent: true });
    }
    
    setActionLoading(false);
  };

  // ─── Phase Actions ───
  const freezePools = async () => {
    setActionLoading(true);
    const { configId } = await getAuctionIds();
    await supabase.from("auction_config").update({ pools_frozen: true, status: "frozen", updated_at: new Date().toISOString() }).eq("id", configId);
    await logAction("FREEZE_POOLS");
    await fetchAll({ silent: true });
    setActionLoading(false);
  };

  const startAuction = async () => {
    setActionLoading(true);
    const { configId } = await getAuctionIds();
    await supabase.from("auction_config").update({ status: "live", current_pool: startPool, updated_at: new Date().toISOString() }).eq("id", configId);
    await logAction("START_AUCTION", { initial_pool: startPool });
    // Removed auto-pickNextPlayer(startPool) to ensure manual selection
    await fetchAll({ silent: true });
    setActionLoading(false);
  };

  const pauseAuction = async () => {
    setActionLoading(true);
    const { configId } = await getAuctionIds();
    await supabase.from("auction_config").update({ status: "paused", updated_at: new Date().toISOString() }).eq("id", configId);
    await logAction("PAUSE_AUCTION");
    await fetchAll({ silent: true });
    setActionLoading(false);
  };

  const switchPool = async (pool: string) => {
    setActionLoading(true);
    const { configId } = await getAuctionIds();
    await supabase.from("auction_config").update({ current_pool: pool, updated_at: new Date().toISOString() }).eq("id", configId);
    await logAction("SWITCH_POOL", { new_pool: pool });
    // Removed auto-pickNextPlayer(pool) to ensure manual selection
    await fetchAll({ silent: true });
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
        // Instead of pickNextPlayer(nextPool), just pause/wait for manual intervention
        await supabase.from("auction_state").update({ status: "waiting", current_player_id: null }).eq("id", stateId);
        await fetchAll({ silent: true });
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
        await fetchAll({ silent: true });
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
      current_bid: 0,
      current_bidder_id: null,
      current_bidder_name: null,
      min_increment: poolCfg.minIncrement,
      passed_user_ids: [],
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", stateId);

    await supabase.from("players").update({ auction_status: "on_block" }).eq("id", chosenPlayer.id);

    await fetchAll({ silent: true });
  };

  const markSold = async () => {
    if (!auctionState?.current_bidder_id || !currentPlayer) return;
    setActionLoading(true);
    try {
      const { data: result, error } = await supabase.rpc("mark_current_player_sold");

      if (error) {
        alert(`System Error: ${error.message}`);
        return;
      }

      if (!result?.success) {
        alert(result?.message || "Could not mark player as sold.");
        return;
      }

      await logAction("MARK_SOLD", {
        player_id: result?.player_id || currentPlayer.id,
        player_name: result?.player_name || currentPlayer.player_name,
        buyer_id: result?.buyer_id || auctionState.current_bidder_id,
        buyer_name: result?.buyer_name || auctionState.current_bidder_name,
        sale_price: result?.sale_price ?? roundCr(auctionState.current_bid),
      });
    } finally {
      await fetchAll({ silent: true });
      setActionLoading(false);
    }
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

    await fetchAll({ silent: true });
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
    
    // First confirmation
    if (!confirm("CRITICAL: Are you sure you want to END the auction? This is irreversible and will finalize all squads. Proceed only if the auction is fully complete.")) return;

    // Second confirmation
    if (!confirm("FINAL WARNING: Once you click OK, the auction will be marked as COMPLETED. This action CANNOT be undone. Are you absolutely certain?")) return;
    
    setActionLoading(true);
    const { configId } = await getAuctionIds();
    await supabase.from("auction_config").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", configId);
    await logAction("MANUAL_END_AUCTION");
    await fetchAll({ silent: true });
    setActionLoading(false);
  };

  /** Same row selection as place_bid RPC — avoids stale React state when computing bids. */
  const fetchFreshAuctionStateRow = useCallback(async () => {
    const { data, error } = await supabase
      .from("auction_state")
      .select("*")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    return { row: data, error };
  }, []);

  const minRequiredFromState = (state: {
    current_bidder_id: string | null;
    base_price: number;
    current_bid: number;
    min_increment: number;
  }) =>
    roundCr(
      !state.current_bidder_id
        ? state.base_price
        : state.current_bid + state.min_increment
    );

  // ─── Participant Bid ───
  const placeBid = async () => {
    if (!profile || !currentPlayer) return;
    await executeBid({ mode: "quick" });
  };

  // Place a custom manual bid
  const placeCustomBid = async () => {
    if (!profile || !currentPlayer || !customBid) return;

    const bidAmount = parseFloat(customBid);
    if (isNaN(bidAmount)) {
      alert("Please enter a valid number");
      return;
    }

    await executeBid({ mode: "custom", amount: bidAmount });
    setCustomBid("");
  };

  // Shared bid execution: reads fresh DB row before RPC so the UI cannot lag Realtime.
  const executeBid = async (opts: { mode: "quick" } | { mode: "custom"; amount: number }) => {
    if (!profile || !currentPlayer) return;

    channelRef.current?.send({
      type: "broadcast",
      event: "bidding_start",
      payload: { name: profile?.team_name || profile?.full_name || "Someone" },
    });

    setActionLoading(true);

    const totalSpent = mySquad.reduce((sum, p) => {
      const priceValue =
        typeof p.sold_price === "string"
          ? parseFloat(p.sold_price.replace(/[^\d.]/g, ""))
          : p.sold_price || 0;
      return sum + (isNaN(priceValue) ? 0 : priceValue);
    }, 0);

    const budget = auctionConfig?.budget_per_team || 150;
    const remainingPurse = budget - totalSpent;
    const maxPlayersCfg = auctionConfig?.max_players || 28;
    const slotsRemaining = Math.max(0, maxPlayersCfg - mySquad.length);
    if (slotsRemaining <= 0) {
      alert(`Squad full: you already have ${mySquad.length}/${maxPlayersCfg} players.`);
      setActionLoading(false);
      return;
    }

    const maxQuickAttempts = 2;

    try {
      for (let attempt = 1; attempt <= maxQuickAttempts; attempt++) {
        const { row: fresh, error: fetchErr } = await fetchFreshAuctionStateRow();
        if (fetchErr || !fresh) {
          alert(fetchErr?.message || "Could not read auction state.");
          break;
        }

        if (fresh.current_player_id !== currentPlayer.id || fresh.status !== "active") {
          alert("This player is no longer on the block or bidding is not active.");
          await fetchAuctionState();
          break;
        }

        const playerId = fresh.current_player_id as string;
        const minReq = minRequiredFromState(fresh);
        let amount: number;
        if (opts.mode === "quick") {
          amount = minReq;
        } else {
          const custom = roundCr(opts.amount);
          if (custom < minReq) {
            alert(
              `Minimum bid is now ${minReq.toFixed(2)} Cr (display may have been a step behind).`
            );
            await fetchAuctionState();
            break;
          }
          amount = custom;
        }

        amount = roundCr(amount);

        if (amount > remainingPurse) {
          alert(`Insufficient purse! You have ${remainingPurse.toFixed(2)} Cr left.`);
          break;
        }

        // Reserve purse so the team can still fill remaining slots at minimum base price.
        const slotsAfterWin = Math.max(0, slotsRemaining - 1);
        const minReserve = roundCr(slotsAfterWin * MIN_PLAYER_BASE_PRICE_CR);
        const purseAfterWin = roundCr(remainingPurse - amount);
        if (purseAfterWin < minReserve) {
          alert(
            `You must keep at least ${minReserve.toFixed(2)} Cr reserved for the remaining ${slotsAfterWin} player(s) (min ${MIN_PLAYER_BASE_PRICE_CR.toFixed(2)} Cr each).`
          );
          break;
        }

        const { data: result, error: rpcError } = await supabase.rpc("place_bid", {
          p_player_id: playerId,
          p_bidder_id: profile.id,
          p_bidder_name: profile.team_name || profile.full_name || "Unknown",
          p_amount: amount,
        });

        if (rpcError) {
          alert(`System Error: ${rpcError.message}`);
          break;
        }

        if (result?.success) {
          await logAction("PLACE_BID", {
            player_id: playerId,
            player_name: currentPlayer.player_name,
            bidder_id: profile.id,
            bidder_name: profile.team_name || profile.full_name,
            amount,
          });
          break;
        }

        const msg = (result?.message as string) || "Could not place bid.";
        const tooLow = /bid too low|minimum required/i.test(msg);
        if (opts.mode === "quick" && tooLow && attempt < maxQuickAttempts) {
          continue;
        }

        alert(msg);
        break;
      }
    } finally {
      await fetchAll({ silent: true });
      setActionLoading(false);
    }
  };

  const downloadTeamCSV = (team: any, players: any[]) => {
    const headers = ["Player Name", "IPL Team", "Role", "Bid Price (Cr)"];
    const rows = players.map(p => [
      p.player_name,
      p.team,
      p.role || "N/A",
      p.sold_price || "0"
    ]);

    let csvContent = `Team: ${team.team_name || team.full_name}\n\n`;
    csvContent += headers.join(",") + "\n";
    csvContent += rows.map(r => r.map(cell => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${(team.team_name || team.full_name).replace(/\s+/g, '_')}_Roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

    // Broadcast immediate UI feedback
    channelRef.current?.send({
      type: 'broadcast',
      event: 'out',
      payload: { name: profile.team_name || profile.full_name || "Someone" }
    });

    // Check if ALL participants have passed → auto unsold
    if (newPassed.length >= totalParticipants && totalParticipants > 0) {
      if (freshState.current_player_id) {
        await supabase.from("players").update({ auction_status: "unsold" }).eq("id", freshState.current_player_id);
      }
      await supabase.from("auction_state").update({ status: "unsold", updated_at: new Date().toISOString() }).eq("id", stateId);
    }

    await fetchAll({ silent: true });
    setActionLoading(false);
  };

  // ─── Render ───
  if (loading) {
    return (
      <div className="min-h-screen min-w-0 bg-[#FDFDFF] p-3 sm:p-4 md:p-10 font-sans">
        <div className="max-w-7xl mx-auto min-w-0 px-2 sm:px-4 py-6 sm:py-8 space-y-8">
          <div className="flex items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="h-6 w-64 bg-slate-200 rounded-xl animate-pulse" />
              <div className="h-3 w-80 bg-slate-200 rounded-md animate-pulse" />
            </div>
            <div className="h-10 w-40 bg-slate-200 rounded-2xl animate-pulse" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-4">
                <div className="h-4 w-32 bg-slate-200 rounded-md animate-pulse" />
                <div className="h-10 w-24 bg-slate-200 rounded-xl animate-pulse" />
                <div className="h-3 w-2/3 bg-slate-200 rounded-md animate-pulse" />
              </div>
            ))}
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-6">
            <div className="flex items-center gap-6">
              <div className="h-28 w-28 bg-slate-200 rounded-[2rem] animate-pulse" />
              <div className="flex-1 space-y-3">
                <div className="h-6 w-56 bg-slate-200 rounded-xl animate-pulse" />
                <div className="h-4 w-80 bg-slate-200 rounded-lg animate-pulse" />
                <div className="h-4 w-64 bg-slate-200 rounded-lg animate-pulse" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-slate-200 rounded-2xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
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
    <div className="min-h-screen min-w-0 bg-[#FDFDFF] p-3 sm:p-4 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto min-w-0 px-2 sm:px-4 py-4 sm:py-8">
        {/* Pass Notification Overlay */}
        {passerNotification && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none px-4">
            <div className="bg-red-600 text-white px-6 py-6 sm:px-12 sm:py-8 rounded-3xl sm:rounded-[3rem] shadow-2xl shadow-red-500/50 animate-in zoom-in duration-300 flex flex-col items-center gap-2 border-4 sm:border-[8px] border-white max-w-[min(100%,24rem)] text-center">
              <span className="text-4xl sm:text-6xl font-black italic uppercase tracking-tighter">OUT!</span>
              <span className="text-base sm:text-2xl font-bold uppercase tracking-widest opacity-90 break-words max-w-full">{passerNotification}</span>
            </div>
          </div>
        )}

        {/* ── Tabs Navigation ── */}
        <div className="flex flex-col gap-4 sm:gap-6 min-w-0 w-full">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Gavel className="h-5 w-5 text-blue-600 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-blue-600">The Auction House</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black italic tracking-tighter uppercase text-slate-900 leading-none break-words">Auction Room</h1>
            </div>

            <div className="flex w-full min-w-0 sm:w-auto overflow-x-auto no-scrollbar sm:overflow-visible touch-pan-x">
              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-sm shrink-0 w-full min-[360px]:w-auto min-[360px]:min-w-0">
                {(["live", "teams", "history"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setAuctionTab(tab)}
                    className={cn(
                      "flex-1 min-[360px]:flex-none px-4 sm:px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      auctionTab === tab ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {tab === "live" ? "Live" : tab === "teams" ? "Teams" : "History"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4 lg:gap-6 min-w-0 w-full xl:justify-end">
            {profile && profile.role !== "Viewer" && (
              <div className="flex items-center justify-between sm:justify-start gap-4 sm:gap-6 bg-white px-4 sm:px-6 py-3 rounded-2xl border border-slate-100 shadow-sm min-w-0 w-full sm:w-auto max-w-full">
                <div className="flex flex-col min-w-0">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Remaining Purse</span>
                  <div className="flex items-baseline gap-1 min-w-0">
                    <span className="text-lg sm:text-xl font-black text-slate-900 tabular-nums truncate">{remainingPurse.toFixed(2)}</span>
                    <span className="text-[8px] font-black uppercase text-slate-400 mb-1 shrink-0">Cr</span>
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-100 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Players</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg sm:text-xl font-black text-slate-900 tabular-nums">{mySquad.length}</span>
                    <span className="text-[8px] font-black uppercase text-slate-400 mb-1 shrink-0">/{maxPlayers}</span>
                  </div>
                </div>
              </div>
            )}
            <div className={cn(
              "px-4 sm:px-6 py-3 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2 sm:gap-3 w-full sm:w-auto min-w-0",
              auctionConfig?.status === "setup" && "bg-slate-100 text-slate-500",
              auctionConfig?.status === "frozen" && "bg-amber-50 text-amber-600 border border-amber-200",
              auctionConfig?.status === "live" && "bg-emerald-50 text-emerald-600 border border-emerald-200",
              auctionConfig?.status === "paused" && "bg-orange-50 text-orange-600 border border-orange-200",
              auctionConfig?.status === "completed" && "bg-blue-50 text-blue-600 border border-blue-200",
            )}>
              {auctionConfig?.status === "live" && <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse shrink-0" />}
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
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {allProfiles.map(p => {
                const hasPassed = (auctionState?.passed_user_ids || []).includes(p.id);
                const isHighest = auctionState?.current_bidder_id === p.id;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl border transition-all text-xs sm:text-sm font-bold min-w-0 max-w-full",
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
                    <span className="italic truncate max-w-[11rem] sm:max-w-[14rem]">{p.team_name || p.full_name || "New Franchise"}</span>
                    {isHighest && <Trophy size={12} className="text-emerald-600" />}
                    {hasPassed && <Hand size={12} className="text-red-400" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Pool Progress ── */}
        <div className="grid grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 min-w-0 w-full">
          {POOL_ORDER.map(pool => (
            <div key={pool} className={cn(
              "bg-white rounded-2xl p-3 sm:p-4 border transition-all min-w-0 overflow-hidden",
              isAdmin && isLive && "cursor-pointer hover:shadow-md",
              currentPool === pool && isLive ? "border-blue-300 ring-2 ring-blue-100 shadow-lg" : "border-slate-100",
              pool === "Unsold" && (poolCounts[pool]?.remaining ?? 0) > 0 && "border-amber-200 bg-amber-50/50"
            )}
            onClick={() => isAdmin && isLive && switchPool(pool)}
            >
              <div className="flex items-center justify-between gap-1 mb-2 min-w-0">
                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-tight sm:tracking-widest text-slate-400 truncate">{pool}</span>
                {currentPool === pool && isLive && <Zap size={12} className="text-blue-600 shrink-0" />}
              </div>
              <div className="flex items-baseline gap-0.5 sm:gap-1 flex-wrap min-w-0">
                <span className="text-lg sm:text-2xl font-black text-slate-900 tabular-nums leading-none truncate min-w-0">{poolCounts[pool]?.remaining ?? "—"}</span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-300 shrink-0">/ {poolCounts[pool]?.total ?? "—"}</span>
              </div>
              <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-tight sm:tracking-widest text-slate-300 mt-1 block truncate">Remaining</span>
            </div>
          ))}
        </div>

        {/* ── Admin Controls ── */}
        {isAdmin && (
            <div className="bg-slate-900 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 flex flex-wrap items-center gap-2 sm:gap-3 min-w-0 w-full">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/30 w-full xl:w-auto xl:mr-auto">Auctioneer Console</span>
            
            {auctionConfig?.status === "live" && (
              <Button 
                onClick={pauseAuction} 
                disabled={actionLoading} 
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-4 flex gap-2 shrink-0"
              >
                <Pause size={14} /> Pause
              </Button>
            )}

            {auctionConfig?.status === "paused" && (
              <Button 
                onClick={() => startAuction()} 
                disabled={actionLoading} 
                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-4 flex gap-2 shrink-0"
              >
                <Play size={14} /> Resume
              </Button>
            )}

            {auctionConfig?.status === "setup" && (
              <Button onClick={freezePools} disabled={actionLoading} className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-6 flex gap-2 shrink-0">
                <Lock size={14} /> Freeze Pools
              </Button>
            )}

            {auctionConfig?.status === "frozen" && (
              <>
                <select
                  value={startPool}
                  onChange={(e) => setStartPool(e.target.value)}
                  className="h-10 px-3 sm:px-4 rounded-xl bg-white/10 text-white font-bold text-xs sm:text-sm border border-white/20 outline-none appearance-none cursor-pointer hover:bg-white/20 transition-all min-w-[10rem] sm:min-w-[12rem] max-w-full"
                >
                  {POOL_ORDER.filter(p => (poolCounts[p]?.remaining ?? 0) > 0).map(p => (
                    <option key={p} value={p} className="text-slate-900">{p} ({poolCounts[p]?.remaining} left)</option>
                  ))}
                  {POOL_ORDER.filter(p => (poolCounts[p]?.remaining ?? 0) > 0).length === 0 && (
                    <option value="" className="text-slate-900">No players left</option>
                  )}
                </select>
                <Button onClick={startAuction} disabled={actionLoading} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-5 sm:px-6 flex gap-2 shrink-0">
                  <Play size={14} /> Start Auction
                </Button>
              </>
            )}

            {isLive && isActive && (
              <>
                <div className="hidden xl:block h-6 w-[1px] bg-white/10" />
                <select
                  value={auctionConfig?.current_pool || "Marquee"}
                  onChange={(e) => switchPool(e.target.value)}
                  className="h-10 px-3 sm:px-4 rounded-xl bg-white/10 text-white font-bold text-xs sm:text-sm border border-white/20 outline-none cursor-pointer hover:bg-white/20 transition-all min-w-[10rem] sm:min-w-[12rem] max-w-full"
                >
                  {POOL_ORDER.filter(p => (poolCounts[p]?.remaining ?? 0) > 0).map(p => (
                    <option key={p} value={p} className="text-slate-900">{p} ({poolCounts[p]?.remaining} left)</option>
                  ))}
                </select>
                <Button onClick={skipPlayer} disabled={actionLoading} className="bg-white/10 hover:bg-white/20 text-white/70 rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-4 sm:px-5 flex gap-2 border border-white/10 shrink-0">
                  <Shuffle size={14} /> Skip
                </Button>
                <div className="hidden xl:block h-6 w-[1px] bg-white/10" />
                <Button onClick={resetTimer} disabled={actionLoading} className="bg-white/10 hover:bg-white/20 text-blue-400 rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-4 sm:px-5 flex gap-2 border border-white/10 shrink-0">
                  <Timer size={14} /> Reset Clock
                </Button>
                <div className="hidden xl:block h-6 w-[1px] bg-white/10" />
                <Button onClick={markSold} disabled={actionLoading || !auctionState?.current_bidder_id} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-5 sm:px-6 flex gap-2 disabled:opacity-30 shrink-0">
                  <Trophy size={14} /> Sold
                </Button>
                <Button 
                  onClick={markUnsold} 
                  disabled={actionLoading || (auctionState?.current_bid > 0)} 
                  className="bg-red-500 hover:bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-5 sm:px-6 flex gap-2 disabled:opacity-30 disabled:grayscale shrink-0"
                >
                  <XCircle size={14} /> Unsold
                </Button>
              </>
            )}

            {isLive && (auctionState?.status === "sold" || auctionState?.status === "unsold") && (
              <>
                <select
                  value={auctionConfig?.current_pool || "Marquee"}
                  onChange={(e) => switchPool(e.target.value)}
                  className="h-10 px-3 sm:px-4 rounded-xl bg-white/10 text-white font-bold text-xs sm:text-sm border border-white/20 outline-none cursor-pointer hover:bg-white/20 transition-all min-w-[10rem] sm:min-w-[12rem] max-w-full"
                >
                  {POOL_ORDER.filter(p => (poolCounts[p]?.remaining ?? 0) > 0).map(p => (
                    <option key={p} value={p} className="text-slate-900">{p} ({poolCounts[p]?.remaining} left)</option>
                  ))}
                </select>
                <Button onClick={nextPlayer} disabled={actionLoading} className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-5 sm:px-6 flex gap-2 shrink-0">
                  <Shuffle size={14} /> Random Next
                </Button>
                <div className="hidden xl:block h-6 w-[1px] bg-white/10" />
                <select
                  value={manualPickId}
                  onChange={(e) => setManualPickId(e.target.value)}
                  className="h-10 px-3 rounded-xl bg-white/10 text-white font-bold text-xs border border-white/20 outline-none cursor-pointer hover:bg-white/20 transition-all min-w-[10rem] sm:min-w-[11rem] max-w-full"
                >
                  <option value="" className="text-slate-900">Pick player...</option>
                  {pendingPlayers.map(p => <option key={p.id} value={p.id} className="text-slate-900">{p.player_name}</option>)}
                </select>
                <Button onClick={() => pickSpecificPlayer()} disabled={actionLoading || !manualPickId} className="bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-4 sm:px-5 flex gap-2 disabled:opacity-30 shrink-0">
                  <SkipForward size={14} /> Select
                </Button>
              </>
            )}
          </div>
        )}

        {/* ── Not Live State ── */}
        {!isLive && auctionConfig?.status !== "completed" && (
          <div className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-slate-100 shadow-sm p-8 sm:p-16 text-center flex flex-col items-center gap-6">
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
          <div className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-slate-100 shadow-sm p-8 sm:p-16 text-center flex flex-col items-center gap-6">
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
            <div className="xl:col-span-2 bg-white rounded-2xl sm:rounded-[2.5rem] border border-slate-100 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.05)] overflow-hidden relative min-w-0">
              {/* Timer Badge (Safe Overlay) */}
              <div className="absolute top-3 right-3 sm:top-6 sm:right-8 flex items-center gap-1.5 sm:gap-2 bg-slate-900 text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl shadow-lg z-10 max-w-[calc(100%-1.5rem)]">
                <Timer size={14} className="text-blue-400 animate-pulse shrink-0" />
                <span className="text-xs sm:text-sm font-black italic tracking-wider tabular-nums">{formatTime(elapsedSeconds)}</span>
              </div>
              <div className="p-4 pt-14 sm:pt-8 sm:p-8 flex flex-col md:flex-row items-center gap-6 sm:gap-8 min-w-0">
                <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-2xl sm:rounded-[2rem] bg-slate-50 overflow-hidden ring-4 ring-white shadow-xl flex items-center justify-center text-slate-300 shrink-0">
                  {currentPlayer.image_url
                    ? <img src={getPlayerImage(currentPlayer.image_url)!} alt="" className="h-full w-full object-cover" />
                    : <Users size={48} />
                  }
                </div>
                <div className="flex-1 min-w-0 text-center md:text-left">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 justify-center md:justify-start mb-2">
                    <span className="text-[10px] sm:text-[11px] font-black text-blue-600 italic uppercase break-all">{currentPlayer.team}</span>
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest hidden sm:inline">•</span>
                    <span className="text-[9px] font-black text-amber-600 uppercase tracking-tight sm:tracking-widest bg-amber-50 px-2 py-0.5 rounded shrink-0">{currentPool}</span>
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest hidden sm:inline">•</span>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-tight sm:tracking-widest px-2 py-0.5 rounded inline-flex items-center gap-1",
                      selectionMethod === "random" ? "text-blue-500 bg-blue-50" : "text-violet-600 bg-violet-50"
                    )}>
                      {selectionMethod === "random" ? <><Shuffle size={8} /> Random</> : <><SkipForward size={8} /> Selected</>}
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-slate-900 leading-tight mb-2 break-words">{currentPlayer.player_name}</h2>
                  <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-widest line-clamp-2">{currentPlayer.role} • {currentPlayer.country}</p>
                </div>
              </div>

              {/* Bid Display */}
              <div className="border-t border-slate-50 p-4 sm:p-8 bg-slate-50/30 min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-center sm:text-center divide-y sm:divide-y-0 divide-slate-200/80 sm:divide-x sm:divide-slate-100">
                  <div className="min-w-0 py-2 sm:py-0 first:pt-0 last:pb-0 sm:px-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Base Price</span>
                    <span className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums break-all">{auctionState.base_price} <span className="text-xs sm:text-sm text-slate-400">Cr</span></span>
                  </div>
                  <div className="min-w-0 py-2 sm:py-0 sm:px-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 block mb-1">Current Bid</span>
                    <span className="text-3xl sm:text-4xl font-black text-emerald-600 tabular-nums leading-none break-all block">{auctionState.current_bid} <span className="text-xs sm:text-sm align-baseline">Cr</span></span>
                  </div>
                  <div className="min-w-0 py-2 sm:py-0 last:pt-0 sm:px-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Min Increment</span>
                    <span className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums break-all">+{auctionState.min_increment} <span className="text-xs sm:text-sm text-slate-400">Cr</span></span>
                  </div>
                </div>

                {/* Current Highest Bidder */}
                {auctionState.current_bidder_name && (
                  <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center min-w-0">
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-1 block">Highest Bidder</span>
                    <span className="text-base sm:text-lg font-black text-emerald-700 italic uppercase break-words max-w-full">{auctionState.current_bidder_name}</span>
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
                    <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 w-full min-w-0 max-w-md mx-auto sm:max-w-none">
                      <Button
                        onClick={placeBid}
                        disabled={
                          actionLoading || 
                          isLockedByPeer ||
                          auctionState.current_bidder_id === profile?.id ||
                          (auctionState.passed_user_ids || []).includes(profile?.id)
                        }
                        className="h-14 w-full sm:w-auto sm:min-w-[10rem] px-4 sm:px-10 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-tighter sm:tracking-widest text-xs sm:text-sm shadow-xl shadow-blue-200 active:scale-95 transition-all disabled:opacity-30 flex gap-2 sm:gap-3 justify-center"
                      >
                        {isLockedByPeer ? (
                          <div className="flex items-center justify-center gap-2 min-w-0 text-left">
                            <Loader2 size={16} className="animate-spin text-blue-200 shrink-0" />
                            <span className="animate-pulse break-words leading-snug text-[11px] sm:text-sm">{lockingPeerName} is bidding…</span>
                          </div>
                        ) : (
                          <>
                            <ArrowUp size={18} className="shrink-0" />
                            <span className="tabular-nums">
                              Bid {roundCr(
                                !auctionState.current_bidder_id
                                  ? auctionState.base_price
                                  : auctionState.current_bid + auctionState.min_increment
                              ).toFixed(2)} Cr
                            </span>
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={passOnPlayer}
                        disabled={
                          actionLoading || 
                          isLockedByPeer ||
                          auctionState.current_bidder_id === profile?.id ||
                          (auctionState.passed_user_ids || []).includes(profile?.id)
                        }
                        className={cn(
                          "h-14 w-full sm:w-auto px-6 sm:px-8 rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-all disabled:opacity-30 flex gap-2 justify-center shrink-0",
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
                      <div key={bid.id} className={cn("px-4 sm:px-6 py-4 flex items-center justify-between gap-3 min-w-0", i === 0 && "bg-emerald-50/50")}>
                        <div className="min-w-0 flex-1 text-left">
                          <span className="text-sm font-black text-slate-900 italic uppercase block truncate">{bid.bidder_name}</span>
                          <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest block">
                            {new Date(bid.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <span className={cn("text-base sm:text-lg font-black tabular-nums shrink-0 text-right", i === 0 ? "text-emerald-600" : "text-slate-400")}>
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
            <div className="flex flex-wrap gap-2 items-center bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-sm min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1 sm:mr-2 w-full sm:w-auto shrink-0">IPL Team Legend:</span>
              {Object.entries(iplColors).map(([team, colors]: [string, any]) => (
                <div key={team} className={cn("px-2 py-1 flex items-center gap-1.5 rounded-lg border", colors.bg, colors.border)}>
                  <div className={cn("text-[9px] font-black uppercase tracking-widest", colors.text)}>{team}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col xl:flex-row gap-8 items-start">
              {/* Sidebar - Teams List */}
              <div className="w-full xl:w-80 shrink-0 flex flex-col gap-2">
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
              <div className="flex-1 w-full min-w-0 bg-white rounded-[1.5rem] sm:rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden min-h-[min(28rem,70vh)] sm:min-h-[600px] flex flex-col">
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
                      <div className="p-4 sm:p-8 border-b border-slate-50 bg-slate-50/30 flex flex-col xl:flex-row xl:items-center justify-between gap-4 sm:gap-6 min-w-0">
                        <div className="min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Live Roster For</span>
                          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-slate-900 break-words">{activeTeam.team_name}</h2>
                          <div className="text-xs font-bold text-slate-500 tracking-tight sm:tracking-widest mt-1 uppercase break-words">{activeTeam.full_name}</div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 sm:gap-3 items-stretch sm:items-center w-full xl:w-auto min-w-0">
                            <Button 
                              onClick={() => downloadTeamCSV(activeTeam, teamPlayers)}
                              variant="outline"
                              className="bg-white border-slate-200 hover:bg-slate-50 text-slate-600 font-black uppercase text-[10px] tracking-widest h-12 px-4 sm:px-6 rounded-2xl flex gap-2 w-full sm:w-auto"
                            >
                              <Download size={14} /> Download Roster CSV
                            </Button>

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
                        <div className="flex-1 overflow-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch] pr-0 sm:pr-2 no-scrollbar -mx-1 px-1 sm:mx-0 sm:px-0">
                        {teamPlayers.length === 0 ? (
                           <div className="h-48 flex items-center justify-center text-center text-slate-400 font-black uppercase tracking-widest bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                              No players acquired yet
                           </div>
                        ) : (
                          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-w-0">
                            <table className="w-full min-w-[520px] sm:min-w-0 sm:table-auto text-left border-collapse text-sm sm:text-base">
                              <thead className="bg-slate-100">
                                <tr>
                                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[9px] sm:text-[10px] font-black uppercase text-slate-500 tracking-tight sm:tracking-widest w-[32%] sm:w-auto">Player</th>
                                  <th className="px-2 sm:px-6 py-3 sm:py-4 text-[9px] sm:text-[10px] font-black uppercase text-slate-500 tracking-tight sm:tracking-widest text-center w-[16%]">Team</th>
                                  <th className="px-2 sm:px-6 py-3 sm:py-4 text-[9px] sm:text-[10px] font-black uppercase text-slate-500 tracking-tight sm:tracking-widest text-center w-[16%]">Type</th>
                                  <th className="px-2 sm:px-6 py-3 sm:py-4 text-[9px] sm:text-[10px] font-black uppercase text-slate-500 tracking-tight sm:tracking-widest text-center w-[16%]">Role</th>
                                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[9px] sm:text-[10px] font-black uppercase text-slate-500 tracking-tight sm:tracking-widest text-right w-[20%]">Bid</th>
                                </tr>
                              </thead>
                              <tbody>
                                {teamPlayers.map(player => {
                                  return (
                                    <tr key={player.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                       <td className="px-3 sm:px-6 py-3 sm:py-4 max-w-0">
                                         <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                                           <div className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 bg-white rounded-lg overflow-hidden border border-slate-200">
                                              {player.image_url ? <img src={getPlayerImage(player.image_url)!} alt="" className="w-full h-full object-cover object-top" /> : <Users size={20} className="m-auto opacity-20 mt-2" />}
                                           </div>
                                           <span className="font-bold text-slate-900 truncate min-w-0 text-xs sm:text-sm">{player.player_name}</span>
                                         </div>
                                       </td>
                                       <td className="px-2 sm:px-6 py-3 sm:py-4 text-center align-top">
                                         <span className="text-xs sm:text-sm font-black text-slate-700 italic break-words line-clamp-2">{player.team}</span>
                                       </td>
                                       <td className="px-2 sm:px-6 py-3 sm:py-4 text-center align-top">
                                         <div className="flex flex-col items-center gap-0.5 min-w-0">
                                           <span className="text-xs sm:text-sm font-semibold text-slate-700 break-words line-clamp-2">{player.type}</span>
                                           <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-tight sm:tracking-widest text-slate-400">{player.country}</span>
                                         </div>
                                       </td>
                                       <td className="px-2 sm:px-6 py-3 sm:py-4 text-center align-top">
                                         <span className="text-[10px] sm:text-xs font-black uppercase tracking-tight sm:tracking-widest bg-slate-100 px-1.5 sm:px-2 py-1 rounded text-slate-600 inline-block max-w-full break-words">
                                           {player.role}
                                         </span>
                                       </td>
                                       <td className="px-3 sm:px-6 py-3 sm:py-4 text-right align-top">
                                         <span className="text-sm sm:text-lg font-black text-slate-900 tabular-nums inline-block break-all text-right max-w-full">
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
                        <div className="mt-4 sm:mt-6 bg-slate-50 rounded-2xl border border-slate-200 p-3 sm:p-5 shrink-0 min-w-0">
                           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 sm:mb-4">Financial & Roster Summary</h3>
                           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3 min-w-0">
                              <div className="p-2 sm:p-2.5 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm min-w-0">
                                <span className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-tight sm:tracking-widest block mb-0.5">Bought</span>
                                <span className="text-base sm:text-lg font-black text-blue-600 tabular-nums">{teamPlayers.length}</span>
                              </div>
                              <div className="p-2 sm:p-2.5 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm min-w-0">
                                <span className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-tight sm:tracking-widest block mb-0.5">Min Left</span>
                                <span className="text-base sm:text-lg font-black text-amber-500 tabular-nums">{minRemaining}</span>
                              </div>
                              <div className="p-2 sm:p-2.5 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm min-w-0">
                                <span className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-tight sm:tracking-widest block mb-0.5">Max Left</span>
                                <span className="text-base sm:text-lg font-black text-slate-700 tabular-nums">{maxRemaining}</span>
                              </div>
                              <div className="p-2 sm:p-2.5 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm min-w-0">
                                <span className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-tight sm:tracking-widest block mb-0.5">Initial</span>
                                <span className="text-base sm:text-lg font-black text-slate-900 tabular-nums">{budget}</span>
                              </div>
                              <div className="p-2 sm:p-2.5 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm min-w-0">
                                <span className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-tight sm:tracking-widest block mb-0.5">Used</span>
                                <span className="text-base sm:text-lg font-black text-rose-600 tabular-nums break-all max-w-full">{spent.toFixed(2)}</span>
                              </div>
                              <div className="p-2 sm:p-2.5 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm min-w-0">
                                <span className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-tight sm:tracking-widest block mb-0.5 break-words text-center">Avg / Pl.</span>
                                <span className="text-base sm:text-lg font-black text-slate-600 tabular-nums break-all max-w-full">{avgSpent.toFixed(2)}</span>
                              </div>
                              <div className="p-2 sm:p-2.5 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm bg-emerald-50/50 border-emerald-100 col-span-2 sm:col-span-1 lg:col-span-1 min-w-0">
                                <span className="text-[7px] sm:text-[8px] font-black text-emerald-600 uppercase tracking-tight sm:tracking-widest block mb-0.5">Purse Left</span>
                                <span className="text-lg sm:text-xl font-black text-emerald-600 tabular-nums break-all max-w-full">{remaining.toFixed(2)}</span>
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
          <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden animate-in fade-in duration-500 flex flex-col min-h-[min(24rem,65vh)] sm:min-h-[600px] min-w-0">
            <div className="p-4 sm:p-8 border-b border-slate-50 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6">
              <div className="min-w-0">
                <h2 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-slate-900 leading-tight sm:leading-none break-words">Sold History</h2>
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
                <div className="flex-1 overflow-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch] no-scrollbar rounded-2xl border border-slate-200 bg-white shadow-sm -mx-1 px-1 sm:mx-0 sm:px-0 min-w-0">
                  <table className="w-full min-w-[520px] sm:min-w-0 border-collapse text-left text-sm sm:text-base">
                    <thead className="bg-slate-100 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 sm:py-5 text-[9px] sm:text-[10px] font-black uppercase text-slate-500 tracking-tight sm:tracking-widest pl-4 sm:pl-8">Player</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-5 text-[9px] sm:text-[10px] font-black uppercase text-slate-500 tracking-tight sm:tracking-widest text-center">IPL Team</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-5 text-[9px] sm:text-[10px] font-black uppercase text-slate-500 tracking-tight sm:tracking-widest text-center">Sold To</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-5 text-[9px] sm:text-[10px] font-black uppercase text-slate-500 tracking-tight sm:tracking-widest text-right pr-4 sm:pr-8">Final Bid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allPlayers
                        .filter(p => p.status === 'Sold')
                        .sort((a,b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
                        .map(player => (
                          <tr key={player.id} className="hover:bg-slate-50/80 transition-all group">
                            <td className="px-3 sm:px-6 py-3 sm:py-4 pl-4 sm:pl-8 max-w-0">
                              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                                <div className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 bg-white rounded-xl overflow-hidden border border-slate-200 p-0.5 shadow-sm">
                                   <img 
                                     src={getPlayerImage(player.image_url) || undefined} 
                                     alt="" 
                                     className="w-full h-full object-cover object-top rounded-[10px]" 
                                   />
                                </div>
                                <div className="min-w-0">
                                   <div className="font-black text-slate-900 uppercase tracking-tighter leading-tight sm:leading-none mb-1 group-hover:text-blue-600 transition-colors line-clamp-2 text-xs sm:text-sm break-words">{player.player_name}</div>
                                   <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-tight sm:tracking-widest text-slate-400 bg-slate-100/50 px-1.5 py-0.5 rounded inline-block max-w-full break-words">{player.role}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 text-center align-top">
                               <div className="flex flex-col items-center min-w-0">
                                 <span className="text-xs sm:text-sm font-black text-slate-700 italic break-words line-clamp-2">{player.team}</span>
                               </div>
                            </td>
                            <td className="px-2 sm:px-6 py-3 sm:py-4 text-center align-top">
                               <span className="px-2 sm:px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-tight sm:tracking-widest italic shadow-sm break-words max-w-[8rem] sm:max-w-none inline-block leading-snug">
                                 {player.sold_to}
                               </span>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 pr-4 sm:pr-8 text-right align-top">
                               <div className="inline-flex flex-col sm:flex-row items-end justify-end gap-1 sm:gap-4 w-full min-w-0">
                                 <div className="flex items-baseline justify-end gap-1 min-w-0">
                                   <span className="text-lg sm:text-2xl font-black tracking-tighter text-slate-900 tabular-nums break-all text-right">{player.sold_price?.replace(' Cr', '')}</span>
                                   <span className="text-[9px] sm:text-[10px] font-black italic text-slate-400 shrink-0">CR</span>
                                 </div>

                                 {isAdmin && (
                                   <button
                                     type="button"
                                     onClick={() => returnToPool(player)}
                                     disabled={actionLoading}
                                     className="h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-100 hover:bg-red-50 transition-all shadow-sm group/undo shrink-0"
                                     title="Undo Sale / Return to Pool"
                                   >
                                     <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover/undo:rotate-[-45deg] transition-transform" />
                                   </button>
                                 )}
                               </div>
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
