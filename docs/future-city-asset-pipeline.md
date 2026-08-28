# Future City asset pipeline

The downloaded `future_city_1.glb` is source material, not a deployable world.
The original remains outside `public/`; only curated, individually loadable
assets belong in the application.

## Rebuild the curated assets

From the repository root:

```sh
node scripts/extract-future-city-assets.mjs /absolute/path/to/future_city_1.glb
```

The converter verifies the expected texture-free glTF structure and writes
centred, grounded GLBs plus `manifest.json` beneath
`public/assets/sketchfab/future-city-1/`. Each output contains only the nodes,
geometry, materials and binary data that it uses.

## Runtime rules

- World-pixel coordinates and authored footprints remain the source of truth.
- The visual model is fitted inside its authored footprint at runtime.
- Building footprints provide simple collision; no physics engine is involved.
- The admin creates a south-centred entrance when a building is made enterable.
- Assets load on demand through `AssetRegistry`; the complete source city is
  never loaded by `/world3d`.
- Repeated vegetation continues to use the lighter Kenney library.

## Quality gate

Building 11 and the source bench are intentionally deferred. Building 11 is
465,885 triangles and needs decimation plus LODs. The source bench is 26,376
triangles and has unsuitable proportions. Neither should enter the editor until
replacement outputs pass browser performance and player-scale checks.
