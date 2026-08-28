# itsartc — a live professional world

A desktop-first, browser-based **live professional networking world** with cozy,
top-down 2D pixel graphics inspired by classic Pokémon-era RPGs.

Instead of _search → profile → connection request → message → wait_, this product
is built around live professional serendipity:

> **Enter the world → wander → discover people → walk toward them → join the
> conversation → connect → keep exploring.**

This repository is the **foundation build**. It delivers the first milestone of
the product roadmap — _"Phase 1: We have a world."_ — as a runnable app.

**Live:** https://itsartc-app.vercel.app — auto-deployed from this branch on every push.

---

## What's built so far

A single connected world, **Town Central**, that you can walk around in a
desktop browser:

- **Top-down 2D world engine** (Phaser 3): tile grid, terrain (grass, paths,
  plaza, water, sand), buildings, reusable objects, collision, camera-follow
  with zoom.
- **All three movement methods at once**, exactly as the product requires:
  **click-to-walk**, **arrow keys**, and **WASD**. Keyboard input instantly
  overrides click-to-walk.
- **Districts as real places** — Town Square, Founder Café, AI District, Hiring
  Hall, Investor Lounge, Coworking House, Builder District, Social Garden, After
  Hours, Event Hall — each anchored by an enterable building with a door.
- **Proximity is the social mechanic.** Walk near people and an _"In conversation
  range"_ bar fades in listing who's nearby and their live distance.
- **Proximity voice (desktop).** Click **Enable mic** and you can *talk* to
  people as you approach them — each nearby player's voice fades in as you get
  closer and out as you leave, matching the conversation-range bubble. No "join
  call" button. Audio is peer-to-peer (WebRTC), signalled over the same realtime
  backend; mic is strictly opt-in.
  - **Scope:** the product is desktop-first, and proximity voice is complete and
    supported on **desktop browsers**. iPhone/iOS voice interop is intentionally
    **out of scope** for now (not supported or tested) — mobile is not a launch
    target.
  - **Production note:** reliable voice across *different* networks needs a TURN
    relay. The default is a free public relay for testing; set the
    `NEXT_PUBLIC_TURN_*` env vars to your own TURN credentials (e.g. a free
    Metered key, or self-hosted coturn) before relying on it publicly.
