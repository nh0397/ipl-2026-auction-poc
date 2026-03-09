"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp, Users, Info } from "lucide-react";

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        setProfile(data);
      }
    };
    fetchProfile();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900 leading-normal">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tight text-slate-900">
              Auction Dashboard
            </h1>
            <p className="text-slate-500 font-medium text-lg mt-1">
              Welcome back, <span className="text-blue-600 font-bold">{profile?.full_name || "Participant"}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 px-6 py-3 rounded-2xl text-white">
              <span className="text-xs font-black uppercase tracking-widest block opacity-70">Remaining Budget</span>
              <span className="text-2xl font-black">{profile?.budget || 0} Cr</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-3xl border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-blue-50 py-4 px-6">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-blue-600 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Live Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <span className="text-3xl font-black text-slate-900">Waiting...</span>
              <p className="text-slate-500 font-medium mt-1 text-sm">Auction will start shortly</p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 py-4 px-6">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Players Owned
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <span className="text-3xl font-black text-slate-900">0</span>
              <p className="text-slate-500 font-medium mt-1 text-sm text-slate-400">Build your squad</p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 py-4 px-6">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Total Spent
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <span className="text-3xl font-black text-slate-900">0 Cr</span>
              <p className="text-slate-500 font-medium mt-1 text-sm text-slate-400">of 120 Cr budget</p>
            </CardContent>
          </Card>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50/30 p-6 rounded-3xl border border-blue-100 flex gap-4 items-start">
          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
            <Info className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h4 className="text-blue-900 font-black text-sm uppercase mb-1">Getting Started</h4>
            <p className="text-blue-800 text-sm font-medium leading-relaxed opacity-80">
              The real-time bidding arena will appear here once the Admin starts the first player auction. Keep this page open to catch every bid!
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
