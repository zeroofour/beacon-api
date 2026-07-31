const BASE = "https://distalk.app";
const COOKIE = process.env.SESSION_COOKIE || "";
const DEVICE = process.env.DEVICE_ID || "";

const HEADERS = {
  "Content-Type": "application/json",
  Cookie: COOKIE,
  "User-Agent": "Mozilla/5.0",
  Referer: "https://distalk.app/",
};

const BADGE_MAP = {
  owner: { name: "Owner", icon: "👑" },
  admin: { name: "Admin", icon: "🛡️" },
  moderator: { name: "Moderator", icon: "🔨" },
  staff: { name: "Staff", icon: "⚙️" },
  supporter: { name: "Supporter", icon: "❤️" },
  early_supporter: { name: "Early Supporter", icon: "🌟" },
  og: { name: "OG", icon: "🏆" },
  active_developer: { name: "Active Developer", icon: "💻" },
  developer: { name: "Developer", icon: "🔧" },
  designer: { name: "Designer", icon: "🎨" },
  bug_hunter: { name: "Bug Hunter", icon: "🐛" },
  translator: { name: "Translator", icon: "🌐" },
  verified: { name: "Verified", icon: "✅" },
  partner: { name: "Partner", icon: "🤝" },
  contributor: { name: "Contributor", icon: "📦" },
  bot: { name: "Bot", icon: "🤖" },
  premium: { name: "Premium", icon: "💎" },
  nitro: { name: "Nitro", icon: "🚀" },
  booster: { name: "Booster", icon: "🔮" },
  streamer: { name: "Streamer", icon: "📺" },
  artist: { name: "Artist", icon: "🖌️" },
  musician: { name: "Musician", icon: "🎵" },
  content_creator: { name: "Content Creator", icon: "🎬" },
  tester: { name: "Tester", icon: "🧪" },
  hypesquad: { name: "HypeSquad", icon: "🏠" },
};

let dynamicBadgeMap = {};

function setBadgeDefinitions(badges) {
  dynamicBadgeMap = {};
  badges.forEach((b) => {
    dynamicBadgeMap[b.id] = b;
  });
}

function parseBadge(badge) {
  if (typeof badge === "object" && badge !== null) {
    const id = (badge.id || badge.name || "unknown").toLowerCase().replace(/\s+/g, "_");
    const mapped = dynamicBadgeMap[id] || BADGE_MAP[id];
    return {
      id,
      name: badge.label || badge.name || badge.title || mapped?.name || id,
      icon: badge.emoji || badge.icon || mapped?.icon || "🏅",
      lucide_icon: mapped?.lucide_icon || null,
      color: badge.color || mapped?.color || null,
      type: "badge",
    };
  }

  const key = String(badge).toLowerCase().replace(/\s+/g, "_");
  const mapped = dynamicBadgeMap[key] || BADGE_MAP[key];

  if (mapped) {
    return {
      id: key,
      name: mapped.name,
      icon: mapped.icon || "🏅",
      lucide_icon: mapped.lucide_icon || null,
      color: mapped.color || null,
      type: "badge",
    };
  }

  return {
    id: key,
    name: String(badge),
    icon: "🏅",
    lucide_icon: null,
    color: null,
    type: "badge",
  };
}

function parseSelfBadge(badge) {
  if (typeof badge === "object" && badge !== null) {
    return {
      id: (badge.id || badge.name || "unknown").toLowerCase().replace(/\s+/g, "_"),
      name: badge.label || badge.name || badge.title || badge.text || "Unknown",
      icon: badge.emoji || badge.icon || null,
      color: badge.color || null,
      type: "self",
    };
  }

  const str = String(badge);
  const emojiMatch = str.match(
    /^([\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{200D}\u{20E3}\u{FE0F}]|[\u{1F1E0}-\u{1F1FF}]{2}|.)\s*(.*)/u
  );

  if (emojiMatch && emojiMatch[2]) {
    return {
      id: emojiMatch[2].toLowerCase().replace(/\s+/g, "_"),
      name: emojiMatch[2],
      icon: emojiMatch[1],
      color: null,
      type: "self",
    };
  }

  return {
    id: str.toLowerCase().replace(/\s+/g, "_"),
    name: str,
    icon: null,
    color: null,
    type: "self",
  };
}

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
    badges: (u.badges || []).map(parseBadge),
    self_badges: (u.self_badges || []).map(parseSelfBadge),
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

async function fetchBadgeDefinitions() {
  try {
    const res = await fetch(`${BASE}/index.php`, {
      headers: {
        Cookie: COOKIE,
        "User-Agent": "Mozilla/5.0",
      },
    });

    const html = await res.text();
    const badges = [];

    const badgeRegex =
      /class="user-badge[^"]*"[^>]*title="([^"]*)"[^>]*>([\s\S]*?)<span>([^<]*)<\/span>/g;
    let match;

    while ((match = badgeRegex.exec(html)) !== null) {
      const title = match[1];
      const inner = match[2];
      const name = match[3].trim();

      let icon = null;
      const emojiMatch = inner.match(/class="self-badge-emoji"[^>]*>([\s\S]*?)<\/span>/);
      if (emojiMatch) {
        icon = emojiMatch[1].trim();
      }

      let lucideIcon = null;
      const lucideMatch = inner.match(/data-lucide="([^"]*)"/);
      if (lucideMatch) {
        lucideIcon = lucideMatch[1];
      }

      let color = null;
      const styleMatch = inner.match(/style="[^"]*color:\s*([^;"]*)/);
      if (styleMatch) {
        color = styleMatch[1].trim();
      }

      const id = name.toLowerCase().replace(/\s+/g, "_");

      badges.push({
        id,
        name,
        title: title || name,
        icon,
        lucide_icon: lucideIcon,
        color,
      });
    }

    return badges;
  } catch (e) {
    console.error("[Fetcher] Badge scrape failed:", e.message);
    return [];
  }
}

module.exports = {
  fetchAllUsers,
  fetchMessages,
  send,
  fetchBadgeDefinitions,
  setBadgeDefinitions,
};