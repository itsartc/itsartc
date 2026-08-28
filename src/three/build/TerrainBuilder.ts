import * as THREE from "three";
import type { WorldMap, TerrainType } from "@/world/schema";
import { tileCornerToThree } from "../coords";

/**
 * Builds the ground: one base plane for the whole world, plus a thin quad for
 * each authored terrain region (plaza, streets, garden lawn, pond, sand).
 *
 * The city treatment stays renderer-only: authored `path` regions become
 * pedestrian-friendly streets with inset sidewalks, and each building gets a
 * concrete block pad. None of this changes collision or network coordinates.
 *
 * Materials are shared per terrain type rather than created per mesh, so the
 * draw-call and material count stay flat as the world grows.
 */

/** Three.js palette: deliberately closer to Kenney's commercial city kit. */
const TERRAIN_COLORS: Record<TerrainType, number> = {
  grass: 0x66ab4d,
  grassdark: 0x4f8e3f,
  path: 0x5c6370,
  plaza: 0xcbd0d7,
  water: 0x3f97cf,
  sand: 0xe0cd93,
  wood: 0xb5854f,
  carpet: 0xa15c58,
  tile: 0xdfe4e8,
  concrete: 0x9aa0a6,
};

/** Draw order offsets (in scene units) so coplanar quads don't z-fight. */
const SURROUND_Y = -0.01;
const BASE_Y = 0;
const BLOCK_Y = 0.005;
const REGION_Y = 0.01;
const STREET_DETAIL_Y = 0.025;

const BLOCK_COLOR = 0xb9c0c8;
const SIDEWALK_COLOR = 0xd6dae0;
const CURB_COLOR = 0xe7e9ec;
const BLOCK_MARGIN = 1;
const SIDEWALK_WIDTH = 0.58;
const CURB_WIDTH = 0.08;

/**
 * How far the ground continues past the authored map, in tiles.
 *
 * Without it, a player at the world edge sees the map floating in empty sky.
 * The alternative — clamping the camera so the edge never enters frame — pins
 * the player into a screen corner, which is worse. Continuing the ground keeps
 * the player centred everywhere and reads as countryside beyond the town.
 *
 * It is deliberately a flatter, darker green than the play area so the authored
 * world still reads as a distinct region rather than blending into the surround.
 */
const SURROUND_MARGIN = 26;
const SURROUND_COLOR = 0x454a55;

export interface TerrainBuild {
  group: THREE.Group;
  dispose: () => void;
}

