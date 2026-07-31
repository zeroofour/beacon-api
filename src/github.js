const { send } = require("./fetcher");

const GITHUB_CHANNEL = "chn_2468270a87e1930b";
const GITHUB_SERVER = "srv_9bc5920d83db2f21";

function formatPush(payload) {
  const branch = payload.ref?.replace("refs/heads/", "");
  const repo = payload.repository?.full_name;
  const commits = payload.commits || [];
  if (!commits.length) return null;

  let msg = `## ${repo}\n`;
  msg += `**${commits.length}** commit${commits.length > 1 ? "s" : ""} pushed to \`${branch}\`\n`;
  msg += `-------\n`;
  commits.forEach((c) => {
    msg += `\`${c.id.slice(0, 7)}\` ${c.message}\n`;
  });
  return msg;
}

function formatPullRequest(payload) {
  const { action, pull_request: pr, repository } = payload;
  const repo = repository?.full_name;

  if (action === "opened") {
    let msg = `## ${repo}\n`;
    msg += `Pull request **opened**\n`;
    msg += `-------\n`;
    msg += `**#${pr.number}** ${pr.title}\n`;
    msg += `\`${pr.base.ref}\` <-> \`${pr.head.ref}\``;
    return msg;
  }
  if (action === "closed" && pr.merged) {
    let msg = `## ${repo}\n`;
    msg += `Pull request **merged**\n`;
    msg += `-------\n`;
    msg += `**#${pr.number}** ${pr.title}\n`;
    msg += `\`${pr.base.ref}\` <-> \`${pr.head.ref}\``;
    return msg;
  }
  if (action === "closed") {
    let msg = `## ${repo}\n`;
    msg += `Pull request **closed**\n`;
    msg += `-------\n`;
    msg += `**#${pr.number}** ${pr.title}`;
    return msg;
  }
  return null;
}

function formatIssue(payload) {
  const { action, issue, repository } = payload;
  const repo = repository?.full_name;

  if (["opened", "closed", "reopened"].includes(action)) {
    let msg = `## ${repo}\n`;
    msg += `Issue **${action}**\n`;
    msg += `-------\n`;
    msg += `**#${issue.number}** ${issue.title}`;
    return msg;
  }
  return null;
}

function formatIssueComment(payload) {
  const { action, issue, comment, repository } = payload;
  const repo = repository?.full_name;
  if (action !== "created") return null;

  let msg = `## ${repo}\n`;
  msg += `New comment on **#${issue.number}**\n`;
  msg += `-------\n`;
  msg += `**${issue.title}**\n`;
  if (comment.body) {
    const preview = comment.body.length > 100 ? comment.body.slice(0, 100) + "..." : comment.body;
    msg += `> ${preview}`;
  }
  return msg;
}

function formatCreate(payload) {
  const repo = payload.repository?.full_name;
  if (!["branch", "tag"].includes(payload.ref_type)) return null;

  let msg = `## ${repo}\n`;
  msg += `${payload.ref_type === "branch" ? "Branch" : "Tag"} **created**\n`;
  msg += `-------\n`;
  msg += `\`${payload.ref}\``;
  return msg;
}

function formatDelete(payload) {
  const repo = payload.repository?.full_name;
  if (!["branch", "tag"].includes(payload.ref_type)) return null;

  let msg = `## ${repo}\n`;
  msg += `${payload.ref_type === "branch" ? "Branch" : "Tag"} **deleted**\n`;
  msg += `-------\n`;
  msg += `~~${payload.ref}~~`;
  return msg;
}

function formatRelease(payload) {
  const repo = payload.repository?.full_name;
  const rel = payload.release;
  if (payload.action !== "published") return null;

  let msg = `## ${repo}\n`;
  msg += `Release **published**\n`;
  msg += `-------\n`;
  msg += `**${rel.tag_name}**`;
  if (rel.name && rel.name !== rel.tag_name) msg += ` — ${rel.name}`;
  if (rel.body) {
    const preview = rel.body.length > 200 ? rel.body.slice(0, 200) + "..." : rel.body;
    msg += `\n\n${preview}`;
  }
  return msg;
}

function formatStar(payload) {
  const repo = payload.repository?.full_name;
  const count = payload.repository?.stargazers_count;
  if (payload.action !== "created") return null;

  return `**${repo}** — new star (**${count}** total)`;
}

function formatFork(payload) {
  const repo = payload.repository?.full_name;
  const fork = payload.forkee?.full_name;
  let msg = `## ${repo}\n`;
  msg += `Repository **forked**`;
  if (fork) msg += `\n-------\n-> ${fork} <-`;
  return msg;
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

  let msg = `## ${repo}\n`;
  msg += `Pull request **${verb}**\n`;
  msg += `-------\n`;
  msg += `**#${pr.number}** ${pr.title}`;
  return msg;
}

function formatWorkflowRun(payload) {
  const { action, workflow_run: run, repository } = payload;
  const repo = repository?.full_name;
  if (action !== "completed") return null;

  const passed = run.conclusion === "success";

  let msg = `## ${repo}\n`;
  msg += `Workflow **${run.name}**\n`;
  msg += `-------\n`;
  msg += `- [${passed ? "x" : " "}] ${run.conclusion} on \`${run.head_branch}\``;
  return msg;
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