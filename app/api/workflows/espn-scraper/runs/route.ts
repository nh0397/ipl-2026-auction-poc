import { NextResponse } from "next/server";
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
  }));

  return NextResponse.json({ ok: true, workflow: workflowId, runs });
}
