const { send } = require("./fetcher");

const GITHUB_CHANNEL = "chn_2468270a87e1930b";
const GITHUB_SERVER = "srv_9bc5920d83db2f21";
const GITHUB_SECRET = process.env.GITHUB_SECRET || "your_webhook_secret";

function setupGitHubWebhook(app) {
  app.post("/github", async (req, res) => {
    const event = req.headers["x-github-event"];
    const payload = req.body;

    let message = null;

    switch (event) {
      case "push":
        const branch = payload.ref?.replace("refs/heads/", "");
        const commits = payload.commits || [];
        const pusher = payload.pusher?.name || "unknown";

        if (!commits.length) break;

        message = `\`${pusher} pushed ${commits.length} commit(s) to ${branch}\`\n\n`;
        commits.forEach(c => {
          const short = c.id.substring(0, 7);
          message += `\`${short}\` ${c.message}\n`;
        });
        break;

      case "pull_request":
        const pr = payload.pull_request;
        const action = payload.action;
        message = `\`pull request ${action}\`\n`;
        message += `\`#${pr.number} ${pr.title}\`\n`;
        message += `\`by ${pr.user.login} → ${pr.base.ref}\``;
        break;

      case "issues":
        const issue = payload.issue;
        message = `\`issue ${payload.action}\`\n`;
        message += `\`#${issue.number} ${issue.title}\`\n`;
        message += `\`by ${issue.user.login}\``;
        break;

      case "create":
        message = `\`${payload.sender.login} created ${payload.ref_type}: ${payload.ref}\``;
        break;

      case "delete":
        message = `\`${payload.sender.login} deleted ${payload.ref_type}: ${payload.ref}\``;
        break;

      case "star":
        if (payload.action === "created") {
          message = `\`${payload.sender.login} starred ${payload.repository.full_name}\``;
        }
        break;

      case "fork":
        message = `\`${payload.sender.login} forked ${payload.repository.full_name}\``;
        break;

      case "release":
        const rel = payload.release;
        message = `\`new release: ${rel.tag_name}\`\n`;
        message += `\`${rel.name || "no title"}\`\n`;
        message += `\`by ${rel.author.login}\``;
        break;

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