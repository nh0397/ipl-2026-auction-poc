"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { dateKeyOnly, type FranchiseBoosterRow } from "@/lib/franchiseCvc";
import { Loader2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  franchiseId: string;
  franchiseLabel: string;
  rows: FranchiseBoosterRow[];
  canEdit: boolean;
  onSaved: () => void;
};

const SLOTS = [1, 2, 3] as const;

function rowForSlot(rows: FranchiseBoosterRow[], teamId: string, slot: number): FranchiseBoosterRow | undefined {
  return rows.find((r) => r.team_id === teamId && r.slot === slot);
}

export function FranchiseBoosterPanel({ franchiseId, franchiseLabel, rows, canEdit, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const s of SLOTS) {
      const r = rowForSlot(rows, franchiseId, s);
      init[s] = r?.booster_date ? dateKeyOnly(r.booster_date) : "";
    }
    return init;
  });

  useEffect(() => {
    setLocal(() => {
      const next: Record<number, string> = {};
      for (const s of SLOTS) {
        const r = rowForSlot(rows, franchiseId, s);
        next[s] = r?.booster_date ? dateKeyOnly(r.booster_date) : "";
      }
      return next;
    });
  }, [rows, franchiseId]);

  const save = async () => {
    if (!canEdit) return;
    const dates = SLOTS.map((s) => local[s]?.trim() || "").filter(Boolean);
    const uniq = new Set(dates);
    if (dates.length !== uniq.size) {
      alert("Booster days must be three different dates (or leave slots empty).");
      return;
    }
    setSaving(true);
    try {
      for (const slot of SLOTS) {
        const d = local[slot]?.trim() || "";
        if (d) {
          const { error } = await supabase.from("franchise_booster_days").upsert(
            { team_id: franchiseId, slot, booster_date: d },
            { onConflict: "team_id,slot" }
          );
          if (error) {
            alert(error.message);
            return;
          }
        } else {
          const { error } = await supabase
            .from("franchise_booster_days")
            .delete()
            .eq("team_id", franchiseId)
            .eq("slot", slot);
          if (error) {
            alert(error.message);
            return;
          }
        }
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-violet-50/50 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Zap className="h-4 w-4 text-violet-800" aria-hidden />
        <h3 className="text-[11px] font-black uppercase tracking-widest text-violet-950">
          Booster days (3)
        </h3>
        <span className="text-[9px] font-bold text-violet-900/75">
          Pick up to three IST calendar dates · On each, players who played score{" "}
          <span className="font-black">base × 3</span> on your sheet (no Captain/Vice or normal Icon 2×) · Franchise Icon gets{" "}
          <span className="font-black">base × 6</span>
        </span>
      </div>
      <p className="mb-3 text-[10px] font-bold text-violet-900/85">{franchiseLabel}</p>
      <div className="space-y-3">
        {SLOTS.map((slot) => (
          <div
            key={slot}
            className={cn(
              "grid gap-2 rounded-xl border border-violet-200/80 bg-white/70 p-3 sm:grid-cols-[auto_1fr] sm:items-center",
              !canEdit && "opacity-80"
            )}
          >
            <span className="text-[10px] font-black text-violet-900">Day {slot}</span>
            <input
              type="date"
              disabled={!canEdit}
              value={local[slot]}
              onChange={(e) => setLocal((prev) => ({ ...prev, [slot]: e.target.value }))}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-800"
            />
          </div>
        ))}
      </div>
      {canEdit ? (
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={save}
            className="rounded-xl bg-violet-900 font-black uppercase tracking-widest text-[10px] text-white hover:bg-violet-950"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save booster days
          </Button>
        </div>
      ) : null}
    </div>
  );
}
