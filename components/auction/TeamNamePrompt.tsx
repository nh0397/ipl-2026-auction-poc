"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Pencil, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  profile: any;
  onUpdated: () => void;
}

export function TeamNamePrompt({ profile, onUpdated }: Props) {
  const [name, setName] = useState(
    profile?.team_name && profile.team_name !== "New Franchise" ? profile.team_name : ""
  );
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const isDefault = !profile?.team_name || profile.team_name === "New Franchise";

  // Auto-show if default
  const showPrompt = isDefault || editing;

  if (!showPrompt) {
    return (
      <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Your Franchise</span>
            <span className="text-lg font-black text-slate-900 italic uppercase tracking-tighter leading-none">{profile.team_name}</span>
          </div>
        </div>
        <Button
          onClick={() => setEditing(true)}
          variant="outline"
          className="h-10 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 bg-slate-50 border-slate-200 hover:bg-slate-100 hover:text-blue-600 transition-colors w-full sm:w-auto"
        >
          <Pencil size={12} /> Edit Name
        </Button>
      </div>
    );
  }

  const save = async () => {
    const finalName = name.trim();
    if (!finalName || finalName.toLowerCase() === "new franchise") {
      alert("Please enter a custom team name to continue.");
      return;
    }
    
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ team_name: finalName }).eq("id", profile.id);
    
    if (error) {
      alert("Failed to save team name. Please try again.");
      setSaving(false);
      return;
    }
    
    setSaving(false);
    setEditing(false);
    onUpdated();
  };

  return (
    <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">
        {isDefault ? "Welcome! Name Your Franchise" : "Edit Team Name"}
      </h3>
      <p className="text-sm text-white/80 mb-4 font-medium">
        {isDefault
          ? "Before we begin, give your franchise an identity. This will be visible on the leaderboard and auction screens."
          : "Update your franchise name. Changes will reflect across the platform immediately."}
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Chennai Super Kings"
          className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-xl font-bold focus:ring-2 focus:ring-white/50 w-full sm:flex-1"
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <div className="flex gap-2">
          <Button
            onClick={save}
            disabled={saving || !name.trim() || name.trim().toLowerCase() === "new franchise"}
            className="h-12 px-8 bg-white text-blue-600 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-white/90 disabled:opacity-50 flex-1 sm:flex-none shadow-sm"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Profile"}
          </Button>
          {!isDefault && (
            <Button
              onClick={() => {
                setName(profile.team_name); // Reset to current
                setEditing(false);
              }}
              className="h-12 px-6 bg-white/10 text-white rounded-xl font-bold text-sm hover:bg-white/20 flex-1 sm:flex-none"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
