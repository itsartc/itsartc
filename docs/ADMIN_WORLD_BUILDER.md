# Admin world builder

## Current safe foundation

`/admin/worlds` is a local-draft editor. It can place verified building and
object assets, edit positions and footprints, rotate and delete placements,
validate the map, and refresh an embedded Three.js preview.

Drafts are stored in the current browser and can be exported/imported as JSON.
They cannot alter the live world. Server publishing stays disabled until admin
authentication, row-level authorization and server-side validation exist.

## Verified asset coverage

The editor catalog contains 139 browser-ready GLBs:

- 41/41 City Kit Commercial assets
  - 14 commercial buildings
  - 5 skyscrapers
  - 16 low-detail/background buildings
  - 2 placeable parasols
  - 4 façade attachments catalogued but disabled pending attachment anchors
- 98 curated Nature Kit assets
  - 42 trees
  - 19 flowers, grasses and bushes
  - 12 rocks
  - 13 logs, pots, signs, statues and stumps
  - 8 fences
  - 4 bridges

The Nature Kit contains 329 source OBJ files. Terrain-construction fragments,
crop-growth stages, cliffs and river tiles are intentionally excluded from the
placeable library until their corresponding terrain/assembly tools exist. This
prevents an asset from appearing selectable before the editor can place and
validate it correctly.

## Validation contract

Before preview or future publishing, the editor checks:

- unique entity IDs;
- map bounds and asset footprints;
- building overlap;
- valid asset/placement combinations;
- valid spawn position;
- required entrances for enterable venues; and
- reachability of every entrance from spawn.

Asset IDs, rotation and collision footprints live in the world document, so a
saved admin placement renders and collides consistently. World-pixel networking
coordinates remain unchanged.

## Next production steps

1. Admin authentication and role authorization.
2. Versioned server drafts with optimistic concurrency.
3. Server-side validation and draft/publish separation.
4. Terrain/road painting and attachment anchors.
5. Undo/redo, multi-select, drag placement and duplicate tools.
6. First-person pointer look, view-relative movement and close third-person toggle.
7. Asset thumbnails, favorites and per-asset placement presets.
