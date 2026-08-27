import type { IntentKey } from "@/world/schema";

/**
 * A live player's identity + wire state. This is what every peer broadcasts
 * about itself. Positions are in PIXELS (world space), matching the Phaser
 * scene, so remote sprites can be placed without re-deriving tile math.
 *
 * Until real accounts exist (a later phase), each browser tab/window is
 * assigned a random but stable "guest" identity, persisted in sessionStorage.
 *
 * sessionStorage is intentionally used instead of localStorage:
 * - Window/Tab A gets its own guest identity
 * - Window/Tab B gets a different guest identity
 * - Reloading the same tab keeps that tab's identity
 *
 * This gives us a clean one-tab = one-live-player model for multiplayer testing.
 */
export interface PlayerIdentity {
  id: string;
  name: string;
  role: string;
  company: string;
  location: string;
  intent: IntentKey;
  bio: string;
  workingOn: string;
  lookingFor: string;
  palette: { skin: string; hair: string; top: string; bottom: string };
}

const STORAGE_KEY = "itsartc:identity:v1";

const FIRST = [
  "Alex", "Sam", "Jordan", "Casey", "Riley", "Morgan", "Taylor", "Jamie",
  "Avery", "Quinn", "Rowan", "Sasha", "Noa", "Kai", "Remy", "Devin",
  "Emerson", "Harper", "Lennox", "Marlowe",
];

const LAST = [
  "Rivera", "Chen", "Okoro", "Nguyen", "Patel", "Kovac", "Silva", "Haddad",
  "Berg", "Moreno", "Ivanov", "Suzuki", "Adeyemi", "Costa", "Larsen", "Reyes",
];

const ROLES = [
  "Founder", "Product Designer", "Full-stack Engineer", "Growth Lead",
  "ML Engineer", "Angel Investor", "Recruiter", "Data Scientist",
  "Community Builder", "PM", "Solo hacker", "Creative Director",
];

const COMPANIES = [
  "(stealth)", "Freelance", "Indie", "Northwind", "Loom Labs", "Basecase",
  "Kindred", "Overstory", "Fathom", "Driftwood", "—",
];

const CITIES = [
  "Berlin", "London", "Lisbon", "NYC", "SF", "Toronto", "Amsterdam",
  "Austin", "Singapore", "Remote",
];

const INTENTS: IntentKey[] = [
  "open_to_chat", "raising", "hiring", "open_to_work",
  "cofounder", "feedback", "exploring",
];

const WORKING = [
  "a realtime collaboration tool", "a design system", "an AI research agent",
  "a marketplace for makers", "a dev-tools startup", "weekend side projects",
  "a fintech app", "an open-source library", "a creative studio",
];

const LOOKING = [
  "interesting people to chat with", "a technical cofounder", "early users",
  "my next role", "feedback on an idea", "angel investors",
  "collaborators", "just exploring the world",
];

const SKIN = [
  "#f2c6a0", "#e8b48c", "#c68642", "#8d5524", "#ffdbac", "#a1665e",
];

const HAIR = [
  "#2a2a2a", "#4a2f1b", "#6b4423", "#111",
  "#c9a227", "#7a3b2e", "#3b3b6b",
];

const SHIRT = [
  "#c33c3c", "#2f6fb0", "#3fa66a", "#d9a441",
  "#8a4fc0", "#e06c9f", "#2f3b4a",
];

const PANTS = [
  "#2f3b4a", "#3a3a3a", "#4a3b2a", "#264653", "#5a5a5a",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomId(): string {
  // Prefer a real UUID; fall back for older browsers.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `guest-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
}

function generate(): PlayerIdentity {
  const name = `${pick(FIRST)} ${pick(LAST)}`;

  return {
    id: randomId(),
    name,
    role: pick(ROLES),
    company: pick(COMPANIES),
    location: pick(CITIES),
    intent: pick(INTENTS),
    bio: "A live guest exploring the world.",
    workingOn: pick(WORKING),
    lookingFor: pick(LOOKING),
    palette: {
      skin: pick(SKIN),
      hair: pick(HAIR),
      top: pick(SHIRT),
      bottom: pick(PANTS),
    },
  };
}

/**
 * Returns this tab/window's stable guest identity.
 *
 * We use sessionStorage rather than localStorage so separate browser tabs/windows
 * on the same device become separate multiplayer players.
 *
 * The identity remains stable for the life of that browser tab/session.
 */
export function getLocalIdentity(): PlayerIdentity {
  if (typeof window === "undefined") {
    return generate();
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);

    if (raw) {
      const parsed = JSON.parse(raw) as PlayerIdentity;

      if (
        parsed &&
        parsed.id &&
        parsed.name &&
        parsed.palette
      ) {
        return parsed;
      }
    }
  } catch {
    /* ignore corrupt / unavailable storage */
  }

  const fresh = generate();

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    /* ignore unavailable storage */
  }

  return fresh;
}
