type WorkflowDispatchResult =
  | { status: "triggered" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

const DEFAULT_OWNER = "07-hajime-tokyo";
const DEFAULT_REPO = "youtube-production-hub3";
const DEFAULT_WORKFLOW = "transcribe-worker.yml";
const DEFAULT_REF = "main";

export async function triggerTranscribeWorkflow(): Promise<WorkflowDispatchResult> {
  const token = process.env.GITHUB_ACTIONS_TOKEN;
  if (!token) return { status: "skipped", reason: "GITHUB_ACTIONS_TOKEN is not configured." };

  const owner = process.env.GITHUB_ACTIONS_OWNER || DEFAULT_OWNER;
  const repo = process.env.GITHUB_ACTIONS_REPO || DEFAULT_REPO;
  const workflow = process.env.GITHUB_TRANSCRIBE_WORKFLOW || DEFAULT_WORKFLOW;
  const ref = process.env.GITHUB_ACTIONS_REF || DEFAULT_REF;

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ ref }),
  });

  if (response.status === 204) return { status: "triggered" };

  const detail = await response.text().catch(() => "");
  return {
    status: "failed",
    reason: `GitHub workflow dispatch failed: ${response.status}${detail ? ` ${detail}` : ""}`,
  };
}
