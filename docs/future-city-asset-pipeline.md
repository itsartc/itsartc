# Future City asset pipeline

The downloaded `future_city_1.glb` is source material, not copied directly into
the application. The original remains outside `public/`; a normalized city
environment and curated, individually loadable assets are generated from it.

## Rebuild the curated assets

From the repository root:

```sh
node scripts/extract-future-city-assets.mjs /absolute/path/to/future_city_1.glb
```

The converter verifies the expected texture-free glTF structure and writes
centred or origin-anchored, grounded GLBs plus `manifest.json` beneath
`public/assets/sketchfab/future-city-1/`. Each output contains only the nodes,
geometry, materials and binary data that it uses.

`full-city.glb` contains the roads, terrain, props and fixed buildings. The
seven major editable buildings are deliberately excluded from that layer and
loaded through the ordinary building pipeline at their original positions.

## Runtime rules

- World-pixel coordinates and authored footprints remain the source of truth.
- Editable visual models are fitted inside their authored footprints at runtime.
- The environment is positioned once and never used as networking state.
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
