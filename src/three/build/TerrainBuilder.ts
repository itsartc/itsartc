import * as THREE from "three";
import type { WorldMap, TerrainType } from "@/world/schema";
import { tileCornerToThree } from "../coords";

/**
 * Builds the ground: one base plane for the whole world, plus a thin quad for
 * each authored terrain region (plaza, paths, garden lawn, pond, sand).
 *
 * Phase 1 uses flat unlit-ish colours only — no textures, no height variation.
 * The job here is to prove the regions land in the right places, at the right
 * sizes, in the right orientation.
 *
 * Materials are shared per terrain type rather than created per mesh, so the
 * draw-call and material count stay flat as the world grows.
 */

/** Matches the 2D renderer's palette so the two routes are comparable by eye. */
const TERRAIN_COLORS: Record<TerrainType, number> = {
  grass: 0x6fae43,
  grassdark: 0x568a34,
  path: 0xc2a06a,
  plaza: 0xd6c69a,
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
const REGION_Y = 0.01;

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
const SURROUND_COLOR = 0x4d7a35;

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
  const makeQuad = (
    wTiles: number,
    dTiles: number,
    type: TerrainType,
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
    const mesh = new THREE.Mesh(geo, getMaterial(type));
    mesh.receiveShadow = true;
    return mesh;
  };

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

  return {
    group,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
