"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy, Shield, User, ArrowLeft, RefreshCw, Settings, Save, Search, Gavel, Clock, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Auction Config States
  const [configLoading, setConfigLoading] = useState(false);
  const [auctionConfig, setAuctionConfig] = useState<any>(null);
  const [teamBudget, setTeamBudget] = useState(120);
  const [minPlayers, setMinPlayers] = useState(18);
  const [maxPlayers, setMaxPlayers] = useState(25);

  // Override States
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [overrideMode, setOverrideMode] = useState<"reallocate" | "direct">("reallocate");
  const [sourceTeamId, setSourceTeamId] = useState<string>("");
  const [selectedOverridePlayer, setSelectedOverridePlayer] = useState<string>("");
  const [overrideBuyer, setOverrideBuyer] = useState<string>("");
  const [overridePrice, setOverridePrice] = useState<string>("");
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "config" | "allocation">("users");

  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
        return;
      }

      // Check if user is Admin
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile?.role !== "Admin") {
        router.push("/");
        return;
      }

      setCurrentUser(session.user);
      fetchUsers();
      fetchConfig();
      fetchPlayers();
    };

    checkAuth();

    // Set up Real-time subscriptions
    const channel = supabase
      .channel('admin-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        () => fetchPlayers()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => fetchUsers()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auction_config' },
        () => fetchConfig()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const fetchConfig = async () => {
    const { data } = await supabase.from("auction_config").select("*").limit(1).single();
    if (data) {
      setAuctionConfig(data);
      setTeamBudget(data.budget_per_team ?? 120);
      setMinPlayers(data.min_players ?? 18);
      setMaxPlayers(data.max_players ?? 25);
    }
  };

  const saveConfig = async () => {
    if (!auctionConfig) return;
    setConfigLoading(true);
    await supabase.from("auction_config").update({
      budget_per_team: teamBudget,
      min_players: minPlayers,
      max_players: maxPlayers
    }).eq("id", auctionConfig.id);

    // Also reset all participants' basic budget to the new teamBudget (assuming this is pre-auction)
    // Warning: this ignores already spent money. (In a real app, you'd calculate: newBudget - spentMoney)
    await supabase.from("profiles").update({ budget: teamBudget }).neq("role", "Viewer");

    alert("Configuration saved successfully! All participants now have this starting budget.");
    setConfigLoading(false);
  };

  const fetchPlayers = async () => {
    const { data } = await supabase.from("players").select("*").order("player_name");
    if (data) setAllPlayers(data);
  };

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (data) setUsers(data);
    setLoading(false);
  };

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "Admin" ? "Participant" : "Admin";
    
    // Don't let user demote themselves (safety)
    if (userId === currentUser?.id) {
        alert("You cannot demote yourself!");
        return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      console.error("Error updating role:", error);
      alert(`Failed to update role: ${error.message}`);
    } else {
      fetchUsers();
    }
  };

  const executeOverride = async () => {
    if (!selectedOverridePlayer || !overrideBuyer || !overridePrice) return;
    const newPrice = parseFloat(overridePrice);
    if (isNaN(newPrice)) return alert("Invalid price");

    setOverrideLoading(true);

    const player = allPlayers.find(p => p.id === selectedOverridePlayer);
    const newBuyer = users.find(u => u.id === overrideBuyer);
    
    if (!player || !newBuyer) {
      setOverrideLoading(false);
      return;
    }

    // --- Strict Budget Check ---
    // Calculate newBuyer's spending if this sale goes through
    // Refund current price if they are currently the owner, then add newPrice
    let currentSpendOnThisPlayer = 0;
    if (player.sold_to_id === newBuyer.id) {
       currentSpendOnThisPlayer = player.final_price || 0;
    }

    // Get current total spent by this team
    const teamTotalSpent = allPlayers
      .filter(p => p.sold_to_id === newBuyer.id && p.id !== player.id)
      .reduce((sum, p) => sum + (p.final_price || 0), 0);

    const expectedNewTotal = teamTotalSpent + newPrice;
    const maxBudget = auctionConfig?.budget_per_team || 120;

    if (expectedNewTotal > maxBudget) {
      alert(`Budget violation! This team has ${maxBudget - teamTotalSpent} Cr remaining. ${newPrice} Cr exceeds it.`);
      setOverrideLoading(false);
      return;
    }

    // 1. Refund previous buyer if already sold to someone else
    if (player.auction_status === "sold" && player.sold_to_id && player.sold_to_id !== overrideBuyer) {
      const prevBuyer = users.find(u => u.id === player.sold_to_id);
      if (prevBuyer) {
        // Handle sold_price potentially being string like "10.00 Cr"
        const currentPrice = typeof player.sold_price === 'string' 
          ? parseFloat(player.sold_price.replace(/[^\d.]/g, '')) 
          : (player.sold_price || 0);

        await supabase.from("profiles").update({
          budget: prevBuyer.budget + currentPrice,
        }).eq("id", prevBuyer.id);
      }
    }

    // 2. Charge new buyer (only if not already the buyer)
    if (player.sold_to_id !== overrideBuyer) {
      await supabase.from("profiles").update({
        budget: newBuyer.budget - newPrice,
      }).eq("id", newBuyer.id);
    } else {
      // Just adjusting price for same buyer
      const currentPrice = typeof player.sold_price === 'string' 
        ? parseFloat(player.sold_price.replace(/[^\d.]/g, '')) 
        : (player.sold_price || 0);
        
      const priceDiff = newPrice - currentPrice;
      await supabase.from("profiles").update({
        budget: newBuyer.budget - priceDiff,
      }).eq("id", newBuyer.id);
    }

    // 3. Update player record
    await supabase.from("players").update({
      status: "Sold",
      auction_status: "sold",
      sold_to_id: newBuyer.id,
      sold_to: newBuyer.team_name || newBuyer.full_name,
      sold_price: `${newPrice.toFixed(2)} Cr`,
    }).eq("id", player.id);

    // 4. Update Auction State if this player is currently live
    const { data: state } = await supabase.from("auction_state").select("*").limit(1).single();
    if (state && state.current_player_id === player.id) {
      await supabase.from("auction_state").update({
        status: "sold",
        current_bid: newPrice,
        current_bidder_id: newBuyer.id,
        current_bidder_name: newBuyer.team_name || newBuyer.full_name,
        updated_at: new Date().toISOString(),
      }).eq("id", state.id);
    }

    // 5. Audit Log
    await supabase.from("audit_logs").insert({
      admin_id: currentUser.id,
      admin_name: "Admin Override",
      action_type: overrideMode === "reallocate" ? "REALLOCATE_PLAYER" : "DIRECT_ASSIGN",
      details: {
        player_id: player.id,
        player_name: player.player_name,
        from_team: overrideMode === "reallocate" ? player.sold_to_name : "Pool",
        to_team: newBuyer.team_name || newBuyer.full_name,
        price: newPrice
      }
    });

    alert("Action completed successfully!");
    
    // Refresh
    setOverrideBuyer("");
    setOverridePrice("");
    setSelectedOverridePlayer("");
    setSourceTeamId("");
    fetchUsers();
    fetchPlayers();
    setOverrideLoading(false);
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 leading-normal p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link 
                href="/dashboard" 
                className="h-10 w-10 border-2 border-slate-200 rounded-full flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm bg-white"
            >
                <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight">Admin Control</h1>
              <p className="text-slate-500 font-medium">Manage user credentials and roles</p>
            </div>
          </div>
          <Button onClick={fetchUsers} disabled={loading} variant="secondary" className="font-bold flex gap-2 rounded-xl">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh List
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-white p-1.5 rounded-[1.5rem] border border-slate-200 shadow-sm">
          {[
            { id: "users", label: "Users", icon: Users },
            { id: "config", label: "Rules", icon: Settings },
            { id: "allocation", label: "Allocation", icon: Gavel },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 h-12 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === tab.id 
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-200" 
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === "users" && (
            <div className="space-y-8">
              {/* User Management Card */}
              <Card className="shadow-xl border-none overflow-hidden rounded-2xl">
          <CardHeader className="bg-slate-900 text-white p-6">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-blue-400" />
              <CardTitle className="text-xl font-bold uppercase tracking-tight">User Access Management</CardTitle>
            </div>
            <CardDescription className="text-slate-400 font-medium">
              Toggle roles between Admin and Participant. Admins have access to these settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="w-[400px] font-bold py-4">Participant</TableHead>
                  <TableHead className="font-bold">Role</TableHead>
                  <TableHead className="text-right font-bold pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((profile) => (
                  <TableRow key={profile.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="h-10 w-10 rounded-full border-2 border-slate-100" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                            <User className="h-5 w-5 text-slate-400" />
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900">{profile.full_name}</div>
                          <div className="text-xs text-slate-500 font-medium opacity-70">
                            {profile.avatar_url ? `Joined ${new Date(profile.created_at).toLocaleDateString()}` : "Not joined yet"}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={profile.role === "Admin" ? "default" : "outline"} className={`font-black uppercase tracking-widest text-[10px] px-2 py-0.5 rounded-full ${profile.role === "Admin" ? 'bg-blue-600 text-white' : 'border-slate-200 text-slate-500'}`}>
                        {profile.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button 
                        size="sm" 
                        variant={profile.role === "Admin" ? "destructive" : "default"}
                        className={`font-bold h-9 px-4 rounded-xl transition-all shadow-sm ${profile.role !== "Admin" ? 'bg-slate-900 hover:bg-slate-800' : ''}`}
                        onClick={() => toggleRole(profile.id, profile.role)}
                        disabled={profile.id === currentUser?.id}
                      >
                        {profile.role === "Admin" ? "Demote" : "Make Admin"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && !loading && (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest">
                            No users found in database
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    )}

    {activeTab === "config" && (
      <div className="space-y-8">
        {/* Global Auction Settings Card */}
        <Card className="shadow-xl border-none overflow-hidden rounded-2xl">
          <CardHeader className="bg-slate-900 text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="h-6 w-6 text-emerald-400" />
                <CardTitle className="text-xl font-bold uppercase tracking-tight">Auction Rules & Constraints</CardTitle>
              </div>
              <Button onClick={saveConfig} disabled={configLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-10 px-5 flex items-center gap-2">
                <Save className={`h-4 w-4 ${configLoading ? 'animate-spin' : ''}`} />
                Save Settings
              </Button>
            </div>
            <CardDescription className="text-slate-400 font-medium">
              These rules directly affect the dashboard display and starting budgets.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-500">Purse per Team (Cr)</label>
              <input 
                type="number" 
                value={teamBudget}
                onChange={(e) => setTeamBudget(Number(e.target.value))}
                className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-500">Min Players Required</label>
              <input 
                type="number" 
                value={minPlayers}
                onChange={(e) => setMinPlayers(Number(e.target.value))}
                className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-500">Max Players Allowed</label>
              <input 
                type="number" 
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    )}

    {activeTab === "allocation" && (
      <div className="space-y-8">
        {/* Player Overrides & Re-Allocation Card */}
        <Card className="shadow-2xl border-none overflow-hidden rounded-[2rem] bg-white">
          <CardHeader className="bg-slate-900 text-white p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-amber-500 rounded-2xl flex items-center justify-center">
                    <Gavel className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-2xl font-black italic uppercase tracking-tight">Manual Allocation Console</CardTitle>
                </div>
                <CardDescription className="text-slate-400 font-medium">
                  Overwrite sales, move players between teams, or assign unsold players directly.
                </CardDescription>
              </div>

              {/* Mode Toggle */}
              <div className="flex bg-slate-800 p-1 rounded-xl">
                <button 
                  onClick={() => {
                    setOverrideMode("reallocate");
                    setSelectedOverridePlayer("");
                    setSourceTeamId("");
                  }}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    overrideMode === "reallocate" ? "bg-amber-500 text-white" : "text-slate-400 hover:text-white"
                  )}
                >
                  Re-allocate
                </button>
                <button 
                  onClick={() => {
                    setOverrideMode("direct");
                    setSelectedOverridePlayer("");
                    setSourceTeamId("");
                  }}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    overrideMode === "direct" ? "bg-amber-500 text-white" : "text-slate-400 hover:text-white"
                  )}
                >
                  Direct Assign
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              
              {/* Step 1: Select Source (Conditional) */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {overrideMode === "reallocate" ? "1. From Team" : "1. Focus Pool"}
                </label>
                {overrideMode === "reallocate" ? (
                  <select 
                    value={sourceTeamId}
                    onChange={(e) => {
                      setSourceTeamId(e.target.value);
                      setSelectedOverridePlayer("");
                    }}
                    className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all cursor-pointer"
                  >
                    <option value="">Select Team...</option>
                    {users.filter(u => u.role !== "Viewer").map(u => (
                      <option key={u.id} value={u.id}>{u.team_name || u.full_name}</option>
                    ))}
                  </select>
                ) : (
                  <select 
                    value={playerSearch} // Reuse search state as pool filter for now
                    onChange={(e) => {
                      setPlayerSearch(e.target.value);
                      setSelectedOverridePlayer("");
                    }}
                    className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all cursor-pointer"
                  >
                    <option value="">All Pools</option>
                    {["Marquee", "Pool 1", "Pool 2", "Pool 3", "Unsold"].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Step 2: Select Player */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">2. Select Player</label>
                <select 
                  value={selectedOverridePlayer}
                  onChange={(e) => setSelectedOverridePlayer(e.target.value)}
                  disabled={overrideMode === "reallocate" && !sourceTeamId}
                  className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all disabled:opacity-30 cursor-pointer"
                >
                  <option value="">Choose Player...</option>
                  {allPlayers
                    .filter(p => {
                      if (overrideMode === "reallocate") return p.sold_to_id === sourceTeamId;
                      // Direct assign filters by pool if chosen
                      if (playerSearch) return p.pool === playerSearch && p.auction_status !== "sold";
                      return p.auction_status !== "sold";
                    })
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.player_name}</option>
                    ))
                  }
                </select>
              </div>

              {/* Step 3: Select Destination */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">3. Target Team</label>
                <select 
                  value={overrideBuyer}
                  onChange={(e) => setOverrideBuyer(e.target.value)}
                  className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all cursor-pointer"
                >
                  <option value="">Select Team...</option>
                  {users.filter(u => u.role !== "Viewer").map(u => (
                    <option key={u.id} value={u.id}>
                      {u.team_name || u.full_name} ({u.budget} Cr left)
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 4: Final Price */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">4. Override Price</label>
                <div className="relative">
                  <input 
                    type="number"
                    step="0.05"
                    value={overridePrice}
                    onChange={(e) => setOverridePrice(e.target.value)}
                    placeholder="Total Cr..."
                    className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">CR</span>
                </div>
              </div>

            </div>

            <div className="mt-10 pt-8 border-t border-slate-50 flex items-center justify-between">
              <div className="flex gap-4">
                 {overrideBuyer && overridePrice && (
                    <div className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest",
                      (() => {
                        const buyer = users.find(u => u.id === overrideBuyer);
                        const player = allPlayers.find(p => p.id === selectedOverridePlayer);
                        if (!buyer) return "bg-slate-100 text-slate-400";
                        
                        const teamTotalSpent = allPlayers
                          .filter(p => p.sold_to_id === buyer.id && p.id !== selectedOverridePlayer)
                          .reduce((sum, p) => sum + (p.final_price || 0), 0);
                        
                        const newTotal = teamTotalSpent + (parseFloat(overridePrice) || 0);
                        const budget = auctionConfig?.budget_per_team || 120;
                        
                        return newTotal > budget ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-500";
                      })()
                    )}>
                      {(() => {
                        const buyer = users.find(u => u.id === overrideBuyer);
                        if (!buyer) return "Select target team";
                        
                        const teamTotalSpent = allPlayers
                          .filter(p => p.sold_to_id === buyer.id && p.id !== selectedOverridePlayer)
                          .reduce((sum, p) => sum + (p.final_price || 0), 0);
                        
                        const newTotal = teamTotalSpent + (parseFloat(overridePrice) || 0);
                        const budget = auctionConfig?.budget_per_team || 120;
                        
                        return newTotal > budget 
                          ? `Budget Over: ${newTotal.toFixed(2)} / ${budget} Cr` 
                          : `Projected Purse: ${(budget - newTotal).toFixed(2)} Cr remaining`;
                      })()}
                    </div>
                 )}
              </div>
              <Button 
                onClick={executeOverride} 
                disabled={overrideLoading || !selectedOverridePlayer || !overrideBuyer || !overridePrice} 
                className="bg-slate-900 hover:bg-black text-white font-black uppercase tracking-widest rounded-2xl h-14 px-10 shadow-xl shadow-slate-200 active:scale-95 transition-all"
              >
                {overrideLoading ? <RefreshCw className="h-5 w-5 animate-spin mr-3" /> : <Save className="h-5 w-5 mr-3" />}
                Process Allocation
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}
    </div>

    {/* Info Box - Always visible or context-aware */}
    <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100/50 flex gap-4 items-start">
          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
            <Trophy className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h4 className="text-blue-900 font-black text-sm uppercase mb-1">Admin Responsibility</h4>
            <p className="text-blue-800 text-sm font-medium leading-relaxed opacity-80">
              As an Admin, you can control the entire auction process. Promoting a user to Admin gives them the power to edit rules, manage players, and manage other users. Use this privilege carefully.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
