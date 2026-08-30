# itsartc

A live professional world, rendered in 3D.

## Status

The world is **Future City**, an imported GLB served at `/`. A player walks it
in third person. `/downtown` redirects to the same world.

## Controls

| | |
|---|---|
| Arrow keys / WASD | walk, relative to the camera |
| Drag | look around |

## What's here

```
app/                              layout, global styles, the world route
src/three/CityRenderer.ts         GLB loading, scene, lighting, main loop
src/three/CityCollision.ts        accelerated mesh collision and ground queries
src/three/PlayerController.ts     stable character movement and stepping
src/three/ThirdPersonCamera.ts    collision-aware chase camera
src/three/build/PlayerAvatar.ts   original procedural avatar and animation
public/assets/future-city-1/      the active world GLB
```

## World asset

`future_city_1.glb` is **Future_city_1** by
[HiQ3D](https://sketchfab.com/HiQ3D), downloaded from
[Sketchfab](https://sketchfab.com/3d-models/future-city-1-1363540d0f934472ac556a6f8cb0bdf1)
and used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The source model is normalised at runtime to a roughly 310 × 300 m site. Mesh
BVHs keep collision queries practical across its 1.28 million triangles.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
npm run typecheck
```

## Deploy

Vercel, git-connected. Pushes to the working branch deploy automatically.
