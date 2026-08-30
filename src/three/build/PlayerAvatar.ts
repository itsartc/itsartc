import * as THREE from "three";

/**
 * The original Downtown explorer, built entirely from low-poly primitives.
 *
 * Keeping the character procedural means no model download, skeleton loader or
 * animation asset is needed. The limb groups are still articulated at sensible
 * pivots, so a rigged GLB can replace this implementation later without the
 * movement controller or renderer knowing the difference.
 *
 * Local forward is +Z, matching PlayerController.
 */

export const PLAYER_HEIGHT = 1.9;
export const PLAYER_RADIUS = 0.38;

export interface AvatarBuild {
  group: THREE.Group;
  update: (elapsed: number, moving: boolean, speed: number) => void;
  dispose: () => void;
}

export function buildAvatar(): AvatarBuild {
  const group = new THREE.Group();
  group.name = "player-explorer";

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const material = (color: number, roughness = 0.8, metalness = 0) => {
    const value = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      flatShading: true,
    });
    materials.push(value);
    return value;
  };

  const skin = material(0xc9783e, 0.86);
  const skinHighlight = material(0xe0904f, 0.82);
  const hair = material(0x211b1a, 0.95);
  const jacket = material(0x1854c7, 0.58, 0.04);
  const jacketDark = material(0x10284f, 0.7);
  const shirt = material(0xeee4cc, 0.92);
  const trousers = material(0x24262c, 0.94);
  const trouserTrim = material(0x3b3c42, 0.9);
  const shoes = material(0xe87818, 0.72);
  const soles = material(0xd9c5a2, 0.9);
  const backpack = material(0x252830, 0.88);
  const purple = material(0x8d4de8, 0.56, 0.02);
  const eyeWhite = material(0xf8f3e9, 0.65);
  const eyeDark = material(0x17191d, 0.72);

  const mesh = (
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    meshMaterial: THREE.Material,
    position?: [number, number, number],
    rotation?: [number, number, number],
  ) => {
    geometries.push(geometry);
    const value = new THREE.Mesh(geometry, meshMaterial);
    if (position) value.position.set(...position);
    if (rotation) value.rotation.set(...rotation);
    parent.add(value);
    return value;
  };

  // --- Legs and shoes -----------------------------------------------------
  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  leftLeg.name = "left-leg";
  rightLeg.name = "right-leg";
  leftLeg.position.set(-0.14, 0.82, 0);
  rightLeg.position.set(0.14, 0.82, 0);
  group.add(leftLeg, rightLeg);

  for (const leg of [leftLeg, rightLeg]) {
    mesh(leg, new THREE.BoxGeometry(0.23, 0.58, 0.25, 1, 2, 1), trousers, [0, -0.29, 0]);
    mesh(leg, new THREE.BoxGeometry(0.25, 0.1, 0.27), trouserTrim, [0, -0.57, 0]);
    mesh(leg, new THREE.BoxGeometry(0.27, 0.18, 0.43), shoes, [0, -0.68, 0.08]);
    mesh(leg, new THREE.BoxGeometry(0.29, 0.07, 0.46), soles, [0, -0.79, 0.08]);
    mesh(leg, new THREE.BoxGeometry(0.18, 0.035, 0.3), jacketDark, [0, -0.62, 0.19]);
  }

  // --- Body, jacket and shirt --------------------------------------------
  const torso = new THREE.Group();
  torso.name = "torso";
  group.add(torso);

  const torsoGeometry = new THREE.CapsuleGeometry(0.3, 0.35, 4, 8);
  torsoGeometry.scale(1.08, 1, 0.76);
  mesh(torso, torsoGeometry, jacket, [0, 1.17, 0]);
  mesh(torso, new THREE.BoxGeometry(0.3, 0.43, 0.035), shirt, [0, 1.18, 0.245]);
  mesh(torso, new THREE.BoxGeometry(0.66, 0.07, 0.28), jacketDark, [0, 0.9, 0]);

  // Jacket opening, collar and the character's small three-node emblem.
  mesh(torso, new THREE.BoxGeometry(0.045, 0.46, 0.035), jacketDark, [-0.17, 1.18, 0.267]);
  mesh(torso, new THREE.BoxGeometry(0.045, 0.46, 0.035), jacketDark, [0.17, 1.18, 0.267]);
  mesh(torso, new THREE.BoxGeometry(0.17, 0.08, 0.06), jacketDark, [-0.11, 1.43, 0.21], [0, 0, -0.42]);
  mesh(torso, new THREE.BoxGeometry(0.17, 0.08, 0.06), jacketDark, [0.11, 1.43, 0.21], [0, 0, 0.42]);

  const emblemPoints: Array<[number, number]> = [
    [0, 1.29],
    [-0.07, 1.17],
    [0.07, 1.17],
  ];
  for (const [x, y] of emblemPoints) {
    mesh(torso, new THREE.IcosahedronGeometry(0.025, 1), purple, [x, y, 0.286]);
  }
  mesh(torso, new THREE.BoxGeometry(0.025, 0.13, 0.022), purple, [-0.035, 1.235, 0.28], [0, 0, -0.53]);
  mesh(torso, new THREE.BoxGeometry(0.025, 0.13, 0.022), purple, [0.035, 1.235, 0.28], [0, 0, 0.53]);
  mesh(torso, new THREE.BoxGeometry(0.14, 0.025, 0.022), purple, [0, 1.17, 0.28]);

  // --- Backpack -----------------------------------------------------------
  const packGeometry = new THREE.CapsuleGeometry(0.23, 0.28, 4, 8);
  packGeometry.scale(1.08, 1, 0.52);
  mesh(torso, packGeometry, backpack, [0, 1.17, -0.25]);
  mesh(torso, new THREE.BoxGeometry(0.12, 0.48, 0.05), purple, [-0.22, 1.2, -0.1], [0, 0, 0.12]);
  mesh(torso, new THREE.BoxGeometry(0.12, 0.48, 0.05), jacketDark, [0.22, 1.2, -0.1], [0, 0, -0.12]);
  mesh(torso, new THREE.BoxGeometry(0.35, 0.13, 0.08), jacketDark, [0, 1.02, -0.39]);

  // --- Arms and oversized hands -----------------------------------------
  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  leftArm.name = "left-arm";
  rightArm.name = "right-arm";
  leftArm.position.set(-0.37, 1.4, 0);
  rightArm.position.set(0.37, 1.4, 0);
  leftArm.rotation.z = 0.12;
  rightArm.rotation.z = -0.12;
  group.add(leftArm, rightArm);

  for (const arm of [leftArm, rightArm]) {
    const sleeveGeometry = new THREE.CapsuleGeometry(0.115, 0.34, 3, 7);
    mesh(arm, sleeveGeometry, jacket, [0, -0.25, 0]);
    mesh(arm, new THREE.BoxGeometry(0.23, 0.08, 0.2), jacketDark, [0, -0.48, 0]);
    const handGeometry = new THREE.IcosahedronGeometry(0.125, 1);
    handGeometry.scale(0.95, 1.15, 0.88);
    mesh(arm, handGeometry, skinHighlight, [0, -0.6, 0.015]);
  }

  // --- Head, face and faceted curls --------------------------------------
  const headGroup = new THREE.Group();
  headGroup.name = "head";
  headGroup.position.y = 1.63;
  group.add(headGroup);

  const headGeometry = new THREE.IcosahedronGeometry(0.245, 2);
  headGeometry.scale(0.95, 1.08, 0.9);
  mesh(headGroup, headGeometry, skinHighlight);
  mesh(headGroup, new THREE.IcosahedronGeometry(0.065, 1), skin, [-0.24, 0, 0]);
  mesh(headGroup, new THREE.IcosahedronGeometry(0.065, 1), skin, [0.24, 0, 0]);

  for (const x of [-0.09, 0.09]) {
    const whiteGeometry = new THREE.SphereGeometry(0.056, 8, 6);
    whiteGeometry.scale(0.82, 1.08, 0.45);
    mesh(headGroup, whiteGeometry, eyeWhite, [x, 0.045, 0.218]);
    mesh(headGroup, new THREE.IcosahedronGeometry(0.025, 1), eyeDark, [x, 0.045, 0.253]);
    mesh(
      headGroup,
      new THREE.BoxGeometry(0.085, 0.022, 0.025),
      hair,
      [x, 0.12, 0.225],
      [0, 0, x < 0 ? -0.12 : 0.12],
    );
  }
  mesh(headGroup, new THREE.IcosahedronGeometry(0.036, 1), skin, [0, -0.015, 0.245]);

  const smileGeometry = new THREE.TorusGeometry(0.065, 0.009, 4, 12, Math.PI);
  smileGeometry.rotateZ(Math.PI);
  mesh(headGroup, smileGeometry, eyeDark, [0, -0.085, 0.224]);

  // A dark rear cap plus separate curls keeps the hairstyle readable from the
  // chase camera, where the player mostly sees the character from behind.
  const hairBack = new THREE.IcosahedronGeometry(0.255, 1);
  hairBack.scale(1.08, 0.94, 0.92);
  mesh(headGroup, hairBack, hair, [0, 0.075, -0.075]);

  const curls: Array<[number, number, number, number]> = [
    [-0.18, 0.16, 0.02, 0.12],
    [-0.08, 0.24, 0.015, 0.13],
    [0.05, 0.25, 0, 0.135],
    [0.17, 0.17, 0.015, 0.12],
    [-0.235, 0.04, -0.02, 0.105],
    [0.235, 0.04, -0.02, 0.105],
    [-0.16, -0.1, -0.07, 0.105],
    [0.16, -0.1, -0.07, 0.105],
  ];
  for (const [x, y, z, radius] of curls) {
    mesh(headGroup, new THREE.IcosahedronGeometry(radius, 1), hair, [x, y, z]);
  }

  const update = (elapsed: number, moving: boolean, speed: number) => {
    const strideRate = 7.5 + Math.min(speed, 12) * 0.28;
    const stride = moving ? Math.sin(elapsed * strideRate) * 0.56 : 0;
    const armStride = stride * 0.72;
    const settle = Math.min(1, Math.max(0, speed / 2));

    leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, stride, moving ? 0.38 : 0.18);
    rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, -stride, moving ? 0.38 : 0.18);
    leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, -armStride, moving ? 0.32 : 0.16);
    rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, armStride, moving ? 0.32 : 0.16);

    torso.rotation.z = moving ? Math.sin(elapsed * strideRate * 0.5) * 0.025 * settle : 0;
    headGroup.rotation.z = moving ? -torso.rotation.z * 0.55 : Math.sin(elapsed * 1.4) * 0.008;
    headGroup.position.y =
      1.63 +
      (moving
        ? Math.abs(Math.sin(elapsed * strideRate)) * 0.012
        : Math.sin(elapsed * 1.7) * 0.005);
  };

  return {
    group,
    update,
    dispose: () => {
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((value) => value.dispose());
    },
  };
}
