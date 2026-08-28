import * as THREE from "three";

/**
 * The placeholder player avatar.
 *
 * Phase 2 needs a body that reads clearly at social camera distance and shows
 * which way it is facing — nothing more. Real characters arrive in the visual
 * phase, and because callers only ever receive an Object3D, swapping this for a
 * rigged GLB is a change inside this file.
 *
 * The group's local forward is +Z, matching the convention in PlayerController:
 * a yaw of 0 faces down the map, the direction the camera looks from.
 */

/** Overall avatar height in scene units (1 unit = 1 tile). */
export const PLAYER_HEIGHT = 1.4;

/** Radius used for the body capsule — also the future collision radius. */
export const PLAYER_RADIUS = 0.3;

export interface PlayerBuild {
  group: THREE.Group;
  dispose: () => void;
}

export function buildPlayer(): PlayerBuild {
  const group = new THREE.Group();
  group.name = "player";

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const add = (mesh: THREE.Mesh) => {
    geometries.push(mesh.geometry);
    materials.push(mesh.material as THREE.Material);
    group.add(mesh);
  };

  // Body: a capsule standing on the ground. Capsule origin is its centre, so
  // it is lifted by half its total height.
  const bodyLength = PLAYER_HEIGHT - 2 * PLAYER_RADIUS - 0.34;
  const bodyGeo = new THREE.CapsuleGeometry(PLAYER_RADIUS, bodyLength, 6, 16);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3f6fd8, roughness: 0.55 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = PLAYER_RADIUS + bodyLength / 2;
  body.name = "player-body";
  add(body);

  // Head.
  const headGeo = new THREE.SphereGeometry(0.24, 18, 14);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xf0c9a4, roughness: 0.7 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = PLAYER_HEIGHT - 0.24;
  head.name = "player-head";
  add(head);

  // Facing wedge: without it, a capsule gives the eye no way to read yaw, and
  // "which way am I pointing" is the whole reason the avatar rotates.
  const noseGeo = new THREE.ConeGeometry(0.1, 0.22, 10);
  noseGeo.rotateX(Math.PI / 2); // point along +Z
  const noseMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, PLAYER_HEIGHT - 0.26, 0.24);
  nose.name = "player-facing";
  add(nose);

  return {
    group,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
