"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { isIconPlayer, type FranchiseCvcRow } from "@/lib/franchiseCvc";
import { Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

type Player = { id: string; player_name: string; team?: string | null; type?: string | null; role?: string | null };

type Props = {
  franchiseId: string;
  franchiseLabel: string;
  squad: Player[];
  rows: FranchiseCvcRow[];
  /** Franchise Icon player id — cannot be C/VC */
  franchiseIconPlayerId?: string | null;
  canEdit: boolean;
  onSaved: () => void;
};

const SLOTS = [1, 2, 3, 4, 5] as const;

function rowForSlot(rows: FranchiseCvcRow[], teamId: string, slot: number): FranchiseCvcRow | undefined {
  return rows.find((r) => r.team_id === teamId && r.slot === slot);
}

export function FranchiseCvcPanel({
  franchiseId,
  franchiseLabel,
  squad,
  rows,
  franchiseIconPlayerId,
  canEdit,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState<Record<number, { captain_id: string; vice_id: string; valid_from: string }>>(() => {
    const init: Record<number, { captain_id: string; vice_id: string; valid_from: string }> = {};
    for (const s of SLOTS) {
      const r = rowForSlot(rows, franchiseId, s);
      init[s] = {
        captain_id: r?.captain_id ?? "",
        vice_id: r?.vice_captain_id ?? "",
        valid_from: r?.valid_from ?? "",
      };
    }
    return init;
  });

  useEffect(() => {
    setLocal(() => {
      const next: Record<number, { captain_id: string; vice_id: string; valid_from: string }> = {};
      for (const s of SLOTS) {
        const r = rowForSlot(rows, franchiseId, s);
        next[s] = {
          captain_id: r?.captain_id ?? "",
          vice_id: r?.vice_captain_id ?? "",
          valid_from: r?.valid_from ?? "",
        };
      }
      return next;
    });
  }, [rows, franchiseId]);

  const eligible = useMemo(
    () =>
      squad.filter(
        (p) => !isIconPlayer(p) && (!franchiseIconPlayerId || p.id !== franchiseIconPlayerId)
      ),
    [squad, franchiseIconPlayerId]
  );

  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      for (const slot of SLOTS) {
        const st = local[slot];
        const hasPair = st.captain_id && st.vice_id && st.valid_from;
        if (hasPair) {
          if (st.captain_id === st.vice_id) {
            alert(`Slot ${slot}: Captain and Vice Captain must be different players.`);
            setSaving(false);
            return;
          }
          const { error } = await supabase.from("franchise_cvc_selections").upsert(
            {
              team_id: franchiseId,
              slot,
              captain_id: st.captain_id,
              vice_captain_id: st.vice_id,
              valid_from: st.valid_from,
            },
            { onConflict: "team_id,slot" }
          );
          if (error) {
            alert(error.message);
            setSaving(false);
            return;
          }
        } else {
          const { error } = await supabase
            .from("franchise_cvc_selections")
            .delete()
            .eq("team_id", franchiseId)
            .eq("slot", slot);
          if (error) {
            alert(error.message);
            setSaving(false);
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
    <div className="rounded-2xl border border-slate-200 bg-amber-50/40 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Shield className="h-4 w-4 text-amber-800" aria-hidden />
        <h3 className="text-[11px] font-black uppercase tracking-widest text-amber-950">
          Captain &amp; Vice Captain (5 dated slots)
        </h3>
        <span className="text-[9px] font-bold text-amber-900/70">
          Effective from date (IST) · Multiplies stored fantasy points (base × multipliers) by Captain 2× or Vice 1.5× · Franchise Icon and auction Icon types excluded
        </span>
      </div>
      <p className="mb-3 text-[10px] font-bold text-amber-900/80">
        For each IPL match column, the row with the latest <code className="font-mono">valid_from</code> on or before that
        match day applies. {franchiseLabel}
      </p>
      <div className="space-y-3">
        {SLOTS.map((slot) => {
          const st = local[slot];
          return (
            <div
              key={slot}
              className={cn(
                "grid gap-2 rounded-xl border border-amber-200/80 bg-white/70 p-3 sm:grid-cols-[auto_1fr_1fr_1fr_auto] sm:items-center",
                !canEdit && "opacity-80"
              )}
            >
              <span className="text-[10px] font-black text-amber-900">Slot {slot}</span>
              <select
                disabled={!canEdit}
                value={st.captain_id}
                onChange={(e) => setLocal((prev) => ({ ...prev, [slot]: { ...prev[slot], captain_id: e.target.value } }))}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-800"
              >
                <option value="">Captain…</option>
                {eligible.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.player_name}
                  </option>
                ))}
              </select>
              <select
                disabled={!canEdit}
                value={st.vice_id}
                onChange={(e) => setLocal((prev) => ({ ...prev, [slot]: { ...prev[slot], vice_id: e.target.value } }))}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-800"
              >
                <option value="">Vice…</option>
                {eligible.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.player_name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                disabled={!canEdit}
                value={st.valid_from}
                onChange={(e) => setLocal((prev) => ({ ...prev, [slot]: { ...prev[slot], valid_from: e.target.value } }))}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-800"
              />
            </div>
          );
        })}
      </div>
      {canEdit ? (
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={save}
            className="rounded-xl bg-amber-900 font-black uppercase tracking-widest text-[10px] text-white hover:bg-amber-950"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save C/VC picks
          </Button>
        </div>
      ) : null}
    </div>
  );
}
