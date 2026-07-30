const { send } = require("./fetcher");

const GITHUB_CHANNEL = "chn_2468270a87e1930b";
const GITHUB_SERVER = "srv_9bc5920d83db2f21";

function setupGitHubWebhook(app) {
  app.post("/github", async (req, res) => {
    const event = req.headers["x-github-event"];
    const payload = req.body;

    let message = null;

    switch (event) {
      case "push": {
        const branch = payload.ref?.replace("refs/heads/", "");
        const commits = payload.commits || [];
        const repo = payload.repository?.full_name;

        if (!commits.length) break;

        message = `[${repo}:${branch}] ${commits.length} new commit${commits.length > 1 ? "s" : ""}\n\n`;
        commits.forEach(c => {
          const hash = c.id.substring(0, 7);
          message += `\`${hash}\` ${c.message}\n`;
        });
        break;
      }

      case "pull_request": {
        const pr = payload.pull_request;
        const repo = payload.repository?.full_name;
        const action = payload.action;

        if (action === "opened") {
          message = `[${repo}] Pull request opened: #${pr.number} ${pr.title}\n`;
          message += `${pr.base.ref} ← ${pr.head.ref}`;
        } else if (action === "closed" && pr.merged) {
          message = `[${repo}] Pull request merged: #${pr.number} ${pr.title}\n`;
          message += `${pr.base.ref} ← ${pr.head.ref}`;
        } else if (action === "closed") {
          message = `[${repo}] Pull request closed: #${pr.number} ${pr.title}`;
        }
        break;
      }

      case "issues": {
        const issue = payload.issue;
        const repo = payload.repository?.full_name;
        const action = payload.action;

        if (action === "opened") {
          message = `[${repo}] Issue opened: #${issue.number} ${issue.title}`;
        } else if (action === "closed") {
          message = `[${repo}] Issue closed: #${issue.number} ${issue.title}`;
        } else if (action === "reopened") {
          message = `[${repo}] Issue reopened: #${issue.number} ${issue.title}`;
        }
        break;
      }

      case "issue_comment": {
        const issue = payload.issue;
        const repo = payload.repository?.full_name;
        if (payload.action === "created") {
          message = `[${repo}] New comment on #${issue.number} ${issue.title}`;
        }
        break;
      }

      case "create": {
        const repo = payload.repository?.full_name;
        if (payload.ref_type === "branch") {
          message = `[${repo}] Branch created: ${payload.ref}`;
        } else if (payload.ref_type === "tag") {
          message = `[${repo}] Tag created: ${payload.ref}`;
        }
        break;
      }

      case "delete": {
        const repo = payload.repository?.full_name;
        if (payload.ref_type === "branch") {
          message = `[${repo}] Branch deleted: ${payload.ref}`;
        } else if (payload.ref_type === "tag") {
          message = `[${repo}] Tag deleted: ${payload.ref}`;
        }
        break;
      }

      case "release": {
        const rel = payload.release;
        const repo = payload.repository?.full_name;
        if (payload.action === "published") {
          message = `[${repo}] Release published: ${rel.tag_name}\n`;
          if (rel.name) message += `${rel.name}`;
        }
        break;
      }

      case "star": {
        const repo = payload.repository?.full_name;
        const count = payload.repository?.stargazers_count;
        if (payload.action === "created") {
          message = `[${repo}] New star added (${count} total)`;
        }
        break;
      }

      case "fork": {
        const repo = payload.repository?.full_name;
        message = `[${repo}] Repository forked`;
        break;
      }

      case "pull_request_review": {
        const pr = payload.pull_request;
        const repo = payload.repository?.full_name;
        const review = payload.review;
        if (payload.action === "submitted") {
          const state = review.state === "approved" ? "approved" : review.state === "changes_requested" ? "requested changes on" : "reviewed";
          message = `[${repo}] Pull request ${state}: #${pr.number} ${pr.title}`;
        }
        break;
      }

      case "workflow_run": {
        const run = payload.workflow_run;
        const repo = payload.repository?.full_name;
        if (payload.action === "completed") {
          const icon = run.conclusion === "success" ? "✅" : "❌";
          message = `${icon} [${repo}] Workflow "${run.name}" ${run.conclusion} on ${run.head_branch}`;
        }
        break;
      }

      default:
        console.log(`[GitHub] unhandled event: ${event}`);
        break;
    }

    if (message) {
      console.log(`[GitHub] ${event} → posting to distalk`);
      await send(GITHUB_CHANNEL, message, GITHUB_SERVER);
    }

    res.status(200).json({ ok: true });
  });

  console.log("[GitHub] Webhook endpoint ready at POST /github");
}

module.exports = { setupGitHubWebhook };