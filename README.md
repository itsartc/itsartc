# itsartc

A live professional world, rendered in 3D.

## Status

The world is `procedural-city-6`, rendered in Three.js at `/`. A player walks
it in third person.

## Controls

| | |
|---|---|
| Arrow keys / WASD | walk, relative to the camera |
| Shift | run |
| Drag | look around |

## What's here

```
app/                              layout, global styles, the world route
src/three/CityRenderer.ts         scene, lighting, model loading, main loop
src/three/CityCanvas.tsx          client-only mount + load progress
src/three/CityCollision.ts        BVH ground/wall queries and spawn finding
src/three/PlayerController.ts     movement, gravity, wall sliding
src/three/ThirdPersonCamera.ts    chase camera
src/three/Input.ts                keyboard
src/three/build/PlayerAvatar.ts   placeholder avatar
public/assets/procedural-city-6/  city.glb — the compressed world
```

## Units and scale

The model is metric: ~248 x 196 m across, towers to ~112 m. Speeds and sizes
throughout are real figures — a 1.8 m avatar, 4.2 m/s walk, 8.5 m/s run — which
is what makes the camera distance and pace feel right without tuning.

The spawn point is **found, not hardcoded**: the city is sampled on a grid for
open ground at street level with headroom above, biased toward the middle of the
site. A fixed coordinate would land inside a building the first time the model is
re-exported.

## The world model

`city.glb` is a meshopt-compressed build of `Terrain Remaked.glb`:

| | Source | Shipped |
|---|---|---|
| Size | 69.7 MB | **10.5 MB** |
| Textures | JPEG/PNG up to 2048² | WebP, capped at 1024² |
| Geometry | uncompressed | meshopt |

The model is 248 × 196 units across and 112 units tall, which reads as metres:
a roughly two-block downtown site with towers up to ~30 storeys. Geometry is
unchanged — no decimation — so the silhouette matches the source exactly.

The 66 MB source GLB and its 110 MB `textures/` folder are **not** in the
working tree. The GLB embeds its own textures, so that folder was a duplicate
export for the OBJ/FBX variant. Both remain in git history at commit `9c10582`.

To re-compress from source after checking that commit out:

```bash
npx @gltf-transform/cli optimize \
  "public/assets/procedural-city-6/source/Terrain Remaked.glb" \
  public/assets/procedural-city-6/city.glb \
  --compress meshopt --texture-compress webp --texture-size 1024 --simplify false
```

## 3D assets

`public/assets/sketchfab/future-city-1/` holds a Future City model — the full
environment plus separated buildings, a street light and a bridge. It is
third-party work under **CC BY 4.0** and its `ATTRIBUTION.md` must stay with it
and be honoured anywhere the model is shipped. See
`docs/future-city-asset-pipeline.md` for how the files were derived from the
source download.

The code that loaded these was removed with everything else; the files were kept
because the model is licensed third-party work, not something regenerable.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
npm run typecheck
```

## Deploy

Vercel, git-connected. Pushes to the working branch deploy automatically.
