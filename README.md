# itsartc

A live professional world, rendered in 3D.

## Status

Reset to a clean slate. The previous 2D Phaser world, its Three.js port, the
Supabase backend (presence, proximity voice, auth, storage), the world admin
editor and the Town Central / Future City world data have all been removed. The
world is being rebuilt from scratch.

Everything removed is recoverable from git history at commit `aecb8ec`.

## What's here

A deployable Next.js 14 app — App Router, TypeScript, Tailwind — with Three.js
installed and nothing built on top of it yet, plus the licensed 3D city assets.

```
app/                      layout, global styles, placeholder landing page
src/                      (empty — the world goes here)
public/assets/sketchfab/  Future City model: full city + separated buildings
scripts/                  asset extraction pipeline for the above
docs/                     how those assets were produced
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
