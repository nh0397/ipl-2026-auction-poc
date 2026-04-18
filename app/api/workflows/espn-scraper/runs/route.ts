import { NextResponse } from "next/server";
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

/** GET: last few ESPN scraper workflow runs (admin) — so the app can show completion without guessing. */
export async function GET() {
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

  const repo = resolveRepo();
  const token = process.env.GITHUB_WORKFLOW_DISPATCH_TOKEN;
  if (!repo || !token) {
    return NextResponse.json(
      { error: "Server missing GITHUB_WORKFLOW_DISPATCH_TOKEN or repo envs." },
      { status: 503 }
    );
  }

  const workflowId = "espn-scraper.yml";
  const res = await fetch(
    `https://api.github.com/repos/${repo.owner}/${repo.repo}/actions/workflows/${encodeURIComponent(workflowId)}/runs?per_page=8`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `GitHub API error (${res.status})`, detail },
      { status: 502 }
    );
  }

  const data = (await res.json()) as {
    workflow_runs?: Array<{
      id: number;
      name: string | null;
      status: string;
      conclusion: string | null;
      created_at: string;
      updated_at: string;
      html_url: string;
      run_number: number;
      event: string;
      actor?: { login?: string | null } | null;
    }>;
  };

  const runs = (data.workflow_runs || []).map((r) => ({
    id: r.id,
    runNumber: r.run_number,
    status: r.status,
    conclusion: r.conclusion,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    htmlUrl: r.html_url,
    event: r.event,
    actor: r.actor?.login ?? null,
  }));

  let latestRunJobs: Array<{
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    startedAt: string | null;
    completedAt: string | null;
    steps: Array<{ number: number; name: string; status: string; conclusion: string | null }>;
  }> = [];
  if (runs.length > 0) {
    try {
      const jobsRes = await fetch(
        `https://api.github.com/repos/${repo.owner}/${repo.repo}/actions/runs/${runs[0].id}/jobs?per_page=50`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );
      if (jobsRes.ok) {
        const jobsJson = (await jobsRes.json()) as {
          jobs?: Array<{
            id: number;
            name: string;
            status: string;
            conclusion: string | null;
            started_at: string | null;
            completed_at: string | null;
            steps?: Array<{
              number: number;
              name: string;
              status: string;
              conclusion: string | null;
            }>;
          }>;
        };
        latestRunJobs = (jobsJson.jobs || []).map((j) => ({
          id: j.id,
          name: j.name,
          status: j.status,
          conclusion: j.conclusion,
          startedAt: j.started_at,
          completedAt: j.completed_at,
          steps: (j.steps || []).map((s) => ({
            number: s.number,
            name: s.name,
            status: s.status,
            conclusion: s.conclusion,
          })),
        }));
      }
    } catch {
      // Non-fatal.
    }
  }

  let triggerAudit: Array<{
    id: number;
    created_at: string;
    app_user_id: string;
    app_user_email: string | null;
    date_ist: string | null;
    github_run_id: number | null;
    github_run_number: number | null;
  }> = [];
  try {
    const admin = createAdminClient();
    if (admin) {
      const { data: audits } = await admin
        .from("workflow_dispatch_events")
        .select("id,created_at,app_user_id,app_user_email,date_ist,github_run_id,github_run_number")
        .order("created_at", { ascending: false })
        .limit(12);
      triggerAudit =
        (audits as Array<{
          id: number;
          created_at: string;
          app_user_id: string;
          app_user_email: string | null;
          date_ist: string | null;
          github_run_id: number | null;
          github_run_number: number | null;
        }>) || [];
    }
  } catch {
    // Non-fatal.
  }

  return NextResponse.json({
    ok: true,
    workflow: workflowId,
    runs,
    latestRunJobs,
    triggerAudit,
  });
}
