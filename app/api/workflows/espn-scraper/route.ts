import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function resolveRepo() {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  if (owner && repo) return { owner, repo };

  const composite = process.env.GITHUB_REPOSITORY;
  if (!composite || !composite.includes("/")) return null;
  const [o, r] = composite.split("/");
  if (!o || !r) return null;
  return { owner: o, repo: r };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "Admin") {
    return NextResponse.json({ error: "Forbidden: admin access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const dateIst = String(body?.dateIst ?? "").trim();
  if (dateIst && !/^\d{4}-\d{2}-\d{2}$/.test(dateIst)) {
    return NextResponse.json({ error: "Invalid dateIst. Expected YYYY-MM-DD." }, { status: 400 });
  }

  const repo = resolveRepo();
  const token = process.env.GITHUB_WORKFLOW_DISPATCH_TOKEN;
  const ref = process.env.GITHUB_WORKFLOW_REF || "main";
  if (!repo || !token) {
    return NextResponse.json(
      {
        error:
          "Server missing GitHub workflow config. Set GITHUB_WORKFLOW_DISPATCH_TOKEN and repo envs.",
      },
      { status: 503 }
    );
  }

  const workflowId = "espn-scraper.yml";
  const dispatchRes = await fetch(
    `https://api.github.com/repos/${repo.owner}/${repo.repo}/actions/workflows/${workflowId}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref,
        inputs: {
          date_ist: dateIst,
        },
      }),
      cache: "no-store",
    }
  );

  if (!dispatchRes.ok) {
    const detail = await dispatchRes.text().catch(() => "");
    return NextResponse.json(
      { error: `GitHub workflow dispatch failed (${dispatchRes.status})`, detail },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "ESPN scraper workflow dispatched.",
    workflow: workflowId,
    dateIst: dateIst || null,
    ref,
  });
}
