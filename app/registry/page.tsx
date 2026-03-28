"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Users, Search, CheckCircle2, Loader2, CheckSquare, XSquare, Lock, Unlock, ArrowLeftRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, getPlayerImage, iplColors } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";

export default function RegistryPage() {
  const { profile: authProfile } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Admin Management State
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetLot, setTargetLot] = useState("Marquee");
  const [isUpdating, setIsUpdating] = useState(false);
  const [activePool, setActivePool] = useState<string>("Unallocated");
  const [activeTeam, setActiveTeam] = useState<string>("All Teams");
  const lastClickedIndex = useRef<number | null>(null);
  const [auctionConfig, setAuctionConfig] = useState<any>(null);

  // Sync auth profile
  useEffect(() => {
    if (authProfile) setProfile(authProfile);
  }, [authProfile]);

  // Admin sees Unallocated tab, everyone sees the pool tabs
  const isAdmin = profile?.role === "Admin";
  // Everyone gets to see Unallocated so they can see all pending unassigned players
  const pools = ["All", "Marquee", "Pool 1", "Pool 2", "Pool 3", "Unallocated", "Sold"];
  const showAdminControls = isAdmin && activePool !== "All" && activePool !== "Sold";
  const unallocatedCount = allPlayers.filter(p => (!p.pool || p.pool === "") && p.status !== 'Sold').length;
  const soldCount = allPlayers.filter(p => p.status === 'Sold').length;
  const teams = ["All Teams", ...Array.from(new Set(allPlayers.map(p => p.team))).sort()];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: all } = await supabase
        .from("players")
        .select("*")
        .order("player_name", { ascending: true });
      setAllPlayers(all || []);

      // Fetch auction config if it exists
      const { data: config } = await supabase.from("auction_config").select("*").limit(1).single();
      if (config) setAuctionConfig(config);
    } catch (error) {
      console.error("Error fetching registry data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRegistry = allPlayers.filter(p => {
    const matchesSearch = p.player_name.toLowerCase().includes(search.toLowerCase()) ||
                          (p.role || '').toLowerCase().includes(search.toLowerCase());
    
    const matchesPool =
      activePool === "All"
        ? true
        : activePool === "Unallocated"
          ? (!p.pool || p.pool === "") && p.status !== 'Sold'
          : activePool === "Sold"
            ? p.status === "Sold"
            : p.pool === activePool;

    const matchesTeam = activeTeam === "All Teams" || p.team === activeTeam;
    
    return matchesSearch && matchesPool && matchesTeam;
  });

  // --- Selection Logic ---
  const toggleSelection = (id: string, index: number, shiftKey: boolean) => {
    if (!showAdminControls) return;


    if (shiftKey && lastClickedIndex.current !== null) {
      const start = Math.min(lastClickedIndex.current, index);
      const end = Math.max(lastClickedIndex.current, index);
      const rangeIds = filteredRegistry.slice(start, end + 1).map(p => p.id);
      setSelectedIds(prev => {
        const combined = new Set([...prev, ...rangeIds]);
        return Array.from(combined);
      });
    } else {
      setSelectedIds(prev =>
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
    }
    lastClickedIndex.current = index;
  };

  const selectAllVisible = () => {
    const visibleIds = filteredRegistry.map(p => p.id);
    setSelectedIds(prev => {
      const combined = new Set([...prev, ...visibleIds]);
      return Array.from(combined);
    });
  };

  const deselectAll = () => {
    setSelectedIds([]);
    lastClickedIndex.current = null;
  };

  // --- Pool Allocation ---
  async function assignToLot() {
    if (selectedIds.length === 0) return;
    setIsUpdating(true);
    
    const { error } = await supabase
      .from("players")
      .update({ pool: targetLot })
      .in("id", selectedIds);

    if (!error) {
      await fetchData();
      setSelectedIds([]);
      lastClickedIndex.current = null;
      alert(`Success: ${selectedIds.length} players allocated to ${targetLot}`);
    }
    setIsUpdating(false);
  }

  // Unallocate: clear pool field, send back to Unallocated
  async function unallocateSelected() {
    if (selectedIds.length === 0) return;
    setIsUpdating(true);

    const { error } = await supabase
      .from("players")
      .update({ pool: null })
      .in("id", selectedIds);

    if (!error) {
      await fetchData();
      setSelectedIds([]);
      lastClickedIndex.current = null;
      alert(`${selectedIds.length} players moved back to Unallocated`);
    }
    setIsUpdating(false);
  }

  // Freeze / Unfreeze pools
  async function freezePools() {
    setIsUpdating(true);
    await supabase.from("auction_config").update({ pools_frozen: true, status: "frozen", updated_at: new Date().toISOString() }).eq("id", auctionConfig.id);
    await fetchData();
    setIsUpdating(false);
  }

  async function unfreezePools() {
    setIsUpdating(true);
    await supabase.from("auction_config").update({ pools_frozen: false, status: "setup", updated_at: new Date().toISOString() }).eq("id", auctionConfig.id);
    await fetchData();
    setIsUpdating(false);
  }

  const poolsFrozen = auctionConfig?.pools_frozen === true;

  return (
    <div className="min-h-screen bg-[#FDFDFF] p-4 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Search className="h-5 w-5 text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Global Registry</span>
            {poolsFrozen && (
              <span className="ml-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-[9px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-1.5">
                <Lock size={10} /> Pools Frozen
              </span>
            )}
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-slate-900 leading-none">The Player Portfolio</h1>
          <p className="text-slate-500 font-medium mt-2">Browse the full roster of the IPL 2026 Auction Pool</p>
        </div>

        {/* Admin Toolbar */}
        {isAdmin && (
          <div className="bg-slate-900 rounded-2xl p-4 px-6 flex flex-wrap items-center gap-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/30 mr-auto">
              Admin Controls — {activePool}
            </span>

            {/* Allocate controls (Unallocated tab) */}
            {activePool === "Unallocated" && (
              <>
                <select 
                  value={targetLot}
                  onChange={(e) => setTargetLot(e.target.value)}
                  className="h-9 px-4 rounded-lg bg-white/10 text-white font-bold text-sm border border-white/20 outline-none cursor-pointer hover:bg-white/20 transition-all"
                >
                  <option value="Marquee" className="text-slate-900">Marquee</option>
                  <option value="Pool 1" className="text-slate-900">Pool 1</option>
                  <option value="Pool 2" className="text-slate-900">Pool 2</option>
                  <option value="Pool 3" className="text-slate-900">Pool 3</option>
                </select>
                <Button 
                  onClick={assignToLot}
                  disabled={selectedIds.length === 0 || isUpdating}
                  className="h-9 px-5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-black uppercase tracking-widest text-[9px] transition-all disabled:opacity-30 active:scale-95 flex gap-2"
                >
                  {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Deploy to Pool"}
                </Button>
              </>
            )}

            {/* Unallocate controls (Pool tabs) */}
            {["Marquee", "Pool 1", "Pool 2", "Pool 3"].includes(activePool) && (
              <Button 
                onClick={unallocateSelected}
                disabled={selectedIds.length === 0 || isUpdating}
                className="h-9 px-5 bg-red-500/80 hover:bg-red-600 text-white rounded-lg font-black uppercase tracking-widest text-[9px] transition-all disabled:opacity-30 active:scale-95 flex gap-2"
              >
                {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <><ArrowLeftRight size={12} /> Unallocate</>}
              </Button>
            )}

            {/* Divider */}
            {activePool !== "All" && auctionConfig && (
              <div className="h-6 w-[1px] bg-white/10" />
            )}

            {/* Freeze / Unfreeze */}
            {auctionConfig && !poolsFrozen && unallocatedCount === 0 && (
              <Button 
                onClick={freezePools}
                disabled={isUpdating}
                className="h-9 px-5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-black uppercase tracking-widest text-[9px] transition-all disabled:opacity-30 active:scale-95 flex gap-2"
              >
                <Lock size={12} /> Freeze Pools
              </Button>
            )}
            {auctionConfig && poolsFrozen && (
              <Button 
                onClick={unfreezePools}
                disabled={isUpdating}
                className="h-9 px-5 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg font-black uppercase tracking-widest text-[9px] transition-all disabled:opacity-30 active:scale-95 flex gap-2 border border-white/10"
              >
                <Unlock size={12} /> Unfreeze
              </Button>
            )}
          </div>
        )}

        {/* Filters & Stats */}
        <div className="flex flex-col md:flex-row gap-6 items-end justify-between">
           <div className="flex-1 space-y-4 w-full">
              {/* Team Filter Strip */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
                 {teams.map((team) => (
                    <button
                       key={team}
                       onClick={() => setActiveTeam(team)}
                       className={cn(
                          "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border shrink-0",
                          activeTeam === team 
                          ? "bg-blue-600 text-white border-blue-600 shadow-md" 
                          : "bg-white text-slate-400 border-slate-100 hover:border-slate-300"
                       )}
                    >
                       {team}
                    </button>
                 ))}
              </div>

              {/* Pool Tabs */}
              <div className="flex gap-2 bg-white p-1.5 rounded-2xl w-fit border border-slate-100 shadow-sm overflow-x-auto">
                 {pools.map((pool) => (
                     <button
                       key={pool}
                       onClick={() => setActivePool(pool)}
                       className={cn(
                          "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                          activePool === pool 
                          ? pool === "Unallocated"
                            ? "bg-amber-500 text-white shadow-lg shadow-amber-200"
                            : pool === "Sold"
                              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200"
                              : "bg-slate-900 text-white shadow-lg shadow-slate-200"
                          : pool === "Unallocated" && unallocatedCount > 0
                            ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50 animate-pulse ring-2 ring-amber-300"
                            : pool === "Sold" && soldCount > 0
                              ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                       )}
                    >
                       {pool}
                       {pool === "Unallocated" && unallocatedCount > 0 ? ` (${unallocatedCount})` : ""}
                       {pool === "Sold" && soldCount > 0 ? ` (${soldCount})` : ""}
                    </button>
                 ))}
              </div>

              {/* Search */}
              <div className="relative group w-full">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                <Input 
                  placeholder={`Search ${activePool === "All" ? "Registry" : activePool}...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-14 pl-12 rounded-2xl border-none bg-white shadow-sm ring-1 ring-slate-100 focus:ring-2 focus:ring-blue-600 focus:shadow-xl transition-all font-bold placeholder:text-slate-300"
                />
              </div>
           </div>
           
           {/* Stats + Bulk Actions */}
           <div className="flex bg-white px-6 py-4 rounded-[2rem] items-center gap-4 shadow-sm ring-1 ring-slate-100 shrink-0 mb-0.5">
              <div className="flex flex-col">
                 <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">In View</span>
                 <span className="text-xl font-black text-slate-900 italic leading-none">{filteredRegistry.length}</span>
              </div>
              <div className="h-8 w-[1px] bg-slate-100" />
              <div className="flex flex-col">
                 <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">Selected</span>
                 <span className="text-xl font-black text-blue-600 italic leading-none">{selectedIds.length}</span>
              </div>
              {isAdmin && (
                <>
                  <div className="h-8 w-[1px] bg-slate-100" />
                  <div className="flex gap-1.5">
                    <button
                      onClick={selectAllVisible}
                      title="Select all visible players"
                      className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-all active:scale-90"
                    >
                      <CheckSquare size={16} />
                    </button>
                    <button
                      onClick={deselectAll}
                      title="Deselect all"
                      className="h-9 w-9 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all active:scale-90"
                    >
                      <XSquare size={16} />
                    </button>
                  </div>
                </>
              )}
           </div>
        </div>

        {/* Shift+Click hint for admins */}
        {isAdmin && selectedIds.length > 0 && (
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center -mt-4">
            💡 Hold <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-black">Shift</kbd> + Click to select a range
          </div>
        )}

        {/* Player Grid */}
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.03)] overflow-hidden min-h-[400px]">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-50">
              {loading ? (
                 <div className="col-span-full py-40 text-center flex flex-col items-center justify-center">
                    <Loader2 className="animate-spin text-blue-600" />
                    <p className="mt-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Accessing Council Database...</p>
                 </div>
              ) : filteredRegistry.length > 0 ? (
                 filteredRegistry.map((player, index) => {
                    const teamStyle = iplColors[player.team] || { bg: "bg-white", border: "border-slate-100", text: "text-slate-600" };
                    return (
                    <div 
                      key={player.id} 
                      onClick={(e) => toggleSelection(player.id, index, e.shiftKey)}
                      className={cn(
                        "p-7 flex items-start gap-5 transition-all relative group h-32 select-none border-t overflow-hidden",
                        showAdminControls && "cursor-pointer",
                        showAdminControls && selectedIds.includes(player.id) ? "bg-blue-50/50 ring-1 ring-inset ring-blue-100" : teamStyle.bg
                      )}
                    >
                       <div className="absolute top-0 right-0 p-3 opacity-5 font-black text-6xl transform translate-x-1/4 -translate-y-1/4 pointer-events-none">
                          {player.team}
                       </div>
                       {/* Admin checkbox */}
                       {showAdminControls && (
                          <div className={cn(
                             "h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 mt-1",
                             selectedIds.includes(player.id) ? "bg-blue-600 border-blue-600 text-white" : "border-slate-100 group-hover:border-slate-300"
                          )}>
                             {selectedIds.includes(player.id) && <CheckCircle2 size={12} />}
                          </div>
                       )}

                       {/* Player Avatar */}
                       <div className="h-16 w-16 rounded-2xl bg-slate-50 overflow-hidden ring-4 ring-white shadow-sm flex items-center justify-center text-slate-300 shrink-0">
                          {player.image_url ? <img src={getPlayerImage(player.image_url)!} alt="" className="h-full w-full object-cover" /> : <Users size={24} />}
                       </div>

                       {/* Player Info */}
                       <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-2 mb-1">
                             <span className="text-[11px] font-black text-blue-600 italic uppercase leading-none">{player.team}</span>
                             {player.pool && (
                               <Badge className="h-4 px-1.5 text-[8px] font-black bg-slate-900 border-none uppercase tracking-tighter">
                                  {player.pool}
                               </Badge>
                             )}
                          </div>
                          <h4 className="text-base font-black text-slate-900 italic uppercase truncate leading-tight mb-1">{player.player_name}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{player.role} • {player.country}</p>
                       </div>
                    </div>
                  );
                 })
              ) : (
                 <div className="col-span-full py-40 text-center flex flex-col items-center justify-center space-y-4">
                    <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                       <Users size={32} />
                    </div>
                    <div className="space-y-1">
                       <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest italic">
                         {activePool === "Unallocated" ? "All Players Allocated" : "Registry Void"}
                       </h3>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-10 leading-relaxed">
                          {activePool === "Unallocated" 
                            ? "Every player has been assigned to a pool. Great work!" 
                            : `No players are currently assigned to ${activePool === "All" ? "the database" : activePool}.`}
                       </p>
                    </div>
                 </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
