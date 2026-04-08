"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { isIconPlayer, type FranchiseCvcRow } from "@/lib/franchiseCvc";
import { Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
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
  const [local, setLocal] = useState<
    Record<number, { captain_id: string; captain_from: string; vice_id: string; vice_from: string }>
  >(() => {
    const init: Record<number, { captain_id: string; captain_from: string; vice_id: string; vice_from: string }> = {};
    for (const s of SLOTS) {
      const r = rowForSlot(rows, franchiseId, s);
      init[s] = {
        captain_id: r?.captain_id ?? "",
        vice_id: r?.vice_captain_id ?? "",
        captain_from: (r?.captain_valid_from ?? r?.valid_from ?? "") as string,
        vice_from: (r?.vice_valid_from ?? r?.valid_from ?? "") as string,
      };
    }
    return init;
  });

  useEffect(() => {
    setLocal(() => {
      const next: Record<number, { captain_id: string; captain_from: string; vice_id: string; vice_from: string }> = {};
      for (const s of SLOTS) {
        const r = rowForSlot(rows, franchiseId, s);
        next[s] = {
          captain_id: r?.captain_id ?? "",
          vice_id: r?.vice_captain_id ?? "",
          captain_from: (r?.captain_valid_from ?? r?.valid_from ?? "") as string,
          vice_from: (r?.vice_valid_from ?? r?.valid_from ?? "") as string,
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
        const hasAny = !!(st.captain_id || st.vice_id || st.captain_from || st.vice_from);
        const hasCaptain = !!(st.captain_id && st.captain_from);
        const hasVice = !!(st.vice_id && st.vice_from);
        if (hasAny) {
          if (st.captain_id && !st.captain_from) {
            toast.error(`Slot ${slot}: Pick a Captain effective date.`);
            return;
          }
          if (st.vice_id && !st.vice_from) {
            toast.error(`Slot ${slot}: Pick a Vice Captain effective date.`);
            return;
          }
          if (hasCaptain && hasVice && st.captain_id === st.vice_id) {
            toast.error(`Slot ${slot}: Captain and Vice Captain must be different players.`);
            return;
          }
          const { error } = await supabase.from("franchise_cvc_selections").upsert(
            {
              team_id: franchiseId,
              slot,
              captain_id: st.captain_id || null,
              vice_captain_id: st.vice_id || null,
              // Keep legacy `valid_from` populated so older code/queries remain sane.
              valid_from: (st.captain_from || st.vice_from) as string,
              captain_valid_from: st.captain_from || null,
              vice_valid_from: st.vice_from || null,
            },
            { onConflict: "team_id,slot" }
          );
          if (error) {
            toast.error(error.message);
            return;
          }
        } else {
          const { error } = await supabase
            .from("franchise_cvc_selections")
            .delete()
            .eq("team_id", franchiseId)
            .eq("slot", slot);
          if (error) {
            toast.error(error.message);
            return;
          }
        }
      }
      toast.success("Captain / Vice Captain saved");
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="rounded-2xl border border-slate-200 bg-amber-50/40 shadow-sm overflow-hidden" open>
      <summary className="cursor-pointer list-none p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Shield className="h-4 w-4 text-amber-800" aria-hidden />
          <h3 className="text-[11px] font-black uppercase tracking-widest text-amber-950">
            Captain &amp; Vice Captain
          </h3>
          <span className="text-[9px] font-bold text-amber-900/70">
            Separate effective dates · Captain 2× · Vice 1.5× · franchise Icon excluded
          </span>
        </div>
        <p className="mt-1 text-[10px] font-bold text-amber-900/80">
          On each match day, the latest effective Captain and latest effective Vice are applied independently. {franchiseLabel}
        </p>
      </summary>
      <div className="px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="space-y-3">
        {SLOTS.map((slot) => {
          const st = local[slot];
          return (
            <div
              key={slot}
              className={cn(
                "grid gap-2 rounded-xl border border-amber-200/80 bg-white/70 p-3 sm:grid-cols-[auto_1fr_1fr] sm:items-start",
                !canEdit && "opacity-80"
              )}
            >
              <span className="text-[10px] font-black text-amber-900">Slot {slot}</span>

              {/* Captain group: name + effective date */}
              <div className="rounded-lg border border-slate-200 bg-white p-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Captain</span>
                  <span className="text-[9px] font-bold text-slate-400">2×</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                  <select
                    disabled={!canEdit}
                    value={st.captain_id}
                    onChange={(e) =>
                      setLocal((prev) => ({ ...prev, [slot]: { ...prev[slot], captain_id: e.target.value } }))
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-800"
                  >
                    <option value="">Captain…</option>
                    {eligible.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.player_name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    disabled={!canEdit}
                    value={st.captain_from}
                    onChange={(e) =>
                      setLocal((prev) => ({ ...prev, [slot]: { ...prev[slot], captain_from: e.target.value } }))
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-800"
                    title="Captain effective from (IST date)"
                  />
                </div>
              </div>

              {/* Vice group: name + effective date */}
              <div className="rounded-lg border border-slate-200 bg-white p-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Vice</span>
                  <span className="text-[9px] font-bold text-slate-400">1.5×</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                  <select
                    disabled={!canEdit}
                    value={st.vice_id}
                    onChange={(e) =>
                      setLocal((prev) => ({ ...prev, [slot]: { ...prev[slot], vice_id: e.target.value } }))
                    }
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
                    value={st.vice_from}
                    onChange={(e) =>
                      setLocal((prev) => ({ ...prev, [slot]: { ...prev[slot], vice_from: e.target.value } }))
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-800"
                    title="Vice effective from (IST date)"
                  />
                </div>
              </div>
            </div>
          );
        })}
        </div>
        {canEdit ? (
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={save}
              className="rounded-xl bg-amber-900 font-black uppercase tracking-widest text-[10px] text-white hover:bg-amber-950"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save C/VC
            </Button>
          </div>
        ) : null}
      </div>
    </details>
  );
}
