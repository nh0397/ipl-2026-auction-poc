"use client";

import { cn } from "@/lib/utils";
import type { D11BonusMultiplierInfo, PjRulesBreakdownLine, PjRulesDetailedBreakdown } from "@/lib/scoring";

export type FantasyPjScoringSlice = {
  batting_pts: number;
  bowling_pts: number;
  fielding_pts: number;
  extra_pts: number;
  total_pts: number;
};

function BreakdownLines({ title, lines }: { title: string; lines: PjRulesBreakdownLine[] }) {
  if (!lines?.length) return null;
  return (
    <div className="space-y-2 min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <ul className="space-y-2.5 text-sm">
        {lines.map((line, i) => (
          <li
            key={i}
            className="border-b border-slate-100 pb-2.5 last:border-0 last:pb-0"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900 leading-snug">{line.label}</div>
                {line.detail ? (
                  <div className="mt-0.5 text-xs leading-relaxed text-slate-600">{line.detail}</div>
                ) : null}
              </div>
              <span
                className={cn(
                  "tabular-nums font-semibold shrink-0 sm:pt-0.5 sm:text-right",
                  line.pts < 0 ? "text-rose-600" : "text-slate-900"
                )}
              >
                {line.pts > 0 ? "+" : ""}
                {line.pts % 1 === 0 ? line.pts : line.pts.toFixed(1)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function D11MultiplierBlock({
  d11,
  baseTotal,
}: {
  d11: D11BonusMultiplierInfo & { multipliedTotal: number };
  baseTotal: number;
}) {
  const m = d11.appliedMultiplier;
  const boosted = m > 1;
  return (
    <div
      className={cn(
        "rounded-xl border p-3 text-xs leading-relaxed",
        boosted ? "border-amber-200 bg-amber-50/90 text-amber-950" : "border-slate-200 bg-slate-50/80 text-slate-700"
      )}
    >
      <div className={cn("font-black uppercase tracking-wide", boosted ? "text-amber-900" : "text-slate-600")}>
        Haul multiplier (runs & wickets tiers)
      </div>
      <p className="mt-1 text-[11px] text-slate-600">
        Higher of run-based or wicket-based tier applies to <span className="font-semibold">base total</span> for this match.
      </p>
      <ul className="mt-2 space-y-1.5 font-mono text-[11px] tabular-nums">
        <li className="flex flex-wrap justify-between gap-x-2 gap-y-0.5">
          <span className="text-slate-600">Runs ({d11.runTierLabel})</span>
          <span className="font-semibold">{d11.runMultiplier}×</span>
        </li>
        <li className="flex flex-wrap justify-between gap-x-2 gap-y-0.5">
          <span className="text-slate-600">Wickets ({d11.wicketTierLabel})</span>
          <span className="font-semibold">{d11.wicketMultiplier}×</span>
        </li>
        <li className="flex flex-wrap justify-between gap-x-2 gap-y-0.5 border-t border-slate-200/80 pt-2 font-sans">
          <span className="font-semibold text-slate-800">Applied</span>
          <span className="font-black">
            {m}×
            {d11.appliedSource !== "none" ? (
              <span className="ml-1 font-normal text-slate-500">
                (
                {d11.appliedSource === "runs"
                  ? "runs tier"
                  : d11.appliedSource === "wickets"
                    ? "wickets tier"
                    : d11.appliedSource === "both"
                      ? "tie — same × both sides"
                      : "none"}
                )
              </span>
            ) : null}
          </span>
        </li>
      </ul>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-200/80 pt-2">
        <span className="text-slate-600">Base</span>
        <span className="font-bold tabular-nums text-slate-900">{baseTotal % 1 === 0 ? baseTotal : baseTotal.toFixed(2)}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className={cn("font-black uppercase tracking-wide", boosted ? "text-amber-900" : "text-slate-700")}>
          After multiplier
        </span>
        <span className={cn("text-lg font-black tabular-nums", boosted ? "text-amber-950" : "text-slate-900")}>
          {d11.multipliedTotal % 1 === 0 ? d11.multipliedTotal : d11.multipliedTotal.toFixed(2)}
        </span>
      </div>
      {boosted ? (
        <p className="mt-2 text-[10px] text-amber-900/80">
          ≈ base × {m} = {baseTotal} × {m} → rounded where applicable.
        </p>
      ) : null}
    </div>
  );
}

/** PJ Rules line-by-line breakdown + composite totals + optional Dream11-style haul multiplier. */
export function FantasyPjBreakdownPanel({
  breakdown,
  scoring,
  d11,
  baseTotalLabel = "Base (this match)",
}: {
  breakdown: PjRulesDetailedBreakdown;
  scoring: FantasyPjScoringSlice;
  d11?: D11BonusMultiplierInfo & { multipliedTotal: number };
  baseTotalLabel?: string;
}) {
  const base = scoring.total_pts;

  return (
    <div className="space-y-4 min-w-0">
      <div className="grid gap-5 sm:grid-cols-2">
        <BreakdownLines title="Batting" lines={breakdown.batting} />
        <BreakdownLines title="Bowling" lines={breakdown.bowling} />
        <BreakdownLines title="Fielding" lines={breakdown.fielding} />
        <BreakdownLines title="Extras (XI / substitute)" lines={breakdown.extras} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs shadow-sm">
        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Composite (matches PJ rules total)</div>
        <ul className="mt-2 space-y-1.5 tabular-nums">
          <li className="flex justify-between gap-3">
            <span className="text-slate-600">Batting (incl. strike rate)</span>
            <span className="font-semibold text-slate-900">{scoring.batting_pts}</span>
          </li>
          <li className="flex justify-between gap-3">
            <span className="text-slate-600">Bowling (incl. economy)</span>
            <span className="font-semibold text-slate-900">{scoring.bowling_pts}</span>
          </li>
          <li className="flex justify-between gap-3">
            <span className="text-slate-600">Fielding</span>
            <span className="font-semibold text-slate-900">{scoring.fielding_pts}</span>
          </li>
          <li className="flex justify-between gap-3">
            <span className="text-slate-600">Extras</span>
            <span className="font-semibold text-slate-900">{scoring.extra_pts}</span>
          </li>
          <li className="flex justify-between gap-3 border-t border-slate-100 pt-2 font-black text-slate-900">
            <span>{baseTotalLabel}</span>
            <span>{base % 1 === 0 ? base : base.toFixed(2)}</span>
          </li>
        </ul>
      </div>

      {d11 ? <D11MultiplierBlock d11={d11} baseTotal={base} /> : null}
    </div>
  );
}
