"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy, Shield, User, ArrowLeft, RefreshCw, Settings, Save } from "lucide-react";
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
    };

    checkAuth();
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

        {/* Info Box */}
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
