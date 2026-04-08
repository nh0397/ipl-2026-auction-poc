"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { FranchiseIconRow } from "@/lib/franchiseCvc";

type Player = { id: string; player_name: string; team?: string | null };

type Props = {
  franchiseId: string;
  franchiseLabel: string;
  squad: Player[];
  row: FranchiseIconRow | null | undefined;
  canEdit: boolean;
  onSaved: () => void;
};

export function FranchiseIconPanel({ franchiseId, franchiseLabel, squad, row, canEdit, onSaved }: Props) {
  const locked = !!row?.player_id;
  const [playerId, setPlayerId] = useState(row?.player_id ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPlayerId(row?.player_id ?? "");
  }, [row?.player_id, franchiseId]);

  const save = async () => {
    if (!canEdit || locked) return;
    if (!playerId) {
      alert("Pick one player as Icon.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("franchise_icon_selection").insert({
        team_id: franchiseId,
        player_id: playerId,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Franchise Icon saved");
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-800" aria-hidden />
        <h3 className="text-[11px] font-black uppercase tracking-widest text-violet-950">Franchise Icon (2× all games)</h3>
      </div>
      <p className="mb-3 text-[10px] font-bold text-violet-900/85">
        One pick per franchise for {franchiseLabel}. Doubles stored fantasy points (base points × performance multipliers) for every game; cannot be changed after save.
        Icon cannot be Captain/Vice in the slots below.
      </p>
      {locked ? (
        <p className="text-[11px] font-black text-violet-950">
          Locked:{" "}
          <span className="font-mono">
            {squad.find((p) => p.id === row?.player_id)?.player_name ?? row?.player_id}
          </span>
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            disabled={!canEdit}
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className="h-9 min-w-[200px] rounded-lg border border-violet-200 bg-white px-2 text-[11px] font-bold text-slate-800"
          >
            <option value="">Choose Icon…</option>
            {squad.map((p) => (
              <option key={p.id} value={p.id}>
                {p.player_name}
              </option>
            ))}
          </select>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              disabled={saving || !playerId}
              onClick={save}
              className="rounded-xl bg-violet-900 font-black uppercase tracking-widest text-[10px] text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save Icon (once)
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
