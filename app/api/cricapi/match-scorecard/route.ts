import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CRICAPI_BASE = "https://api.cricapi.com/v1/match_scorecard";

function stripSecrets(body: unknown): unknown {
  if (body === null || typeof body !== "object") return body;
  const o = { ...(body as Record<string, unknown>) };
  delete o.apikey;
  if (o.data && typeof o.data === "object") {
    const d = { ...(o.data as Record<string, unknown>) };
    delete d.apikey;
    o.data = d;
  }
  return o;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || req.nextUrl.searchParams.get("matchId");
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing query parameter: id or matchId" }, { status: 400 });
  }

  const key = process.env.CRICAPI_KEY || process.env.NEXT_PUBLIC_CRICAPI_KEY;
  if (!key) {
    return NextResponse.json({ error: "Server missing CRICAPI_KEY (or NEXT_PUBLIC_CRICAPI_KEY)" }, { status: 500 });
  }

  const url = new URL(CRICAPI_BASE);
  url.searchParams.set("apikey", key);
  url.searchParams.set("id", id.trim());

  const res = await fetch(url.toString(), { cache: "no-store" });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON from CricAPI" }, { status: 502 });
  }

  return NextResponse.json(stripSecrets(json), { status: res.ok ? 200 : res.status });
}
