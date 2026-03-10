"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  profile: any;
  onUpdated: () => void;
}

export function TeamNamePrompt({ profile, onUpdated }: Props) {
  const [name, setName] = useState(profile?.team_name || "");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const isDefault = !profile?.team_name || profile.team_name === "New Franchise";

  // Auto-show if default
  const showPrompt = isDefault || editing;

  if (!showPrompt) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-all group"
      >
        <span className="text-sm font-black text-slate-900 italic">{profile.team_name}</span>
        <Pencil size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from("profiles").update({ team_name: name.trim() }).eq("id", profile.id);
    setSaving(false);
    setEditing(false);
    onUpdated();
  };

  return (
    <div className="bg-blue-600 rounded-2xl p-6 text-white">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">
        {isDefault ? "Welcome! Name Your Franchise" : "Edit Team Name"}
      </h3>
      <p className="text-sm text-white/80 mb-4">
        {isDefault
          ? "Before we begin, give your franchise an identity."
          : "Update your franchise name."}
      </p>
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Chennai Super Kings"
          className="h-11 bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-xl font-bold focus:ring-2 focus:ring-white/50"
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <Button
          onClick={save}
          disabled={saving || !name.trim()}
          className="h-11 px-6 bg-white text-blue-600 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-white/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
        {!isDefault && (
          <Button
            onClick={() => setEditing(false)}
            className="h-11 px-4 bg-white/10 text-white rounded-xl font-bold text-sm hover:bg-white/20"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
