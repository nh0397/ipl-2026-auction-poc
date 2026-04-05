"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ScorecardViewer from "@/components/scoreboard/ScorecardViewer";
import { adaptCricApiToScorecardViewer } from "@/lib/adapters/cricapiScorecard";
import { aggregateFantasyRowsFromCricApiMatchData } from "@/lib/cricapiFantasyAggregate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { FantasyPjBreakdownPanel } from "@/components/fantasy/FantasyPjBreakdownPanel";

type CricApiEnvelope = {
  status?: string;
  data?: Record<string, unknown>;
  info?: { hitsToday?: number; hitsLimit?: number };
  error?: string;
};

export default function CricApiFantasyPage() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("matchId") || searchParams.get("id") || "";

  const [matchIdInput, setMatchIdInput] = useState(initialId);
  const [envelope, setEnvelope] = useState<CricApiEnvelope | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const q = searchParams.get("matchId") || searchParams.get("id");
    if (q) setMatchIdInput(q);
  }, [searchParams]);

  const load = useCallback(async (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) {
      setLoadError("Enter a CricAPI match id (UUID).");
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/cricapi/match-scorecard?matchId=${encodeURIComponent(trimmed)}`);
      const json = (await res.json()) as CricApiEnvelope;
      if (!res.ok) {
        setEnvelope(null);
        setLoadError((json as { error?: string }).error || `HTTP ${res.status}`);
        return;
      }
      setEnvelope(json);
      if (json.status !== "success" || !json.data) {
        setLoadError(json.error || "CricAPI did not return success or data.");
      }
    } catch (e) {
      setEnvelope(null);
      setLoadError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialId.trim()) void load(initialId);
  }, [initialId, load]);

  const viewerPayload = useMemo(() => {
    if (!envelope?.data) return null;
    return adaptCricApiToScorecardViewer(envelope.data as Parameters<typeof adaptCricApiToScorecardViewer>[0]);
  }, [envelope]);

  const fantasyRows = useMemo(() => {
    if (!envelope?.data) return [];
    return aggregateFantasyRowsFromCricApiMatchData(envelope.data);
  }, [envelope]);

  const matchTitle = String(envelope?.data?.name || viewerPayload?.match_info?.title || "");

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 pb-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">CricAPI scorecard & PJ points</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fetches <code className="rounded bg-muted px-1 py-0.5 text-xs">match_scorecard</code> via the server route (key stays on the server). Paste a match id or open with{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">?matchId=&lt;uuid&gt;</code>.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Load match</CardTitle>
          <CardDescription>CricAPI match id (changes per fixture).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label htmlFor="match-id" className="text-xs text-muted-foreground">
              Match ID
            </label>
            <Input
              id="match-id"
              value={matchIdInput}
              onChange={(e) => setMatchIdInput(e.target.value)}
              placeholder="736f3e02-212a-49bc-8b3b-08a106312702"
              className="font-mono text-sm"
            />
          </div>
          <Button type="button" disabled={loading} onClick={() => void load(matchIdInput)} className="shrink-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Loading…" : "Load"}
          </Button>
        </CardContent>
      </Card>

      {loadError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{loadError}</div>
      ) : null}

      {envelope?.info ? (
        <p className="text-xs text-muted-foreground">
          API quota: {envelope.info.hitsToday ?? "—"} / {envelope.info.hitsLimit ?? "—"} hits today (info from CricAPI).
        </p>
      ) : null}

      {viewerPayload ? (
        <div className="space-y-3">
          {matchTitle ? <h2 className="text-lg font-medium">{matchTitle}</h2> : null}
          <ScorecardViewer scorecard={viewerPayload} />
        </div>
      ) : null}

      {fantasyRows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PJ rules — points by player</CardTitle>
            <CardDescription>
              Aggregated from batting, bowling, and fielding rows in the CricAPI scorecard. Dot balls are not available from this API (shown as 0). Playing XI +4 is applied when
              inferred lineup is used; adjust in code if you need stricter announced-XI handling.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">PJ (after ×)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fantasyRows.map((row) => {
                  const open = expanded === row.player_id;
                  const { breakdown, scoring, d11 } = row;
                  const mult = d11.appliedMultiplier;
                  return (
                    <React.Fragment key={row.player_id}>
                      <TableRow className="cursor-pointer" onClick={() => setExpanded(open ? null : row.player_id)}>
                        <TableCell className="align-middle">
                          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{row.player_name}</div>
                          <div className="text-xs text-muted-foreground">{row.fantasy.playerRole}</div>
                        </TableCell>
                        <TableCell>
                          {row.team ? <Badge variant="secondary">{row.team}</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="tabular-nums font-semibold">
                            {d11.multipliedTotal % 1 === 0 ? d11.multipliedTotal : d11.multipliedTotal.toFixed(2)}
                          </div>
                          {mult > 1 ? (
                            <div className="text-xs text-amber-800">×{mult} on {scoring.total_pts} base</div>
                          ) : (
                            <div className="text-xs text-muted-foreground">Base (1×)</div>
                          )}
                        </TableCell>
                      </TableRow>
                      {open ? (
                        <TableRow>
                          <TableCell colSpan={4} className="bg-muted/30 p-4 sm:p-6">
                            <FantasyPjBreakdownPanel breakdown={breakdown} scoring={scoring} d11={d11} />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : envelope?.data && !loading ? (
        <p className="text-sm text-muted-foreground">No player rows to show (empty scorecard?).</p>
      ) : null}
    </div>
  );
}