- **Click = information, second click = consequential action.** Clicking an
  avatar opens a professional profile card (name, role, company, location,
  intent, bio, what they're working on / looking for). Connect / Save / View
  Profile / Block / Report each require a deliberate second click — a click on a
  person never sends a request.
- **Intent status signals** (🟢 Open to chat · 💰 Raising · 👥 Hiring · 🔎 Open
  to work · 🤝 Cofounder · 💡 Feedback · 👀 Exploring · 🔴 Busy).
- **Advertising & sponsorship hooks baked into the world data** (billboards,
  banners, screens, sponsor + capacity metadata on buildings) — no billing yet,
  just the inventory model.

- **Live multiplayer presence.** Real people share the world in real time
  (Supabase Realtime). Open the app in two browsers and you'll see each other
  move, walk into conversation range, and click each other's profiles. A **Live
  now** counter shows how many people are in the world. Each visitor is given a
  stable "guest" identity (name, role, intent, avatar colours) until accounts
  arrive — shaped exactly like the eventual account profile, so the networking
  layer won't change when accounts land.

Alongside live players, the world also contains **seeded NPCs** that keep it
feeling populated and demonstrate the proximity + profile model even when you're
the only human online.

### Architectural cornerstone: the world is data, not code

The entire world is **structured data** (`src/world/`), never a static image or
hardcoded engine coordinates. Terrain, districts, buildings, entrances,
interiors, objects, collision, spawn points, ad slots, event/voice zones and
seeded people are all declarative. This is deliberate: it's what will let an
admin world editor mutate the world **without touching source code** — a major
requirement of the product.

```
src/world/schema.ts        # the world data model (types + intent metadata)
src/world/townCentral.ts   # the launch world, authored as data
```

The renderer is a "dumb" interpreter of that data.

---

## Tech stack

| Layer            | Choice                                            |
| ---------------- | ------------------------------------------------- |
| Language         | TypeScript                                        |
| App / UI         | Next.js (App Router) + React + Tailwind CSS       |
| 2D world         | Phaser 3 (loaded only on `/world`, client-only)   |
| 3D migration     | Three.js (parallel `/world3d` route)              |
| World data       | Plain typed data modules (DB-backed in a later phase) |

Placeholder pixel art is **generated in code** (no binary assets yet), so the
world runs today; real sprite sheets and tilesets drop in behind the same data
model later.

```
app/                 # Next.js routes: / (landing), /world (the world)
src/components/       # React overlay: WorldShell, ProfileCard
src/game/            # Phaser: GameCanvas, WorldScene, render helpers, event bus
src/three/           # Three.js renderer, movement, collision integration, GLB seam
src/world/           # The world data model + authored world
```

`/world3d` now has fixed-step movement, camera follow, world bounds, and
renderer-neutral authored collision. `src/three/assets/` contains a cache,
clone, transform, and disposal abstraction for curated GLB models. Each of Town
Central's eight venues now has a distinct model selected from Kenney City Kit
(Commercial) 2.1. One tree and one rock from the older OBJ-based Nature Kit are
converted to GLB alongside a fall tree, flower and sign, and are reused for their
matching authored object types. Commercial parasols anchor conversation tables;
small procedural fallbacks make fountains, lamps, billboards, benches and
planters visible until matching curated models arrive. Placeholder geometry
remains the building fallback and no pack is bulk-imported. The Three.js terrain
layer also gives venues concrete city-block pads and turns authored paths into
wide streets with inset pedestrian sidewalks; this visual treatment does not
change collision or world-pixel networking coordinates.

The local-draft world builder lives at `/admin/worlds`. It exposes 139 verified
Kenney assets, placement and property editing, structural validation, JSON
import/export, and overhead/first-person Three.js previews. Publishing is
intentionally disabled until authenticated, server-validated drafts are added;
see `docs/ADMIN_WORLD_BUILDER.md`.

---

## Running locally

```bash
npm install
npm run dev      # http://localhost:3000  → click "Enter the world"
```

Other scripts:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
```

**Controls:** click anywhere to walk · WASD or arrow keys to move · walk up to
someone to enter conversation range · click a person to open their profile.

> Dev/test note: append `?renderer=canvas` to the `/world` URL to force Phaser's
> Canvas renderer instead of WebGL. Useful in headless/CI environments where
> WebGL context creation is unreliable.

---

## How this maps to the product roadmap

This build corresponds to **Phase 0 (technical skeleton)** plus the core of
**Phase 1A–1E** (world engine, geography, categories, building system) and a
first taste of the **Phase 3B** interaction rules (proximity / click / second
click) using seeded people.

**Now added:**

- Real-time multiplayer presence & position sync (via Supabase Realtime
  Broadcast — a join/heartbeat/move/leave protocol drives the live roster).
- **WebRTC proximity voice** — opt-in mic, peer-to-peer audio signalled over a
  dedicated Supabase Broadcast channel, volume driven by in-world distance.

Intentionally **not** in this foundation (each is its own phase and deserves its
own focused work):
- Accounts, onboarding, avatar creator, profiles, privacy & moderation (Phase 2)
- The **admin world editor** at `/admin/world` (Phase 1H) — the data model is
  built to receive it
- Interior maps for enterable buildings (Phase 1F) — entering currently shows a
  toast; metadata + entrances already exist
- World publishing/versioning, analytics, discovery intelligence, instancing &
  scale, monetization (Phases 1K, 4–7)

---

## Known notes

- A build-time `postcss` advisory remains because it's bundled inside Next.js 14;
  clearing it fully requires the Next 16 major upgrade. It does not affect
  runtime. Worth doing as a follow-up.
