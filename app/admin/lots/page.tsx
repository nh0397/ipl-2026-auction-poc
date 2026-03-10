"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Gavel, Search, Filter, CheckCircle2, XCircle, ArrowRight, Layers, Users } from "lucide-react";
import { cn, getPlayerImage } from "@/lib/utils";

export default function LotAssignment() {
  const [players, setPlayers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetLot, setTargetLot] = useState("Set 1");
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchPlayers();
  }, []);

  async function fetchPlayers() {
    setLoading(true);
    const { data } = await supabase
      .from("players")
      .select("*")
      .order("player_name", { ascending: true });
    if (data) setPlayers(data);
    setLoading(false);
  }

  const filteredPlayers = players.filter(p => 
    p.player_name.toLowerCase().includes(search.toLowerCase()) ||
    p.team.toLowerCase().includes(search.toLowerCase()) ||
    p.role?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredPlayers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPlayers.map(p => p.id));
    }
  };

  async function assignToLot() {
    if (selectedIds.length === 0) return;
    setIsUpdating(true);
    
    const { error } = await supabase
      .from("players")
      .update({ pool: targetLot })
      .in("id", selectedIds);

    if (!error) {
      await fetchPlayers();
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
              <Gavel className="h-5 w-5 text-blue-600" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Council Tool</span>
            </div>
            <h1 className="text-4xl font-black italic tracking-tighter uppercase text-slate-900 leading-none">Lot Deployment Console</h1>
            <p className="text-slate-500 font-medium mt-2">Strategic player allocation for IPL 2026 Auction Lots</p>
          </div>

          <div className="flex flex-col md:items-end gap-2">
            <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest">Active Pool Selection</span>
            <div className="flex gap-2">
                <Input 
                  value={targetLot}
                  onChange={(e) => setTargetLot(e.target.value)}
                  placeholder="e.g. Set 1"
                  className="w-40 h-12 rounded-2xl border-2 border-slate-100 font-bold focus:border-blue-600 transition-all"
                />
                <Button 
                   onClick={assignToLot}
                   disabled={selectedIds.length === 0 || isUpdating}
                   className="h-12 px-8 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-600 transition-all shadow-xl shadow-slate-200 disabled:opacity-30 flex gap-2"
                >
                   {isUpdating ? "Processing..." : <>Deploy {selectedIds.length} Players <ArrowRight size={14} /></>}
                </Button>
            </div>
          </div>
        </div>

        {/* Filters & Bulk Bar */}
        <div className="flex flex-col md:flex-row gap-4">
           <div className="relative flex-1 group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
              <Input 
                placeholder="Search by Player Name, Team, or Specialization..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-14 pl-12 rounded-2xl border-none bg-white shadow-sm ring-1 ring-slate-100 focus:ring-2 focus:ring-blue-600 focus:shadow-xl transition-all font-bold placeholder:text-slate-300"
              />
           </div>
           
           <div className="flex bg-white px-6 py-2 rounded-2xl items-center gap-4 shadow-sm ring-1 ring-slate-100">
              <div className="flex flex-col">
                 <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Total Registry</span>
                 <span className="text-lg font-black text-slate-900 italic leading-none">{players.length}</span>
              </div>
              <div className="h-8 w-[1px] bg-slate-100" />
              <div className="flex flex-col">
                 <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Selected</span>
                 <span className="text-lg font-black text-blue-600 italic leading-none">{selectedIds.length}</span>
              </div>
           </div>
        </div>

        {/* Players Card */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.03)] overflow-hidden">
           <div className="overflow-x-auto">
              <Table>
                 <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-slate-100">
                       <TableHead className="w-[80px] py-6 px-8">
                          <button 
                             onClick={selectAll}
                             className={cn(
                                "h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all",
                                selectedIds.length === filteredPlayers.length && filteredPlayers.length > 0
                                ? "bg-blue-600 border-blue-600 text-white"
                                : "border-slate-200 hover:border-blue-400"
                             )}
                          >
                             {selectedIds.length === filteredPlayers.length && filteredPlayers.length > 0 && <CheckCircle2 size={16} />}
                          </button>
                       </TableHead>
                       <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-400">Player Profile</TableHead>
                       <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-400">Current Team</TableHead>
                       <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-400">Lot Assignment</TableHead>
                       <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-400">Spec / Status</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {loading ? (
                       <TableRow><TableCell colSpan={5} className="py-20 text-center text-slate-400 font-bold uppercase animate-pulse">Scanning Registry...</TableCell></TableRow>
                    ) : filteredPlayers.map((player) => (
                       <TableRow 
                          key={player.id} 
                          className={cn(
                             "group hover:bg-slate-50/50 transition-colors border-slate-50",
                             selectedIds.includes(player.id) && "bg-blue-50/30"
                          )}
                       >
                          <TableCell className="px-8 flex items-center h-20">
                             <button 
                                onClick={() => toggleSelection(player.id)}
                                className={cn(
                                   "h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all",
                                   selectedIds.includes(player.id)
                                   ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100"
                                   : "border-slate-100 group-hover:border-slate-300"
                                )}
                             >
                                {selectedIds.includes(player.id) && <CheckCircle2 size={16} />}
                             </button>
                          </TableCell>
                          <TableCell>
                             <div className="flex items-center gap-4">
                                {player.image_url ? (
                                   <div className="h-10 w-10 rounded-full bg-slate-100 overflow-hidden ring-2 ring-white">
                                      <img src={getPlayerImage(player.image_url)!} alt="" className="h-full w-full object-cover" />
                                   </div>
                                ) : (
                                   <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                                      <Users size={20} />
                                   </div>
                                )}
                                <div>
                                   <div className="text-sm font-black text-slate-900 italic uppercase">{player.player_name}</div>
                                   <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{player.country}</div>
                                </div>
                             </div>
                          </TableCell>
                          <TableCell>
                             <Badge variant="outline" className="font-black text-[10px] tracking-widest bg-slate-50 text-slate-500 border-slate-100">
                                {player.team}
                             </Badge>
                          </TableCell>
                          <TableCell>
                             {player.pool ? (
                                <Badge className="font-black text-[10px] tracking-widest bg-emerald-50 text-emerald-600 border-emerald-100 border hover:bg-emerald-50 flex items-center gap-1.5 w-fit lowercase">
                                   <Layers size={10} />
                                   {player.pool}
                                </Badge>
                             ) : (
                                <span className="text-[10px] font-black uppercase text-slate-200 tracking-widest italic">Not Assigned</span>
                             )}
                          </TableCell>
                          <TableCell>
                             <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-bold text-slate-600 italic leading-none">{player.role}</span>
                                <span className={cn(
                                   "text-[9px] font-black uppercase tracking-widest",
                                   player.status === 'Sold' ? 'text-emerald-500' : 'text-blue-500'
                                )}>{player.status}</span>
                             </div>
                          </TableCell>
                       </TableRow>
                    ))}
                 </TableBody>
              </Table>
           </div>
        </div>

      </div>
    </div>
  );
}
