const { send } = require("./fetcher");

const GITHUB_CHANNEL = "chn_2468270a87e1930b";
const GITHUB_SERVER = "srv_9bc5920d83db2f21";

function formatPush(payload) {
  const branch = payload.ref?.replace("refs/heads/", "");
  const repo = payload.repository?.full_name;
  const commits = payload.commits || [];
  if (!commits.length) return null;

  const lines = commits.map((c) => `\`${c.id.slice(0, 7)}\` ${c.message}`).join("\n");
  return `**[${repo}]** ${commits.length} commit${commits.length > 1 ? "s" : ""} pushed to \`${branch}\`\n\n${lines}`;
}

function formatPullRequest(payload) {
  const { action, pull_request: pr, repository } = payload;
  const repo = repository?.full_name;
  const ref = `\`${pr.base.ref}\` ← \`${pr.head.ref}\``;

  if (action === "opened") {
    return `**[${repo}]** Pull request opened: **#${pr.number} ${pr.title}**\n${ref}`;
  }
  if (action === "closed" && pr.merged) {
    return `**[${repo}]** Pull request merged: **#${pr.number} ${pr.title}**\n${ref}`;
  }
  if (action === "closed") {
    return `**[${repo}]** Pull request closed: **#${pr.number} ${pr.title}**`;
  }
  return null;
}

function formatIssue(payload) {
  const { action, issue, repository } = payload;
  const repo = repository?.full_name;
  const label = `**#${issue.number} ${issue.title}**`;

  if (action === "opened") return `**[${repo}]** Issue opened: ${label}`;
  if (action === "closed") return `**[${repo}]** Issue closed: ${label}`;
  if (action === "reopened") return `**[${repo}]** Issue reopened: ${label}`;
  return null;
}

function formatIssueComment(payload) {
  const { action, issue, repository } = payload;
  const repo = repository?.full_name;
  if (action === "created") {
    return `**[${repo}]** New comment on **#${issue.number} ${issue.title}**`;
  }
  return null;
}

function formatCreate(payload) {
  const repo = payload.repository?.full_name;
  if (payload.ref_type === "branch") return `**[${repo}]** Branch created: \`${payload.ref}\``;
  if (payload.ref_type === "tag") return `**[${repo}]** Tag created: \`${payload.ref}\``;
  return null;
}

function formatDelete(payload) {
  const repo = payload.repository?.full_name;
  if (payload.ref_type === "branch") return `**[${repo}]** Branch deleted: \`${payload.ref}\``;
  if (payload.ref_type === "tag") return `**[${repo}]** Tag deleted: \`${payload.ref}\``;
  return null;
}

function formatRelease(payload) {
  const repo = payload.repository?.full_name;
  const rel = payload.release;
  if (payload.action === "published") {
    return `**[${repo}]** Release published: \`${rel.tag_name}\`${rel.name ? `\n${rel.name}` : ""}`;
  }
  return null;
}

function formatStar(payload) {
  const repo = payload.repository?.full_name;
  const count = payload.repository?.stargazers_count;
  if (payload.action === "created") {
    return `**[${repo}]** New star — ${count} total`;
  }
  return null;
}

function formatFork(payload) {
  const repo = payload.repository?.full_name;
  const fork = payload.forkee?.full_name;
  return `**[${repo}]** Forked${fork ? ` → ${fork}` : ""}`;
}

function formatPullRequestReview(payload) {
  const { action, pull_request: pr, review, repository } = payload;
  const repo = repository?.full_name;
  if (action !== "submitted") return null;
  const verb =
    review.state === "approved"
      ? "approved"
      : review.state === "changes_requested"
        ? "requested changes on"
        : "reviewed";
  return `**[${repo}]** Review: ${verb} **#${pr.number} ${pr.title}**`;
}

function formatWorkflowRun(payload) {
  const { action, workflow_run: run, repository } = payload;
  const repo = repository?.full_name;
  if (action !== "completed") return null;
  const icon = run.conclusion === "success" ? "✅" : "❌";
  return `${icon} **[${repo}]** \`${run.name}\` ${run.conclusion} on \`${run.head_branch}\``;
}

const handlers = {
  push: formatPush,
  pull_request: formatPullRequest,
  issues: formatIssue,
  issue_comment: formatIssueComment,
  create: formatCreate,
  delete: formatDelete,
  release: formatRelease,
  star: formatStar,
  fork: formatFork,
  pull_request_review: formatPullRequestReview,
  workflow_run: formatWorkflowRun,
};

function setupGitHubWebhook(app) {
  app.post("/github", async (req, res) => {
    const event = req.headers["x-github-event"];
    const handler = handlers[event];

    if (!handler) {
      return res.status(200).json({ ok: true });
    }

    const message = handler(req.body);

    if (message) {
      console.log(`[GitHub] ${event}`);
      await send(GITHUB_CHANNEL, message, GITHUB_SERVER);
    }

    res.status(200).json({ ok: true });
  });
}

module.exports = { setupGitHubWebhook };