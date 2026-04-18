import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const dispatchStartedAt = new Date().toISOString();
  const requestPayload = {
    ref,
    inputs: {
      date_ist: dateIst,
    },
  };
  const dispatchRes = await fetch(
    `https://api.github.com/repos/${repo.owner}/${repo.repo}/actions/workflows/${workflowId}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
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

  // Best-effort: attach the newly created run id/number (if available quickly).
  let githubRunId: number | null = null;
  let githubRunNumber: number | null = null;
  let githubActor: string | null = null;
  try {
    const runsRes = await fetch(
      `https://api.github.com/repos/${repo.owner}/${repo.repo}/actions/workflows/${workflowId}/runs?event=workflow_dispatch&per_page=6`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );
    if (runsRes.ok) {
      const runsJson = (await runsRes.json()) as {
        workflow_runs?: Array<{
          id: number;
          run_number: number;
          created_at: string;
          actor?: { login?: string | null } | null;
        }>;
      };
      const candidate = (runsJson.workflow_runs || []).find((r) => r.created_at >= dispatchStartedAt);
      if (candidate) {
        githubRunId = candidate.id;
        githubRunNumber = candidate.run_number;
        githubActor = candidate.actor?.login ?? null;
      }
    }
  } catch {
    // Non-fatal; dispatch already succeeded.
  }

  // Best-effort audit trail: "who in the app triggered this run".
  try {
    const admin = createAdminClient();
    if (admin) {
      await admin.from("workflow_dispatch_events").insert({
        app_user_id: user.id,
        app_user_email: user.email ?? null,
        workflow_id: workflowId,
        date_ist: dateIst || null,
        ref,
        github_run_id: githubRunId,
        github_run_number: githubRunNumber,
        github_actor: githubActor,
        request_payload: requestPayload,
      });
    }
  } catch {
    // Non-fatal; dispatch already succeeded.
  }

  return NextResponse.json({
    ok: true,
    message: "ESPN scraper workflow dispatched.",
    workflow: workflowId,
    dateIst: dateIst || null,
    ref,
    githubRunId,
    githubRunNumber,
  });
}
