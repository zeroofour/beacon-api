const BASE = "https://distalk.app";
const COOKIE = process.env.SESSION_COOKIE || "";
const DEVICE = process.env.DEVICE_ID || "";

const HEADERS = {
  "Content-Type": "application/json",
  Cookie: COOKIE,
  "User-Agent": "Mozilla/5.0",
  Referer: "https://distalk.app/",
};

const PLATFORM_BADGES = {
  team: { name: "Team", icon: "⚙️" },
  founder: { name: "Founder", icon: "👑" },
  verified: { name: "Verified", icon: "✅" },
  supporter: { name: "Supporter", icon: "❤️" },
  early_supporter: { name: "Early Supporter", icon: "🌟" },
  partner: { name: "Partner", icon: "🤝" },
  moderator: { name: "Moderator", icon: "🔨" },
  staff: { name: "Staff", icon: "🛡️" },
  bot: { name: "Bot", icon: "🤖" },
  contributor: { name: "Contributor", icon: "📦" },
  bug_hunter: { name: "Bug Hunter", icon: "🐛" },
  translator: { name: "Translator", icon: "🌐" },
  premium: { name: "Premium", icon: "💎" },
  booster: { name: "Booster", icon: "🔮" },
  og: { name: "OG", icon: "🏆" },
};

const SELF_BADGES = {
  active_developer: { name: "Active Developer", lucide: "code-2" },
  developer: { name: "Developer", lucide: "code-2" },
  designer: { name: "Designer", lucide: "palette" },
  streamer: { name: "Streamer", lucide: "radio" },
  gamer: { name: "Gamer", lucide: "gamepad-2" },
  night_owl: { name: "Night Owl", lucide: "moon" },
  coffee_addict: { name: "Coffee Addict", lucide: "coffee" },
  musician: { name: "Musician", lucide: "music" },
  artist: { name: "Artist", lucide: "brush" },
  photographer: { name: "Photographer", lucide: "camera" },
  content_creator: { name: "Content Creator", lucide: "video" },
  foodie: { name: "Foodie", lucide: "utensils" },
  movie_buff: { name: "Movie Buff", lucide: "clapperboard" },
  bookworm: { name: "Bookworm", lucide: "book-open" },
  fitness: { name: "Fitness", lucide: "dumbbell" },
  traveler: { name: "Traveler", lucide: "plane" },
  scientist: { name: "Scientist", lucide: "flask-conical" },
  tester: { name: "Tester", lucide: "test-tube-2" },
  writer: { name: "Writer", lucide: "pen-tool" },
  student: { name: "Student", lucide: "graduation-cap" },
  teacher: { name: "Teacher", lucide: "presentation" },
  pet_lover: { name: "Pet Lover", lucide: "paw-print" },
  nature_lover: { name: "Nature Lover", lucide: "leaf" },
  early_bird: { name: "Early Bird", lucide: "sunrise" },
  anime_fan: { name: "Anime Fan", lucide: "tv" },
  collector: { name: "Collector", lucide: "archive" },
  hacker: { name: "Hacker", lucide: "terminal" },
  explorer: { name: "Explorer", lucide: "compass" },

  lang_en: { name: "Speaks English", emoji: "🇬🇧" },
  lang_de: { name: "Spricht Deutsch", emoji: "🇩🇪" },
  lang_es: { name: "Habla Español", emoji: "🇪🇸" },
  lang_fr: { name: "Parle Français", emoji: "🇫🇷" },
  lang_pt: { name: "Fala Português", emoji: "🇵🇹" },
  lang_ru: { name: "Говорит по-русски", emoji: "🇷🇺" },
  lang_ja: { name: "日本語を話す", emoji: "🇯🇵" },
  lang_ko: { name: "한국어를 해요", emoji: "🇰🇷" },
  lang_zh: { name: "说中文", emoji: "🇨🇳" },
  lang_ar: { name: "يتكلم العربية", emoji: "🇸🇦" },
  lang_hi: { name: "हिन्दी बोलता है", emoji: "🇮🇳" },
  lang_it: { name: "Parla Italiano", emoji: "🇮🇹" },
  lang_nl: { name: "Spreekt Nederlands", emoji: "🇳🇱" },
  lang_pl: { name: "Mówi po polsku", emoji: "🇵🇱" },
  lang_tr: { name: "Türkçe konuşuyor", emoji: "🇹🇷" },
  lang_sv: { name: "Talar Svenska", emoji: "🇸🇪" },
  lang_no: { name: "Snakker Norsk", emoji: "🇳🇴" },
  lang_da: { name: "Taler Dansk", emoji: "🇩🇰" },
  lang_fi: { name: "Puhuu Suomea", emoji: "🇫🇮" },
  lang_uk: { name: "Говорить Українською", emoji: "🇺🇦" },
  lang_ro: { name: "Vorbește Română", emoji: "🇷🇴" },
  lang_vi: { name: "Nói Tiếng Việt", emoji: "🇻🇳" },
  lang_th: { name: "พูดไทย", emoji: "🇹🇭" },
  lang_id: { name: "Berbicara Indonesia", emoji: "🇮🇩" },
  lang_cs: { name: "Mluví Česky", emoji: "🇨🇿" },
  lang_el: { name: "Μιλάει Ελληνικά", emoji: "🇬🇷" },
  lang_hu: { name: "Beszél Magyarul", emoji: "🇭🇺" },
};

let dynamicBadgeMap = {};

function setBadgeDefinitions(badges) {
  dynamicBadgeMap = {};
  badges.forEach((b) => {
    dynamicBadgeMap[b.id] = b;
  });
}

function toDisplayName(id) {
  return id
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseBadge(id) {
  const key = String(id).toLowerCase().replace(/\s+/g, "_");
  const mapped = PLATFORM_BADGES[key];
  const dynamic = dynamicBadgeMap[key];

  return {
    id: key,
    name: mapped?.name || dynamic?.name || toDisplayName(key),
    icon: mapped?.icon || dynamic?.icon || "🏅",
    type: "platform",
  };
}

function parseSelfBadge(id) {
  const key = String(id).toLowerCase().replace(/\s+/g, "_");
  const mapped = SELF_BADGES[key];
  const dynamic = dynamicBadgeMap[key];

  if (mapped?.emoji) {
    return {
      id: key,
      name: mapped.name,
      icon: mapped.emoji,
      lucide: null,
      type: "self",
    };
  }

  if (mapped?.lucide) {
    return {
      id: key,
      name: mapped.name,
      icon: null,
      lucide: mapped.lucide,
      type: "self",
    };
  }

  return {
    id: key,
    name: dynamic?.name || toDisplayName(key),
    icon: dynamic?.icon || null,
    lucide: dynamic?.lucide_icon || null,
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