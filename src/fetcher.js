const BASE = "https://distalk.app";
const COOKIE = process.env.SESSION_COOKIE || "";
const DEVICE = process.env.DEVICE_ID || "";

const HEADERS = {
  "Content-Type": "application/json",
  Cookie: COOKIE,
  "User-Agent": "Mozilla/5.0",
  Referer: "https://distalk.app/",
};

async function fetchAllUsers() {
  try {
    const res = await fetch(`${BASE}/index.php?api=state`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        msgSince: new Date().toISOString(),
        need: "",
        focus: { kind: "channel", serverId: "", channelId: "" },
      }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    if (!json.ok) return null;

    const users = [];
    if (json.user) users.push(json.user);
    if (json.users?.length) users.push(...json.users);

    const channels = [];
    const serverIds = [];

    json.servers?.forEach((s) => {
      serverIds.push(s.id);
      s.categories?.forEach((cat) => {
        cat.channels?.forEach((ch) => {
          channels.push(typeof ch === "string" ? ch : ch.id);
        });
      });
    });

    return { users: users.map(clean), channels, serverIds };
  } catch (e) {
    console.error("[Fetcher]", e.message);
    return null;
  }
}

function clean(u) {
  return {
    id: u.id,
    username: u.username?.toLowerCase(),
    display_name: u.display_name || u.username,
    platform_role: u.platform_role || "user",
    avatar_url: u.avatar_url ? `${BASE}${u.avatar_url}` : null,
    banner_url: u.banner_url ? `${BASE}${u.banner_url}` : null,
    bio: u.bio || "",
    name_color: u.name_color || "",
    presence: {
      status: u.status || "offline",
      is_mobile: !!u.is_mobile,
      last_seen: u.last_seen || null,
      custom_status: {
        emoji: u.status_emoji || null,
        text: u.status_text || null,
        style: u.status_style || "default",
        color: u.status_color || null,
      },
      activity: u.activity || null,
    },
    spotify: {
      connected: !!u.spotify_connected,
      now_playing: u.spotify_now_playing || null,
    },
    socials: {
      youtube: u.social_youtube || null,
      twitch: u.social_twitch || null,
      spotify: u.social_spotify || null,
      tiktok: u.social_tiktok || null,
    },
    badges: u.badges || [],
    self_badges: u.self_badges || [],
    tag: u.tag || null,
  };
}

async function fetchMessages(since) {
  try {
    const res = await fetch(`${BASE}/index.php?api=state`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        msgSince: since,
        need: "messages",
        focus: { kind: "channel", serverId: "", channelId: "" },
      }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    return json.messages || [];
  } catch {
    return null;
  }
}

async function send(channelId, body, serverId) {
  try {
    const res = await fetch(`${BASE}/index.php?api=send_message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: COOKIE,
        Origin: "https://distalk.app",
        Referer: "https://distalk.app/service-worker.js",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
        "x-device-id": DEVICE,
      },
      body: JSON.stringify({ serverId, channelId, body }),
    });

    const text = await res.text();
    console.log(`[Bot] ${res.status}:`, text.substring(0, 100));
  } catch (e) {
    console.error("[Bot] Send error:", e.message);
  }
}

module.exports = { fetchAllUsers, fetchMessages, send };