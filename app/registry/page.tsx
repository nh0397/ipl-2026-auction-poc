"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Users, Search, CheckCircle2, ArrowRight, Loader2, Layers, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, getPlayerImage } from "@/lib/utils";

export default function RegistryPage() {
  const [profile, setProfile] = useState<any>(null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Admin Management State
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetLot, setTargetLot] = useState("Set 1");
  const [isUpdating, setIsUpdating] = useState(false);
  const [activePool, setActivePool] = useState<string>("All");
  const [activeTeam, setActiveTeam] = useState<string>("All Teams");

  const pools = ["All", "Marquee", "Pool 1", "Pool 2", "Pool 3"];
  const teams = ["All Teams", ...Array.from(new Set(allPlayers.map(p => p.team))).sort()];

  const isAdmin = profile?.role === "Admin";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      setProfile(profileData);

      // Fetch all players
      const { data: all } = await supabase
        .from("players")
        .select("*")
        .order("player_name", { ascending: true });
      setAllPlayers(all || []);
    }
    setLoading(false);
  };

  const filteredRegistry = allPlayers.filter(p => {
    const matchesSearch = p.player_name.toLowerCase().includes(search.toLowerCase()) ||
                          p.role?.toLowerCase().includes(search.toLowerCase());
    
    const matchesPool = activePool === "All" || p.pool === activePool;
    const matchesTeam = activeTeam === "All Teams" || p.team === activeTeam;
    
    return matchesSearch && matchesPool && matchesTeam;
  });

  const toggleSelection = (id: string) => {
    if (!isAdmin) return;
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

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
      alert(`Success: ${selectedIds.length} players allocated to ${targetLot}`);
    }
    setIsUpdating(false);
  }

  return (
    <div className="min-h-screen bg-[#FDFDFF] p-4 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Search className="h-5 w-5 text-blue-600" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Global Registry</span>
            </div>
            <h1 className="text-4xl font-black italic tracking-tighter uppercase text-slate-900 leading-none">The Player Portfolio</h1>
            <p className="text-slate-500 font-medium mt-2">Browse the full roster of the IPL 2026 Auction Pool</p>
          </div>

          {isAdmin && (
            <div className="flex flex-col md:items-end gap-2 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest">Lot Allocation Protocol</span>
                <div className="flex gap-2">
                    <Input 
                      value={targetLot}
                      onChange={(e) => setTargetLot(e.target.value)}
                      placeholder="e.g. Set 1"
                      className="w-40 h-11 rounded-xl border-slate-100 font-bold focus:ring-1 focus:ring-blue-600 outline-none"
                    />
                    <Button 
                       onClick={assignToLot}
                       disabled={selectedIds.length === 0 || isUpdating}
                       className="h-11 px-6 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-600 transition-all disabled:opacity-30 flex gap-2"
                    >
                       {isUpdating ? "Deploying..." : "Allocate Selected"}
                    </Button>
                </div>
            </div>
          )}
        </div>

        {/* Search & Stats */}
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
                          ? "bg-slate-900 text-white shadow-lg shadow-slate-200" 
                          : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                       )}
                    >
                       {pool}
                    </button>
                 ))}
              </div>

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
           
           <div className="flex bg-white px-8 py-4 rounded-[2rem] items-center gap-6 shadow-sm ring-1 ring-slate-100 shrink-0 mb-0.5">
              <div className="flex flex-col">
                 <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">In View</span>
                 <span className="text-xl font-black text-slate-900 italic leading-none">{filteredRegistry.length}</span>
              </div>
              <div className="h-8 w-[1px] bg-slate-100" />
              <div className="flex flex-col">
                 <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">Selected</span>
                 <span className="text-xl font-black text-blue-600 italic leading-none">{selectedIds.length}</span>
              </div>
           </div>
        </div>

        {/* Player Grid */}
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.03)] overflow-hidden min-h-[400px]">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-50">
              {loading ? (
                 <div className="col-span-full py-40 text-center flex flex-col items-center justify-center">
                    <Loader2 className="animate-spin text-blue-600" />
                    <p className="mt-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Accessing Council Database...</p>
                 </div>
              ) : filteredRegistry.length > 0 ? (
                 filteredRegistry.map((player) => (
                    <div 
                      key={player.id} 
                      onClick={() => toggleSelection(player.id)}
                      className={cn(
                        "bg-white p-7 flex items-start gap-5 transition-all relative group h-32",
                        isAdmin && "cursor-pointer",
                        selectedIds.includes(player.id) && "bg-blue-50/50"
                      )}
                    >
                       {isAdmin && (
                          <div className={cn(
                             "h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 mt-1",
                             selectedIds.includes(player.id) ? "bg-blue-600 border-blue-600 text-white" : "border-slate-100 group-hover:border-slate-300"
                          )}>
                             {selectedIds.includes(player.id) && <CheckCircle2 size={12} />}
                          </div>
                       )}

                       <div className="h-16 w-16 rounded-2xl bg-slate-50 overflow-hidden ring-4 ring-white shadow-sm flex items-center justify-center text-slate-300 shrink-0">
                          {player.image_url ? <img src={getPlayerImage(player.image_url)!} alt="" className="h-full w-full object-cover" /> : <Users size={24} />}
                       </div>

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
                 ))
              ) : (
                 <div className="col-span-full py-40 text-center flex flex-col items-center justify-center space-y-4">
                    <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                       <Users size={32} />
                    </div>
                    <div className="space-y-1">
                       <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest italic">Registry Void</h3>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-10 leading-relaxed">
                          No players are currently assigned to {activePool === "All" ? "the database" : activePool}.
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
