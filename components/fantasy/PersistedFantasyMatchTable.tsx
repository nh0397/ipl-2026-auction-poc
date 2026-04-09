"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPoints2 } from "@/lib/pointsPrecision";
import type { PersistedFantasyRow } from "@/lib/persistedFantasyRowsFromMatchPoints";
type Props = {
  rows: PersistedFantasyRow[];
  /** e.g. match_points_espn — shown above the table */
  sourceTableLabel: string;
  expandedPlayerId: string | null;
  onToggleExpand: (playerId: string | null) => void;
  loading?: boolean;
  emptyMessage?: string;
  /**
   * Optional rule-by-rule breakdown from the stored scorecard (recomputed).
   * Table Base/Total stay DB-backed; this is explanatory only.
   */
  renderScorecardDetail?: (row: PersistedFantasyRow) => React.ReactNode;
};

export function PersistedFantasyMatchTable({
  rows,
  sourceTableLabel,
  expandedPlayerId,
  onToggleExpand,
  loading,
  emptyMessage = "No persisted points for this match yet — run Sync on the Sheets tab.",
  renderScorecardDetail,
}: Props) {
  if (loading) {
    return (
      <p className="text-center text-sm font-bold text-slate-400 py-16 uppercase tracking-wide">Loading sheet points…</p>
    );
  }

  if (!rows.length) {
    return (
      <p className="text-center text-sm font-bold text-slate-400 py-16 px-2 leading-relaxed">{emptyMessage}</p>
    );
  }

  return (
    <div className="space-y-2 min-w-0">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide px-1">
        Same data as the scoreboard sheet (
        <code className="font-mono text-slate-700">{sourceTableLabel}</code>
        ). Base points before haul; total after haul.
      </p>
      <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-slate-100">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 sm:w-10 px-2 sm:px-4" />
              <TableHead className="min-w-[7rem] max-w-[40vw]">Player</TableHead>
              <TableHead className="min-w-[4rem]">Team</TableHead>
              <TableHead className="text-right whitespace-nowrap">Base</TableHead>
              <TableHead className="text-right whitespace-nowrap">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const open = expandedPlayerId === row.player_id;
              const mult = row.haul_applied_mult != null && Number.isFinite(row.haul_applied_mult) ? row.haul_applied_mult : 1;
              const hasHaul = mult > 1;
              const isDnp = row.points === null;
              return (
                <React.Fragment key={row.player_id}>
                  <TableRow
                    className="cursor-pointer touch-manipulation"
                    onClick={() => onToggleExpand(open ? null : row.player_id)}
                  >
                    <TableCell className="px-2 sm:px-4 align-top">{open ? "▼" : "▶"}</TableCell>
                    <TableCell className="max-w-[40vw] sm:max-w-none align-top">
                      <div className="font-semibold text-slate-900 text-sm leading-snug break-words">{row.player_name}</div>
                      {row.manual_override ? (
                        <Badge variant="outline" className="mt-1 text-[9px] font-black uppercase">
                          manual
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top">
                      {row.team ? (
                        <Badge
                          variant="secondary"
                          className="whitespace-normal text-center max-w-[6rem] sm:max-w-none break-words"
                        >
                          {row.team}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right align-top whitespace-nowrap tabular-nums font-bold text-slate-800">
                      {row.base_points == null ? "—" : formatPoints2(row.base_points)}
                    </TableCell>
                    <TableCell className="text-right align-top whitespace-nowrap">
                      {isDnp ? (
                        <span className="text-[11px] font-black uppercase text-slate-400">DNP</span>
                      ) : (
                        <>
                          <div className="font-bold tabular-nums text-slate-900">{formatPoints2(Number(row.points) || 0)}</div>
                          {hasHaul && row.base_points != null ? (
                            <div className="text-[10px] font-medium text-amber-800">
                              ×{formatPoints2(mult)} on {formatPoints2(row.base_points)} base
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-500">Haul 1×</div>
                          )}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                  {open ? (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-slate-50 p-3 sm:p-4">
                        <div className="text-xs space-y-2 text-slate-700 max-w-3xl">
                          <div className="font-black uppercase tracking-wide text-slate-500 text-[10px]">
                            Stored breakdown (database)
                          </div>
                          <ul className="font-mono text-[11px] space-y-1 tabular-nums">
                            <li className="flex justify-between gap-4">
                              <span>Base points (before haul)</span>
                              <span>{row.base_points == null ? "—" : formatPoints2(row.base_points)}</span>
                            </li>
                            <li className="flex justify-between gap-4">
                              <span>Haul run tier</span>
                              <span>{row.haul_run_mult == null ? "—" : `${formatPoints2(row.haul_run_mult)}×`}</span>
                            </li>
                            <li className="flex justify-between gap-4">
                              <span>Haul wicket tier</span>
                              <span>{row.haul_wicket_mult == null ? "—" : `${formatPoints2(row.haul_wicket_mult)}×`}</span>
                            </li>
                            <li className="flex justify-between gap-4 border-t border-slate-200 pt-2 font-sans font-bold">
                              <span>Applied haul ×</span>
                              <span>{row.haul_applied_mult == null ? "—" : `${formatPoints2(row.haul_applied_mult)}×`}</span>
                            </li>
                            <li className="flex justify-between gap-4 font-sans font-black text-slate-900">
                              <span>Total stored (after haul)</span>
                              <span>{isDnp ? "DNP (NULL)" : formatPoints2(Number(row.points) || 0)}</span>
                            </li>
                          </ul>
                          {renderScorecardDetail ? (
                            <div className="mt-4 pt-4 border-t border-slate-200 space-y-3 min-w-0">
                              {(() => {
                                const detail = renderScorecardDetail(row);
                                return detail ? (
                                  <>
                                    {detail}
                                    <p className="text-[10px] text-amber-900/90 leading-snug normal-case font-sans">
                                      Rule-by-rule block above is recomputed from the stored scorecard for context. The row
                                      Base/Total match the sheet (database); they can differ from &quot;Base from scorecard
                                      rules&quot; after manual overrides, MoM, or until points are synced.
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-[10px] text-slate-500 leading-snug normal-case font-sans">
                                    No scorecard-derived lines for this player (missing scorecard, or name/team did not match the
                                    card).
                                  </p>
                                );
                              })()}
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-500 leading-snug normal-case font-sans">
                              Line-by-line points breakdown is not stored in the database; only these totals. The Scorecard tab
                              shows the raw match card.
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
