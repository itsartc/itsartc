import * as THREE from "three";

/**
 * A placeholder human-scale avatar.
 *
 * There is no character model yet, so this is built from primitives at correct
 * proportions — 1.8 units tall against a city whose units are metres — which is
 * what makes the third-person camera distance and walk speed feel right. It is
 * swapped for a rigged GLB inside this file alone.
 *
 * Local forward is +Z, matching the convention in PlayerController.
 */

export const PLAYER_HEIGHT = 1.8;
export const PLAYER_RADIUS = 0.32;

export interface AvatarBuild {
  group: THREE.Group;
  dispose: () => void;
}

export function buildAvatar(): AvatarBuild {
  const group = new THREE.Group();
  group.name = "player";

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const add = (mesh: THREE.Mesh) => {
    geometries.push(mesh.geometry);
    materials.push(mesh.material as THREE.Material);
    group.add(mesh);
  };

  // Proportions are laid out against PLAYER_HEIGHT so the parts stack rather
  // than intersect: legs 0.00-0.86, torso 0.60-1.64, head 1.50-1.82.
  const legsGeo = new THREE.CapsuleGeometry(0.18, 0.5, 4, 12);
  const legsMat = new THREE.MeshStandardMaterial({ color: 0x24303f, roughness: 0.85 });
  const legs = new THREE.Mesh(legsGeo, legsMat);
  legs.position.y = 0.43;
  add(legs);

  const torsoGeo = new THREE.CapsuleGeometry(0.28, 0.48, 6, 18);
  const torsoMat = new THREE.MeshStandardMaterial({
    color: 0x2f6fd0,
    roughness: 0.6,
    metalness: 0.05,
  });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.position.y = 1.12;
  add(torso);

  const headGeo = new THREE.SphereGeometry(0.16, 20, 16);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xecc7a4, roughness: 0.75 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.66;
  add(head);

  // A facing marker: without it, a capsule gives the eye no way to read which
  // way the player is pointing when the camera swings around.
  const noseGeo = new THREE.ConeGeometry(0.08, 0.18, 10);
  noseGeo.rotateX(Math.PI / 2);
  const noseMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, 1.62, 0.3);
  add(nose);

  return {
    group,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
