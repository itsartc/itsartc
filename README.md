# itsartc

A live professional world, rendered in 3D.

## Status

The world is **Downtown**, a generated city served at `/`. A player walks it in
third person.

## Controls

| | |
|---|---|
| Arrow keys / WASD | walk, relative to the camera |
| Shift | run |
| Drag | look around |

## What's here

```
app/                              layout, global styles, the world route
src/world/schema.ts               the city as data
src/world/downtown.ts             deterministic city generator
src/three/DowntownRenderer.ts     scene, lighting, main loop
src/three/DowntownCanvas.tsx      client-only mount
src/three/SkyEnvironment.ts       procedural daylight sky
src/three/build/                  geometry: city, road markings, avatar
src/three/materials/              tiling material library, procedural textures
src/three/collision/              AABB collision from city data
public/assets/city/textures/      2.3 MB tiling material library
```

## The world is generated, not imported

Downtown is built on the client from a few hundred bytes of layout data. There
is no model to download — the only asset is the texture library — so the app
starts immediately, and every building is an editable record rather than baked
triangles. That is what makes sponsors, entrances, interiors and an admin editor
possible at all.

Roughly 366 × 318 m: 12 district buildings around a central Networking Park,
drawn in about 29 draw calls and 29k triangles.

Scale is metric throughout — a 1.8 m avatar, 6.4 m/s walk, 12 m/s run — so
camera distance and pace need no magic numbers.

An earlier version loaded an imported 14 MB GLB city at `/`. That world, its
BVH collision and the `three-mesh-bvh` dependency were removed once Downtown
superseded it; the model remains in git history at `10e654e` if it is ever
needed. `/downtown`, the parallel route it was developed at, now redirects to
`/`.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
npm run typecheck
```

## Deploy

Vercel, git-connected. Pushes to the working branch deploy automatically.
