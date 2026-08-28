import type { WorldMap } from "./schema";

/**
 * "Town Central" — the launch world (v1).
 *
 * A central Town Square with a fountain, main streets radiating outward, and a
 * ring of districts each anchored by an enterable venue. This is authored data:
 * everything here is meant to eventually be produced by the admin world editor.
 *
 * Coordinates are in tiles. Grass is walkable, so the districts stay reachable
 * even where the cosmetic paths don't perfectly connect.
 */
export const townCentral: WorldMap = {
  id: "town-central",
  name: "Town Central",
  version: 1,
  tileSize: 32,
  widthTiles: 64,
  heightTiles: 46,
  baseTerrain: "grass",
  spawn: { x: 32, y: 27 },

  terrain: [
    // Central plaza
    { type: "plaza", x: 25, y: 18, w: 14, h: 11 },
    // Main streets (horizontal + vertical cross through the plaza)
    { type: "path", x: 0, y: 22, w: 64, h: 3 },
    { type: "path", x: 30, y: 0, w: 4, h: 46 },
    // Spurs up/down to district rows
    { type: "path", x: 10, y: 12, w: 3, h: 12 },
    { type: "path", x: 51, y: 12, w: 3, h: 12 },
    { type: "path", x: 10, y: 24, w: 3, h: 12 },
    { type: "path", x: 51, y: 24, w: 3, h: 12 },
    { type: "path", x: 30, y: 0, w: 4, h: 10 },
    // Social Garden lawn (left)
    { type: "grassdark", x: 2, y: 17, w: 10, h: 12 },
    // Pond in the garden
    { type: "water", x: 4, y: 20, w: 5, h: 4 },
    // A little sand rim near After Hours
    { type: "sand", x: 2, y: 37, w: 12, h: 7 },
  ],

  districts: [
    { id: "town-square", name: "Town Square", labelX: 32, labelY: 17, accent: "#f5efe0" },
    { id: "founder-cafe", name: "Founder Café", labelX: 11, labelY: 5, accent: "#e3b341" },
    { id: "ai-district", name: "AI District", labelX: 53, labelY: 5, accent: "#a371f7" },
    { id: "event-hall", name: "Event Hall", labelX: 32, labelY: 2, accent: "#5b9bd5" },
    { id: "hiring-hall", name: "Hiring Hall", labelX: 56, labelY: 18, accent: "#3fb950" },
    { id: "investor-lounge", name: "Investor Lounge", labelX: 53, labelY: 40, accent: "#d9a441" },
    { id: "coworking-house", name: "Coworking House", labelX: 32, labelY: 44, accent: "#e06c9f" },
    { id: "builder-district", name: "Builder District", labelX: 11, labelY: 40, accent: "#ce7b3c" },
    { id: "social-garden", name: "Social Garden", labelX: 7, labelY: 16, accent: "#7cb342" },
    { id: "after-hours", name: "After Hours", labelX: 7, labelY: 36, accent: "#8b5cf6" },
  ],

  buildings: [
    {
      id: "b-founder-cafe",
      name: "Founder Café",
      districtId: "founder-cafe",
      x: 7, y: 6, w: 9, h: 6,
      wallColor: "#8a5a3b", roofColor: "#c78a4e",
      enterable: true, entrance: { x: 11, y: 12 }, interiorId: "int-founder-cafe",
      status: "open", capacity: 60, sponsor: null,
      adSlots: [{ id: "ad-cafe-1", kind: "banner", x: 7, y: 5, w: 9, h: 1, sponsor: null }],
    },
    {
      id: "b-ai-labs",
      name: "AI Labs",
      districtId: "ai-district",
      x: 48, y: 6, w: 10, h: 6,
      wallColor: "#3b4a6b", roofColor: "#5b6ea8",
      enterable: true, entrance: { x: 52, y: 12 }, interiorId: "int-ai-labs",
      status: "open", capacity: 80, sponsor: null,
      adSlots: [{ id: "ad-ai-1", kind: "screen", x: 48, y: 5, w: 4, h: 1, sponsor: null }],
    },
    {
      id: "b-event-hall",
      name: "Event Hall",
      districtId: "event-hall",
      x: 27, y: 2, w: 10, h: 6,
      wallColor: "#4a3b6b", roofColor: "#6b5ba8",
      enterable: true, entrance: { x: 32, y: 8 }, interiorId: "int-event-hall",
      status: "open", capacity: 200, sponsor: null,
    },
    {
      id: "b-hiring-hall",
      name: "Hiring Hall",
      districtId: "hiring-hall",
      x: 52, y: 18, w: 9, h: 6,
      wallColor: "#3b6b4a", roofColor: "#5ba86e",
      enterable: true, entrance: { x: 52, y: 21 }, interiorId: "int-hiring-hall",
      status: "open", capacity: 100, sponsor: null,
    },
    {
      id: "b-investor-lounge",
      name: "Investor Lounge",
      districtId: "investor-lounge",
      x: 48, y: 34, w: 10, h: 6,
      wallColor: "#6b5a2f", roofColor: "#b39445",
      enterable: true, entrance: { x: 52, y: 34 }, interiorId: "int-investor-lounge",
      status: "open", capacity: 40, sponsor: null,
    },
    {
      id: "b-coworking-house",
      name: "Coworking House",
      districtId: "coworking-house",
      x: 27, y: 38, w: 10, h: 6,
      wallColor: "#6b3b4a", roofColor: "#a85b6e",
      enterable: true, entrance: { x: 32, y: 38 }, interiorId: "int-coworking-house",
      status: "open", capacity: 120, sponsor: null,
    },
    {
      id: "b-builder-district",
      name: "Builder Workshop",
      districtId: "builder-district",
      x: 7, y: 34, w: 9, h: 6,
      wallColor: "#6b4a2f", roofColor: "#a8703c",
      enterable: true, entrance: { x: 11, y: 34 }, interiorId: "int-builder-workshop",
      status: "open", capacity: 100, sponsor: null,
    },
    {
      id: "b-after-hours",
      name: "After Hours",
      districtId: "after-hours",
      // One full walkable row separates this venue from Builder Workshop.
      x: 3, y: 41, w: 8, h: 5,
      wallColor: "#2f2b4a", roofColor: "#5b4b8a",
      enterable: true, entrance: { x: 7, y: 41 }, interiorId: "int-after-hours",
      status: "open", capacity: 60, sponsor: null,
    },
  ],

  objects: [
    // Town Square fountain
    { id: "o-fountain", type: "fountain", x: 31, y: 22, solid: true },
    // Plaza lamps + benches
    { id: "o-lamp-1", type: "lamp", x: 26, y: 19, solid: true },
    { id: "o-lamp-2", type: "lamp", x: 37, y: 19, solid: true },
    { id: "o-lamp-3", type: "lamp", x: 26, y: 27, solid: true },
    { id: "o-lamp-4", type: "lamp", x: 37, y: 27, solid: true },
    { id: "o-bench-1", type: "bench", x: 28, y: 26 },
    { id: "o-bench-2", type: "bench", x: 35, y: 26 },
    // Town Square welcome sign + billboard
    { id: "o-sign-square", type: "sign", x: 33, y: 25, label: "Town Square" },
    { id: "o-billboard-1", type: "billboard", x: 44, y: 23, label: "Your ad here", solid: true },
    // Social Garden greenery
    { id: "o-tree-g1", type: "tree", x: 3, y: 17, solid: true },
    { id: "o-tree-g2", type: "tree", x: 10, y: 18, solid: true },
    { id: "o-tree-g3", type: "tree", x: 11, y: 26, solid: true },
    { id: "o-tree-g4", type: "tree", x: 3, y: 27, solid: true },
    { id: "o-bush-g1", type: "bush", x: 6, y: 26 },
    { id: "o-planter-g1", type: "planter", x: 8, y: 17 },
    // Scattered street trees
    { id: "o-tree-s1", type: "tree", x: 18, y: 14, solid: true },
    { id: "o-tree-s2", type: "tree", x: 45, y: 14, solid: true },
    { id: "o-tree-s3", type: "tree", x: 18, y: 32, solid: true },
    { id: "o-tree-s4", type: "tree", x: 45, y: 32, solid: true },
    // District signage
    { id: "o-sign-ai", type: "sign", x: 47, y: 13, label: "AI District" },
    { id: "o-sign-hire", type: "sign", x: 50, y: 21, label: "Hiring Hall" },

    // --- Decorative richness (graphics pass 1) ---
    // Cherry blossoms — a soft focal point by the garden pond & square edges
    { id: "o-blossom-1", type: "blossom", x: 5, y: 28, solid: true },
    { id: "o-blossom-2", type: "blossom", x: 24, y: 30, solid: true },
    { id: "o-blossom-3", type: "blossom", x: 40, y: 16, solid: true },
    // Flower beds
    { id: "o-flowers-1", type: "flowers", x: 7, y: 29 },
    { id: "o-flowers-2", type: "flowers", x: 9, y: 28 },
    { id: "o-flowers-3", type: "flowers", x: 24, y: 17 },
    { id: "o-flowers-4", type: "flowers", x: 39, y: 28 },
    { id: "o-flowers-5", type: "flowers", x: 40, y: 30 },
    // Rocks near the water & sand
    { id: "o-rock-1", type: "rock", x: 3, y: 24, solid: true },
    { id: "o-rock-2", type: "rock", x: 9, y: 24, solid: true },
    { id: "o-rock-3", type: "rock", x: 13, y: 41, solid: true },
    // Café forecourt + plaza conversation tables (anchor the sub-areas)
    { id: "o-table-ai", type: "table", x: 8, y: 13 },
    { id: "o-table-fin", type: "table", x: 17, y: 13 },
    { id: "o-table-sq1", type: "table", x: 28, y: 19 },
    { id: "o-table-sq2", type: "table", x: 35, y: 19 },
    { id: "o-table-sq3", type: "table", x: 28, y: 26 },
    { id: "o-table-sq4", type: "table", x: 35, y: 26 },
    // A few more street lamps for warm dusk glow
    { id: "o-lamp-5", type: "lamp", x: 16, y: 21, solid: true },
    { id: "o-lamp-6", type: "lamp", x: 47, y: 21, solid: true },
    { id: "o-lamp-7", type: "lamp", x: 31, y: 12, solid: true },
  ],

  people: [
    {
      id: "p-maya", name: "Maya Okafor", role: "Seed Investor", company: "Northwind Capital",
      location: "London", intent: "open_to_chat",
      bio: "Ex-founder turned investor. I write first cheques into European AI.",
      workingOn: "New €40M seed fund", lookingFor: "AI founders raising pre-seed / seed",
      x: 34, y: 24, palette: { skin: "#e8b48c", hair: "#3a2a1a", top: "#d9a441", bottom: "#2f3b4a" }, wander: 2,
    },
    {
      id: "p-diego", name: "Diego Santos", role: "Founder & CEO", company: "Ledgerly",
      location: "Lisbon", intent: "raising",
      bio: "Building the finance stack for LatAm SMBs. YC W24.",
      workingOn: "Series A deck", lookingFor: "Fintech investors + a senior BE hire",
      x: 29, y: 25, palette: { skin: "#c98a5b", hair: "#1a1a1a", top: "#5b9bd5", bottom: "#333" }, wander: 3,
    },
    {
      id: "p-anna", name: "Anna Kellerman", role: "ML Engineer", company: "(open)",
      location: "Berlin", intent: "open_to_work",
      bio: "LLM infra + eval. Shipped RAG at scale. Looking for my next thing.",
      workingOn: "Open-source eval harness", lookingFor: "Applied-AI teams hiring",
      x: 50, y: 9, palette: { skin: "#f0c8a0", hair: "#8a5a2f", top: "#a371f7", bottom: "#2f2f2f" }, wander: 2,
    },
    {
      id: "p-tomas", name: "Tomas Novak", role: "Recruiter", company: "TalentForge",
      location: "Prague", intent: "hiring",
      bio: "I place senior eng + product at Series A–C startups.",
      workingOn: "5 open staff-eng roles", lookingFor: "Engineers open to new roles",
      x: 54, y: 20, palette: { skin: "#e8b48c", hair: "#2a2a2a", top: "#3fb950", bottom: "#444" }, wander: 2,
    },
    {
      id: "p-priya", name: "Priya Raman", role: "Solo Founder", company: "Stealth",
      location: "Bangalore", intent: "cofounder",
      bio: "Technical founder. Prototype live. Need a commercial cofounder.",
      workingOn: "Consumer AI app", lookingFor: "A go-to-market cofounder",
      x: 10, y: 8, palette: { skin: "#c98a5b", hair: "#1a1a1a", top: "#e06c9f", bottom: "#2f3b4a" }, wander: 2,
    },
    {
      id: "p-lena", name: "Lena Hoffmann", role: "Product Designer", company: "Frame",
      location: "Amsterdam", intent: "feedback",
      bio: "Design systems + 0→1 product. Happy to trade portfolio feedback.",
      workingOn: "A new onboarding flow", lookingFor: "Honest feedback + design friends",
      x: 6, y: 22, palette: { skin: "#f0c8a0", hair: "#c78a4e", top: "#4a9fd4", bottom: "#333" }, wander: 2,
    },
    {
      id: "p-sam", name: "Sam Whitfield", role: "Indie Hacker", company: "self",
      location: "Austin", intent: "exploring",
      bio: "Shipping small SaaS. Here to meet other builders and see what's new.",
      workingOn: "A tiny analytics tool", lookingFor: "Builders to swap notes with",
      x: 10, y: 33, palette: { skin: "#e8b48c", hair: "#5a3a1a", top: "#ce7b3c", bottom: "#2f2f2f" }, wander: 3,
    },
    {
      id: "p-yuki", name: "Yuki Tanaka", role: "Platform Eng", company: "Corebase",
      location: "Tokyo", intent: "busy",
      bio: "Heads-down on infra right now — ping me later tonight.",
      workingOn: "Multi-region rollout", lookingFor: "Nothing right now, just lurking",
      x: 32, y: 40, palette: { skin: "#f0c8a0", hair: "#1a1a1a", top: "#6b5ba8", bottom: "#333" }, wander: 1,
    },
  ],

  zones: [
    { id: "z-event-stage", type: "event", x: 27, y: 2, w: 10, h: 6, label: "Event Hall stage" },
    { id: "z-cafe-voice", type: "voice", x: 7, y: 6, w: 9, h: 6, label: "Founder Café" },
    { id: "z-cafe-prespresented", type: "ad", x: 7, y: 5, w: 9, h: 1, label: "Café banner (available)" },
  ],

  // Phase 1B/1D — sub-areas: subcategories as physical spots people gather.
  // Founder Café subcategories live as forecourt seating clusters beside the
  // café; the Town Square plaza carries open, cross-cutting conversation
  // clusters (venueId null) like the ones in the product mockup.
  subAreas: [
    { id: "sa-cafe-general", name: "General", districtId: "founder-cafe", venueId: "b-founder-cafe", subcategory: "General", kind: "seating", x: 4, y: 13, w: 3, h: 2, accent: "#e3b341" },
    { id: "sa-cafe-ai", name: "AI Table", districtId: "founder-cafe", venueId: "b-founder-cafe", subcategory: "AI", kind: "seating", x: 7, y: 13, w: 3, h: 2, accent: "#a371f7" },
    { id: "sa-cafe-saas", name: "SaaS Table", districtId: "founder-cafe", venueId: "b-founder-cafe", subcategory: "SaaS", kind: "seating", x: 13, y: 13, w: 3, h: 2, accent: "#5b9bd5" },
    { id: "sa-cafe-fintech", name: "Fintech Table", districtId: "founder-cafe", venueId: "b-founder-cafe", subcategory: "Fintech", kind: "seating", x: 16, y: 13, w: 3, h: 2, accent: "#3fb950" },
    { id: "sa-cafe-raising", name: "Raising Now", districtId: "founder-cafe", venueId: "b-founder-cafe", subcategory: "Raising Now", kind: "booth", x: 4, y: 15, w: 3, h: 2, accent: "#d9a441" },
    { id: "sa-cafe-cofounder", name: "Cofounder Search", districtId: "founder-cafe", venueId: "b-founder-cafe", subcategory: "Cofounder Search", kind: "booth", x: 16, y: 15, w: 3, h: 2, accent: "#e06c9f" },

    { id: "sa-sq-open", name: "Open to Chat", districtId: "town-square", venueId: null, subcategory: "Open to chat", kind: "seating", x: 27, y: 19, w: 3, h: 2, accent: "#3fb950" },
    { id: "sa-sq-ai", name: "AI Circle", districtId: "town-square", venueId: null, subcategory: "AI", kind: "seating", x: 34, y: 19, w: 3, h: 2, accent: "#a371f7" },
    { id: "sa-sq-invest", name: "Investor Corner", districtId: "town-square", venueId: null, subcategory: "Investing", kind: "lounge", x: 27, y: 26, w: 3, h: 2, accent: "#d9a441" },
    { id: "sa-sq-hiring", name: "Hiring Corner", districtId: "town-square", venueId: null, subcategory: "Hiring", kind: "seating", x: 34, y: 26, w: 3, h: 2, accent: "#5b9bd5" },
  ],

  // Phase 1B — rooms modeled inside the café interior (interior maps land in 1F).
  rooms: [
    { id: "rm-cafe-main", name: "Main Floor", interiorId: "int-founder-cafe", subcategory: "General" },
    { id: "rm-cafe-upstairs-ai", name: "Upstairs — AI", interiorId: "int-founder-cafe", subcategory: "AI" },
    { id: "rm-cafe-investor", name: "Investor Corner", interiorId: "int-founder-cafe", subcategory: "Investing" },
  ],
};
