"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy, Shield, User, ArrowLeft, RefreshCw, Settings, Save, Search, Gavel, Clock, Users, UserMinus, UserPlus, LogOut, History as HistoryIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

export default function AdminDashboard() {
  const { user, profile: authProfile } = useAuth();
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
  const [overrideMode, setOverrideMode] = useState<"reallocate" | "direct" | "release" | "replace">("reallocate");
  const [sourceTeamId, setSourceTeamId] = useState<string>("");
  const [selectedOverridePlayer, setSelectedOverridePlayer] = useState<string>("");
  const [replacementPlayerId, setReplacementPlayerId] = useState<string>("");
  const [overrideBuyer, setOverrideBuyer] = useState<string>("");
  const [overridePrice, setOverridePrice] = useState<string>("");
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "config" | "allocation" | "sold">("users");

  const router = useRouter();

  useEffect(() => {
    // Use AuthProvider data instead of calling getSession
    if (!user) {
      router.push("/");
      return;
    }
    if (authProfile?.role !== "Admin") {
      router.push("/");
      return;
    }

    setCurrentUser(user);
    fetchUsers();
    fetchConfig();
    fetchPlayers();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authProfile]);

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
    await supabase.from("profiles").update({ budget: teamBudget }).neq("role", "Viewer");

    alert("Configuration saved successfully! All participants now have this starting budget.");
    setConfigLoading(false);
  };

  const endAuction = async () => {
    // Double confirmation
    if (!confirm("CRITICAL: Are you sure you want to END the auction? This is irreversible and will finalize all squads. Proceed only if the auction is fully complete.")) return;

    if (!confirm("FINAL WARNING: Once you click OK, the auction will be marked as COMPLETED. This action CANNOT be undone. Are you absolutely certain?")) return;
    
    setConfigLoading(true);
    const { data: config } = await supabase.from("auction_config").select("id").limit(1).single();
    if (config) {
      const { error } = await supabase.from("auction_config").update({ 
        status: "completed", 
        updated_at: new Date().toISOString() 
      }).eq("id", config.id);
      
      if (error) {
        alert("Error ending auction: " + error.message);
      } else {
        alert("Auction marked as COMPLETED successfully.");
        fetchConfig();
      }
    }
    setConfigLoading(false);
  };

  const fetchPlayers = async () => {
    const { data } = await supabase.from("players").select("*").order("player_name");
    if (data) setAllPlayers(data);
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");
      if (data) setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTeam = async (profile: any) => {
    if (!confirm(`Are you sure you want to remove the team for ${profile.full_name}? This will release all their players back to the pool.`)) return;

    // 1. Release Players
    const { error: playerError } = await supabase
      .from("players")
      .update({
        status: "Available",
        auction_status: "pending",
        sold_to: null,
        sold_to_id: null,
        sold_price: null
      })
      .eq("sold_to_id", profile.id);

    if (playerError) {
      alert(`Error releasing players: ${playerError.message}`);
      return;
    }

    // 2. Reset Profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        role: "Viewer",
        team_name: "New Franchise",
        budget: auctionConfig?.budget_per_team || 150
      })
      .eq("id", profile.id);

    if (profileError) {
      alert(`Error resetting profile: ${profileError.message}`);
    } else {
      fetchUsers();
      fetchPlayers();
    }
  };

  const handleMakeParticipant = async (profile: any) => {
    const teamName = prompt("Enter the Team Name for this franchise:", profile.team_name || "New Franchise");
    if (!teamName) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        role: "Participant",
        team_name: teamName,
        budget: auctionConfig?.budget_per_team || 150
      })
      .eq("id", profile.id);

    if (error) {
      alert(`Error promoting to Participant: ${error.message}`);
    } else {
      fetchUsers();
    }
  };

  const updateRole = async (userId: string, newRole: string) => {
    if (userId === currentUser?.id) {
        alert("You cannot demote yourself!");
        return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      alert(`Error updating role: ${error.message}`);
    } else {
      fetchUsers();
    }
  };

  // Replacement mode: default price = outgoing sold price; target team = source team.
  useEffect(() => {
    if (overrideMode !== "replace") return;
    setOverrideBuyer(sourceTeamId || "");
  }, [overrideMode, sourceTeamId]);

  useEffect(() => {
    if (overrideMode !== "replace") return;
    const outPlayer = allPlayers.find(p => p.id === selectedOverridePlayer);
    const parsed =
      typeof outPlayer?.sold_price === "string"
        ? parseFloat(outPlayer.sold_price.replace(/[^\d.]/g, ""))
        : Number(outPlayer?.sold_price || 0);
    if (outPlayer && !Number.isNaN(parsed) && parsed > 0) {
      setOverridePrice(parsed.toFixed(2));
    }
  }, [overrideMode, selectedOverridePlayer, allPlayers]);

  const executeReplace = async () => {
    if (!sourceTeamId || !selectedOverridePlayer || !replacementPlayerId) return;

    const outPlayer = allPlayers.find(p => p.id === selectedOverridePlayer);
    const inPlayer = allPlayers.find(p => p.id === replacementPlayerId);
    const team = users.find(u => u.id === sourceTeamId);
    if (!outPlayer || !inPlayer || !team) return;

    const price =
      overridePrice && !Number.isNaN(parseFloat(overridePrice))
        ? parseFloat(overridePrice)
        : (typeof outPlayer.sold_price === "string"
            ? parseFloat(outPlayer.sold_price.replace(/[^\d.]/g, ""))
            : Number(outPlayer.sold_price || 0));

    if (!price || Number.isNaN(price)) return alert("Invalid price");

    if (outPlayer.sold_to_id !== sourceTeamId || outPlayer.auction_status !== "sold") {
      return alert("Outgoing player must be SOLD and belong to the selected team.");
    }

    if (inPlayer.auction_status === "sold") {
      return alert("Replacement player is already SOLD.");
    }

    if (!confirm(`Replace ${outPlayer.player_name} with ${inPlayer.player_name} for ${team.team_name || team.full_name} at ${price.toFixed(2)} Cr?`)) {
      return;
    }

    setOverrideLoading(true);

    // 1) Release outgoing player back to a pool (prefer base_pool if present; otherwise keep their pool).
    const outPool = outPlayer.base_pool || outPlayer.pool || "Unsold";
    const { error: outErr } = await supabase
      .from("players")
      .update({
        status: "Available",
        auction_status: "pending",
        sold_to: null,
        sold_to_id: null,
        sold_price: null,
        pool: outPool,
      })
      .eq("id", outPlayer.id);
    if (outErr) {
      setOverrideLoading(false);
      return alert(`Failed to release outgoing player: ${outErr.message}`);
    }

    // 2) Assign replacement player to the same team at the outgoing price.
    const stampBasePool = inPlayer.base_pool || inPlayer.pool || null;
    const { error: inErr } = await supabase
      .from("players")
      .update({
        status: "Sold",
        auction_status: "sold",
        sold_to_id: sourceTeamId,
        sold_to: team.team_name || team.full_name,
        sold_price: `${price.toFixed(2)} Cr`,
        base_pool: stampBasePool,
      })
      .eq("id", inPlayer.id);
    if (inErr) {
      setOverrideLoading(false);
      return alert(`Failed to assign replacement player: ${inErr.message}`);
    }

    // 3) Audit log
    await supabase.from("audit_logs").insert({
      admin_id: currentUser.id,
      admin_name: "Admin Override",
      action_type: "REPLACE_PLAYER",
      details: {
        team_id: sourceTeamId,
        team_name: team.team_name || team.full_name,
        out_player_id: outPlayer.id,
        out_player_name: outPlayer.player_name,
        in_player_id: inPlayer.id,
        in_player_name: inPlayer.player_name,
        price,
      },
    });

    alert("Replacement completed.");
    setSelectedOverridePlayer("");
    setReplacementPlayerId("");
    setOverridePrice("");
    setSourceTeamId("");
    setOverrideBuyer("");
    fetchUsers();
    fetchPlayers();
    setOverrideLoading(false);
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

    // 3. Update player record (stamp base_pool on first sale for release-back)
    const stampBasePool = player.base_pool || player.pool || null;
    await supabase.from("players").update({
      status: "Sold",
      auction_status: "sold",
      sold_to_id: newBuyer.id,
      sold_to: newBuyer.team_name || newBuyer.full_name,
      sold_price: `${newPrice.toFixed(2)} Cr`,
      base_pool: stampBasePool,
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

  const executeRelease = async () => {
    if (!selectedOverridePlayer) return;
    setOverrideLoading(true);

    const player = allPlayers.find(p => p.id === selectedOverridePlayer);
    if (!player) {
      setOverrideLoading(false);
      return;
    }

    if (!confirm(`Are you sure you want to release ${player.player_name} back to the ${player.pool} pool? This will refund the team.`)) {
      setOverrideLoading(false);
      return;
    }

    // 1. Refund the current buyer (if any)
    if (player.auction_status === "sold" && player.sold_to_id) {
      const buyer = users.find(u => u.id === player.sold_to_id);
      if (buyer) {
        const currentPrice = typeof player.sold_price === 'string' 
          ? parseFloat(player.sold_price.replace(/[^\d.]/g, '')) 
          : (player.sold_price || 0);

        await supabase.from("profiles").update({
          budget: (buyer.budget || 0) + currentPrice,
        }).eq("id", buyer.id);
      }
    }

    // 2. Update player record
    const { error: playerError } = await supabase.from("players").update({
      status: "Available",
      auction_status: "pending",
      pool: player.base_pool || player.pool, // Restore to original pool if tracked
      sold_to: null,
      sold_to_id: null,
      sold_price: null,
    }).eq("id", player.id);

    if (playerError) {
      alert(`Error updating player: ${playerError.message}`);
    } else {
      // 3. Update Auction State if this player is currently live
      const { data: state } = await supabase.from("auction_state").select("*").limit(1).single();
      if (state && state.current_player_id === player.id) {
        await supabase.from("auction_state").update({
          status: "waiting",
          current_player_id: null,
          current_bid: 0,
          current_bidder_id: null,
          current_bidder_name: null,
          updated_at: new Date().toISOString(),
        }).eq("id", state.id);
      }

      // 4. Audit Log
      await supabase.from("audit_logs").insert({
        admin_id: currentUser.id,
        admin_name: "Admin Override",
        action_type: "RELEASE_PLAYER",
        details: {
          player_id: player.id,
          player_name: player.player_name,
          from_team: player.sold_to,
          pool: player.pool
        }
      });

      alert("Player released successfully!");
    }
    
    // Refresh
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
            { id: "sold", label: "Sold Portfolio", icon: HistoryIcon },
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
                      <div className="flex justify-end gap-2">
                        {profile.role === "Admin" ? (
                          <Button 
                            size="sm" 
                            variant="destructive"
                            className="font-bold h-9 px-4 rounded-xl transition-all shadow-sm"
                            onClick={() => updateRole(profile.id, "Participant")}
                            disabled={profile.id === currentUser?.id}
                          >
                            <UserMinus className="h-4 w-4 mr-2" />
                            To Participant
                          </Button>
                        ) : profile.role === "Participant" ? (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="font-bold h-9 px-4 rounded-xl border-slate-200 hover:bg-slate-50"
                              onClick={() => updateRole(profile.id, "Admin")}
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              Make Admin
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              className="font-bold h-9 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white"
                              onClick={() => handleRemoveTeam(profile)}
                            >
                              <LogOut className="h-4 w-4 mr-2 text-white" />
                              Remove Team
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button 
                              size="sm" 
                              className="font-bold h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => handleMakeParticipant(profile)}
                            >
                              <UserPlus className="h-4 w-4 mr-2" />
                              Make Participant
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="font-bold h-9 px-4 rounded-xl border-slate-200 hover:bg-slate-50"
                              onClick={() => updateRole(profile.id, "Admin")}
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              Make Admin
                            </Button>
                          </>
                        )}
                      </div>
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
        {/* Points & Scoreboard Section */}
        <Card className="shadow-xl border-none overflow-hidden rounded-2xl bg-amber-50/50 border border-amber-100">
          <CardHeader className="p-8">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-200">
                <Trophy size={24} />
              </div>
              <div>
                <CardTitle className="text-xl font-bold uppercase tracking-tight text-amber-900">Match Day Scoreboard</CardTitle>
                <CardDescription className="text-amber-700/60 font-medium">Update Dream11 points and manage game schedules</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-8 pb-8 flex flex-col md:flex-row items-center gap-4">
            <p className="text-sm text-amber-900/70 font-medium flex-1">
              Manual entry for points across all 80+ games. Use the Grid Editor to quickly sync player performances with the live leaderboard.
            </p>
            <Button 
              variant="default" 
              className="bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-widest px-8 py-6 rounded-2xl shadow-xl transition-all"
              onClick={() => router.push("/scoreboard")}
            >
              Open Scoreboard Editor
            </Button>
          </CardContent>
        </Card>

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

        {/* Global Auction Command Center - Separate & Secure */}
        <Card className="shadow-2xl border-[3px] border-red-100 overflow-hidden rounded-[2rem] bg-red-50/20">
          <CardHeader className="bg-red-600 text-white p-8">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <Gavel className="h-8 w-8 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-black uppercase tracking-tight italic">Auction Command Center</CardTitle>
                <CardDescription className="text-red-100 font-bold opacity-80">Manual Override & Finalization Control</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 space-y-2">
                <h4 className="text-lg font-black uppercase tracking-tight text-red-900">Irreversible Action Zone</h4>
                <p className="text-sm text-red-700/70 font-medium max-w-xl">
                  Ending the auction is a final step that marks all squads as complete. This cannot be undone automatically. Only proceed when the live auction event is fully finished.
                </p>
              </div>
              <Button 
                variant="destructive"
                className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-[0.2em] px-10 py-8 rounded-2xl shadow-xl shadow-red-200 text-sm transition-all"
                onClick={endAuction}
                disabled={configLoading || auctionConfig?.status === "completed"}
              >
                {auctionConfig?.status === "completed" ? "Auction Finished" : "End Auction Forever"}
              </Button>
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
                {["reallocate", "direct", "replace", "release"].map((mode) => (
                  <button 
                    key={mode}
                    onClick={() => {
                      setOverrideMode(mode as any);
                      setSelectedOverridePlayer("");
                      setReplacementPlayerId("");
                      setSourceTeamId("");
                      setOverrideBuyer("");
                      setOverridePrice("");
                    }}
                    className={cn(
                      "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                      overrideMode === mode ? "bg-amber-500 text-white" : "text-slate-400 hover:text-white"
                    )}
                  >
                    {mode === "reallocate"
                      ? "Re-allocate"
                      : mode === "direct"
                        ? "Direct Assign"
                        : mode === "replace"
                          ? "Replace Player"
                          : "Release to Pool"}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              
              {/* Step 1: Select Source (Conditional) */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {overrideMode === "reallocate" || overrideMode === "release" || overrideMode === "replace" ? "1. From Team" : "1. Focus Pool"}
                </label>
                {overrideMode === "reallocate" || overrideMode === "release" || overrideMode === "replace" ? (
                  <select 
                    value={sourceTeamId}
                    onChange={(e) => {
                      setSourceTeamId(e.target.value);
                      setSelectedOverridePlayer("");
                      setReplacementPlayerId("");
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
                  disabled={(overrideMode === "reallocate" || overrideMode === "release" || overrideMode === "replace") && !sourceTeamId}
                  className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all disabled:opacity-30 cursor-pointer"
                >
                  <option value="">Choose Player...</option>
                  {allPlayers
                    .filter(p => {
                      if (overrideMode === "reallocate" || overrideMode === "release") return p.sold_to_id === sourceTeamId;
                      if (overrideMode === "replace") return p.sold_to_id === sourceTeamId && p.auction_status === "sold";
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
              {overrideMode === "replace" ? (
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">3. Replacement Player</label>
                  <select
                    value={replacementPlayerId}
                    onChange={(e) => setReplacementPlayerId(e.target.value)}
                    disabled={!selectedOverridePlayer}
                    className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all disabled:opacity-30 cursor-pointer"
                  >
                    <option value="">Choose replacement...</option>
                    {allPlayers
                      .filter(p => p.id !== selectedOverridePlayer && p.auction_status !== "sold")
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.player_name} ({p.pool || "—"} · {p.auction_status})
                        </option>
                      ))}
                  </select>
                </div>
              ) : (
                <div className={cn("space-y-3", overrideMode === "release" && "opacity-20 pointer-events-none")}>
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
              )}

              {/* Step 4: Final Price */}
              <div className={cn("space-y-3", overrideMode === "release" && "opacity-20 pointer-events-none")}>
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
                 {overrideBuyer && overridePrice && overrideMode !== "release" && (
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
                onClick={overrideMode === "release" ? executeRelease : overrideMode === "replace" ? executeReplace : executeOverride} 
                disabled={
                  overrideLoading ||
                  !selectedOverridePlayer ||
                  (overrideMode === "replace"
                    ? (!sourceTeamId || !replacementPlayerId)
                    : (overrideMode !== "release" && (!overrideBuyer || !overridePrice)))
                } 
                className={cn(
                  "font-black uppercase tracking-widest rounded-2xl h-14 px-10 shadow-xl shadow-slate-200 active:scale-95 transition-all",
                  overrideMode === "release" ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-slate-900 hover:bg-black text-white"
                )}
              >
                {overrideLoading ? <RefreshCw className="h-5 w-5 animate-spin mr-3" /> : (overrideMode === "release" ? <LogOut className="h-5 w-5 mr-3" /> : <Save className="h-5 w-5 mr-3" />)}
                {overrideMode === "release" ? "Release to Pool" : overrideMode === "replace" ? "Replace Player" : "Process Allocation"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}

    {activeTab === "sold" && (
      <div className="space-y-6">
        <div className="flex justify-between items-center px-2">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <HistoryIcon className="h-6 w-6 text-blue-600" />
              Sold Player Management
            </h2>
            <p className="text-slate-500 font-medium tracking-tight">Undo sales and release players back to pools</p>
          </div>
          <div className="bg-blue-600 text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100">
            Total Sold: {allPlayers.filter(p => p.auction_status === "sold" || p.status === "Sold").length}
          </div>
        </div>

        {/* Global Search for Sold Players */}
        <div className="relative group mx-2">
           <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
           <input 
             value={playerSearch}
             onChange={(e) => setPlayerSearch(e.target.value)}
             placeholder="Search sold players by name, team, or role..."
             className="w-full bg-white border border-slate-200 h-14 pl-14 pr-6 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm"
           />
        </div>

        <Card className="shadow-xl border-none overflow-hidden rounded-[2rem] border border-slate-100">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableHead className="pl-8 font-black uppercase tracking-widest text-[10px] text-slate-400 h-14">Player</TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-400 h-14">Sold To</TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-400 h-14 text-right">Price</TableHead>
                  <TableHead className="pr-8 font-black uppercase tracking-widest text-[10px] text-slate-400 h-14 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allPlayers
                  .filter(p => {
                    const isSold = p.auction_status === "sold" || p.status === "Sold";
                    if (!isSold) return false;
                    if (!playerSearch) return true;
                    const searchLower = playerSearch.toLowerCase();
                    return (
                      p.player_name?.toLowerCase().includes(searchLower) ||
                      p.sold_to?.toLowerCase().includes(searchLower) ||
                      (p.role && p.role.toLowerCase().includes(searchLower))
                    );
                  })
                  .sort((a,b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''))
                  .map((player) => (
                  <TableRow key={player.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors group">
                    <TableCell className="pl-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 p-0.5">
                           <img 
                             src={player.image_url ? (player.image_url.startsWith('http') ? player.image_url : `https://img1.hscicdn.com/image/upload/f_auto,t_h_100/${player.image_url}`) : "https://www.freeiconspng.com/uploads/no-image-icon-6.png"} 
                             className="w-full h-full object-cover object-top rounded-lg" 
                             alt=""
                           />
                        </div>
                        <div>
                          <div className="font-black uppercase tracking-tight text-slate-900 leading-none mb-1">{player.player_name}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{player.role} • {player.pool}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-blue-50 text-blue-600 border-blue-100 font-bold px-3 py-1 rounded-lg">
                        {player.sold_to}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-black text-slate-900">
                      {player.sold_price || "0.00 Cr"}
                    </TableCell>
                    <TableCell className="pr-8 text-right">
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className="font-black uppercase tracking-widest text-[9px] h-8 rounded-xl transition-all shadow-sm hover:shadow-red-100 active:scale-95"
                        onClick={async () => {
                           if (!confirm(`Are you sure you want to undo the sale for ${player.player_name}? This will refund ${player.sold_to} and return the player to the ${player.pool} pool.`)) return;
                           
                           setLoading(true);
                           
                           try {
                             // Refund logic
                             if (player.sold_to_id) {
                                const buyer = users.find(u => u.id === player.sold_to_id);
                                if (buyer) {
                                  const currentPrice = typeof player.sold_price === 'string' 
                                    ? parseFloat(player.sold_price.replace(/[^\d.]/g, '')) 
                                    : (player.sold_price || 0);

                                  await supabase.from("profiles").update({
                                    budget: (buyer.budget || 0) + currentPrice,
                                  }).eq("id", buyer.id);
                                }
                             }

                             // Reset player
                             const { error } = await supabase.from("players").update({
                               status: "Available",
                               auction_status: "pending",
                               sold_to: null,
                               sold_to_id: null,
                               sold_price: null,
                             }).eq("id", player.id);

                             if (error) {
                               alert(`Error: ${error.message}`);
                             } else {
                               // Audit log
                               await supabase.from("audit_logs").insert({
                                  admin_id: currentUser.id,
                                  admin_name: "Admin Undo Sale",
                                  action_type: "UNDO_SALE",
                                  details: { player_id: player.id, player_name: player.player_name, team: player.sold_to }
                               });
                               alert("Sale undone successfully!");
                             }
                           } catch (err) {
                             console.error(err);
                             alert("An error occurred during undo sale.");
                           } finally {
                             fetchUsers();
                             fetchPlayers();
                             setLoading(false);
                           }
                        }}
                      >
                        Undo Sale
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {allPlayers.filter(p => p.auction_status === "sold" || p.status === "Sold").length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-24 text-slate-300 font-black uppercase tracking-widest">
                      No sold players found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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