export function buildTerrain(map: WorldMap): TerrainBuild {
  const group = new THREE.Group();
  group.name = "terrain";

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  // Shared material per terrain type.
  const materialFor = new Map<TerrainType, THREE.MeshStandardMaterial>();
  const getMaterial = (t: TerrainType) => {
    let m = materialFor.get(t);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: TERRAIN_COLORS[t] ?? 0xff00ff,
        roughness: 0.95,
        metalness: 0,
      });
      materialFor.set(t, m);
      materials.push(m);
    }
    return m;
  };

  // A unit plane reused for every quad; each mesh scales it. Rotated flat so
  // its local +Y (plane normal) points up, and its local +Y extent maps to +Z.
  const makeQuadWithMaterial = (
    wTiles: number,
    dTiles: number,
    material: THREE.Material,
    cornerX: number,
    cornerZ: number,
    y: number,
  ) => {
    const geo = new THREE.PlaneGeometry(wTiles, dTiles);
    geo.rotateX(-Math.PI / 2);
    // PlaneGeometry is centred on its origin; shift so the mesh sits with its
    // corner at (cornerX, cornerZ), matching tile-corner semantics.
    geo.translate(cornerX + wTiles / 2, y, cornerZ + dTiles / 2);
    geometries.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    return mesh;
  };
  const makeQuad = (
    wTiles: number,
    dTiles: number,
    type: TerrainType,
    cornerX: number,
    cornerZ: number,
    y: number,
  ) => makeQuadWithMaterial(wTiles, dTiles, getMaterial(type), cornerX, cornerZ, y);

  // Ground beyond the authored map, so the world has a horizon rather than an
  // edge. Its own material — it is scenery, not a terrain type.
  const surroundGeo = new THREE.PlaneGeometry(
    map.widthTiles + SURROUND_MARGIN * 2,
    map.heightTiles + SURROUND_MARGIN * 2,
  );
  surroundGeo.rotateX(-Math.PI / 2);
  surroundGeo.translate(map.widthTiles / 2, SURROUND_Y, map.heightTiles / 2);
  geometries.push(surroundGeo);
  const surroundMat = new THREE.MeshStandardMaterial({
    color: SURROUND_COLOR,
    roughness: 1,
    metalness: 0,
  });
  materials.push(surroundMat);
  const surround = new THREE.Mesh(surroundGeo, surroundMat);
  surround.name = "surround";
  surround.receiveShadow = true;
  group.add(surround);

  // Base terrain covering the whole world.
  group.add(
    makeQuad(map.widthTiles, map.heightTiles, map.baseTerrain, 0, 0, BASE_Y),
  );

  // Concrete pads give each venue a city-block address and leave a full tile
  // of visual breathing room around its authored collision footprint. Streets
  // are painted afterwards, so they remain continuous through overlapping pads.
  const blockMat = new THREE.MeshStandardMaterial({
    color: BLOCK_COLOR,
    roughness: 0.94,
    metalness: 0,
  });
  materials.push(blockMat);
  for (const building of map.buildings) {
    const x = Math.max(0, building.x - BLOCK_MARGIN);
    const z = Math.max(0, building.y - BLOCK_MARGIN);
    const maxX = Math.min(map.widthTiles, building.x + building.w + BLOCK_MARGIN);
    const maxZ = Math.min(map.heightTiles, building.y + building.h + BLOCK_MARGIN);
    group.add(makeQuadWithMaterial(maxX - x, maxZ - z, blockMat, x, z, BLOCK_Y));
  }

  // Authored regions, painted in order (later regions sit above earlier ones).
  map.terrain.forEach((r, i) => {
    const corner = tileCornerToThree(r.x, r.y);
    group.add(
      makeQuad(
        r.w,
        r.h,
        r.type,
        corner.x,
        corner.z,
        // Tiny per-region lift preserves the authored paint order without
        // visible separation.
        REGION_Y + i * 0.001,
      ),
    );
  });

  // A light sidewalk and bright curb run inside each street edge. Keeping them
  // inside the authored rectangle preserves the generous 3–4 tile walkable
  // corridors while making the layout read as an urban street network.
  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: SIDEWALK_COLOR,
    roughness: 0.92,
    metalness: 0,
  });
  const curbMat = new THREE.MeshStandardMaterial({
    color: CURB_COLOR,
    roughness: 0.86,
    metalness: 0,
  });
  materials.push(sidewalkMat, curbMat);

  for (const street of map.terrain.filter((region) => region.type === "path")) {
    const horizontal = street.w >= street.h;
    if (horizontal) {
      group.add(
        makeQuadWithMaterial(
          street.w,
          SIDEWALK_WIDTH,
          sidewalkMat,
          street.x,
          street.y,
          STREET_DETAIL_Y,
        ),
        makeQuadWithMaterial(
          street.w,
          SIDEWALK_WIDTH,
          sidewalkMat,
          street.x,
          street.y + street.h - SIDEWALK_WIDTH,
          STREET_DETAIL_Y,
        ),
        makeQuadWithMaterial(
          street.w,
          CURB_WIDTH,
          curbMat,
          street.x,
          street.y + SIDEWALK_WIDTH,
          STREET_DETAIL_Y + 0.001,
        ),
        makeQuadWithMaterial(
          street.w,
          CURB_WIDTH,
          curbMat,
          street.x,
          street.y + street.h - SIDEWALK_WIDTH - CURB_WIDTH,
          STREET_DETAIL_Y + 0.001,
        ),
      );
    } else {
      group.add(
        makeQuadWithMaterial(
          SIDEWALK_WIDTH,
          street.h,
          sidewalkMat,
          street.x,
          street.y,
          STREET_DETAIL_Y,
        ),
        makeQuadWithMaterial(
          SIDEWALK_WIDTH,
          street.h,
          sidewalkMat,
          street.x + street.w - SIDEWALK_WIDTH,
          street.y,
          STREET_DETAIL_Y,
        ),
        makeQuadWithMaterial(
          CURB_WIDTH,
          street.h,
          curbMat,
          street.x + SIDEWALK_WIDTH,
          street.y,
          STREET_DETAIL_Y + 0.001,
        ),
        makeQuadWithMaterial(
          CURB_WIDTH,
          street.h,
          curbMat,
          street.x + street.w - SIDEWALK_WIDTH - CURB_WIDTH,
          street.y,
          STREET_DETAIL_Y + 0.001,
        ),
      );
    }
  }

  return {
    group,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
