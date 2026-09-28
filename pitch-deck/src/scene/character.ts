import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Soft "clay" look shared by every part of the character. */
export function clay(color: THREE.ColorRepresentation, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.62,
    metalness: 0,
    sheen: 0.25,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.35),
    clearcoat: 0,
    ...opts,
  });
}

const COLORS = {
  skin: '#e8906a',
  cheek: '#f06a62',
  hair: '#5a2d16',
  shirt: '#4b6268',
  shorts: '#6c6356',
  shoe: '#efdcb6',
  sole: '#f7ecd6',
  bag: '#d8712c',
  strap: '#c9652a',
  black: '#141414',
};

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, name = '') {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.name = name;
  return m;
}

export interface CharacterRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  eyes: THREE.Group[];
  bag: THREE.Group;
  /** Meshes that belong to the character (excluding the bag). */
  characterMeshes: THREE.Mesh[];
}

export function buildCharacter(): CharacterRig {
  const root = new THREE.Group();
  root.name = 'Character';
  const body = new THREE.Group();
  root.add(body);

  const skin = clay(COLORS.skin, { roughness: 0.5, sheen: 0.35, sheenColor: new THREE.Color('#ffc2a3') });
  const shirt = clay(COLORS.shirt, { roughness: 0.9, sheen: 0.5 });
  const shorts = clay(COLORS.shorts, { roughness: 0.9, sheen: 0.5 });
  const shoe = clay(COLORS.shoe, { roughness: 0.75 });
  const sole = clay(COLORS.sole, { roughness: 0.7 });
  const hair = clay(COLORS.hair, { roughness: 0.6, sheen: 0.2 });
  const black = clay(COLORS.black, { roughness: 0.25, clearcoat: 0.8, sheen: 0 });

  // ---------- Feet ----------
  for (const side of [-1, 1]) {
    const foot = new THREE.Group();
    foot.position.set(side * 0.2, 0, 0.04);
    const upper = mesh(new THREE.SphereGeometry(1, 40, 24), shoe);
    upper.scale.set(0.17, 0.13, 0.27);
    upper.position.set(0, 0.11, 0.03);
    const soleM = mesh(new RoundedBoxGeometry(0.36, 0.06, 0.58, 4, 0.03), sole);
    soleM.position.set(0, 0.03, 0.03);
    const tongue = mesh(new THREE.SphereGeometry(1, 24, 16), shoe);
    tongue.scale.set(0.1, 0.06, 0.12);
    tongue.position.set(0, 0.21, 0.1);
    foot.add(upper, soleM, tongue);
    // laces
    for (let i = 0; i < 3; i++) {
      const lace = mesh(new THREE.CapsuleGeometry(0.012, 0.1, 4, 8), sole);
      lace.rotation.z = Math.PI / 2;
      lace.position.set(0, 0.215 - i * 0.02, 0.15 + i * 0.045);
      foot.add(lace);
    }
    body.add(foot);

    // ---------- Legs ----------
    const leg = mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.34, 24), skin);
    leg.position.set(side * 0.19, 0.38, 0);
    body.add(leg);

    // ---------- Shorts legs + cuffs ----------
    const pant = mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.3, 32), shorts);
    pant.position.set(side * 0.19, 0.66, 0);
    const cuff = mesh(new THREE.TorusGeometry(0.195, 0.035, 12, 40), shorts);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.set(side * 0.19, 0.52, 0);
    body.add(pant, cuff);
  }

  // Hips
  const hips = mesh(new THREE.SphereGeometry(1, 40, 24), shorts);
  hips.scale.set(0.42, 0.24, 0.32);
  hips.position.set(0, 0.78, 0);
  body.add(hips);

  // ---------- Torso ----------
  const torso = mesh(new THREE.CapsuleGeometry(0.36, 0.32, 12, 40), shirt);
  torso.scale.set(1.08, 0.9, 0.82);
  torso.position.set(0, 1.12, 0);
  body.add(torso);
  const hem = mesh(new THREE.TorusGeometry(0.36, 0.035, 12, 48), shirt);
  hem.rotation.x = Math.PI / 2;
  hem.scale.set(1.08, 0.82, 1);
  hem.position.set(0, 0.84, 0);
  body.add(hem);

  const neck = mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 24), skin);
  neck.position.set(0, 1.47, 0);
  body.add(neck);
  const collar = mesh(new THREE.TorusGeometry(0.13, 0.025, 10, 32), shirt);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 1.44, 0.01);
  body.add(collar);

  // ---------- Arms ----------
  const makeArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.4, 1.3, 0);
    const sleeve = mesh(new THREE.CapsuleGeometry(0.15, 0.14, 10, 28), shirt);
    sleeve.position.set(side * 0.06, -0.1, 0);
    sleeve.rotation.z = side * 0.35;
    const sleeveCuff = mesh(new THREE.TorusGeometry(0.14, 0.03, 10, 28), shirt);
    sleeveCuff.position.set(side * 0.11, -0.24, 0);
    sleeveCuff.rotation.set(Math.PI / 2, side * 0.35, 0);
    const upper = mesh(new THREE.CapsuleGeometry(0.075, 0.36, 8, 20), skin);
    upper.position.set(side * 0.12, -0.42, 0.01);
    upper.rotation.z = side * 0.1;
    const hand = mesh(new THREE.SphereGeometry(0.095, 28, 20), skin);
    hand.scale.set(0.9, 1.1, 0.85);
    hand.position.set(side * 0.15, -0.66, 0.02);
    arm.add(sleeve, sleeveCuff, upper, hand);
    return arm;
  };
  const rightArm = makeArm(-1); // viewer's left
  const leftArm = makeArm(1); // viewer's right
  body.add(rightArm, leftArm);

  // Watch on the character's left wrist
  const watchBand = mesh(new THREE.TorusGeometry(0.08, 0.022, 10, 28), black);
  watchBand.rotation.set(Math.PI / 2, 0, 0.1);
  watchBand.position.set(0.14, -0.56, 0.01);
  const watchFace = mesh(new RoundedBoxGeometry(0.06, 0.09, 0.08, 2, 0.015), black);
  watchFace.position.set(0.23, -0.56, 0.02);
  leftArm.add(watchBand, watchFace);

  // ---------- Head ----------
  const head = new THREE.Group();
  head.position.set(0, 2.02, 0);
  body.add(head);

  const skull = mesh(new THREE.SphereGeometry(0.56, 64, 48), skin);
  skull.scale.set(1.02, 0.96, 0.94);
  head.add(skull);

  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.12, 24, 16), skin);
    ear.scale.set(0.6, 1, 0.8);
    ear.position.set(side * 0.56, -0.06, -0.02);
    head.add(ear);

    const cheek = mesh(
      new THREE.SphereGeometry(0.1, 24, 16),
      clay(COLORS.cheek, { transparent: true, opacity: 0.35, roughness: 0.9, sheen: 0 }),
    );
    cheek.scale.set(1.2, 0.7, 0.3);
    cheek.position.set(side * 0.3, -0.18, 0.44);
    cheek.rotation.y = side * 0.55;
    cheek.castShadow = false;
    head.add(cheek);
  }

  const nose = mesh(new THREE.SphereGeometry(0.05, 20, 16), skin);
  nose.scale.set(1.1, 0.8, 0.8);
  nose.position.set(0, -0.1, 0.53);
  head.add(nose);

  const mouth = mesh(new THREE.CapsuleGeometry(0.012, 0.05, 4, 8), clay('#6a2b1f', { roughness: 0.5, sheen: 0 }));
  mouth.rotation.z = Math.PI / 2;
  mouth.position.set(0, -0.25, 0.5);
  head.add(mouth);

  // Eyes (groups so they can blink)
  const eyes: THREE.Group[] = [];
  const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.2, 0.02, 0.48);
    const pupil = mesh(new THREE.SphereGeometry(0.068, 28, 20), black);
    pupil.scale.set(1, 1.1, 0.6);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), white);
    glint.position.set(0.022, 0.03, 0.035);
    eye.add(pupil, glint);
    head.add(eye);
    eyes.push(eye);

    const brow = mesh(new THREE.CapsuleGeometry(0.018, 0.08, 4, 10), hair);
    brow.rotation.z = Math.PI / 2 + side * 0.12;
    brow.position.set(side * 0.2, 0.2, 0.5);
    head.add(brow);
  }

  // Glasses
  const frame = clay('#1a1a1a', { roughness: 0.3, clearcoat: 0.6, sheen: 0 });
  for (const side of [-1, 1]) {
    const rim = mesh(new THREE.TorusGeometry(0.17, 0.024, 16, 48), frame);
    rim.position.set(side * 0.21, 0.02, 0.56);
    rim.rotation.y = side * 0.12;
    head.add(rim);
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 40),
      new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.08, roughness: 0, transmission: 0 }),
    );
    lens.position.copy(rim.position);
    lens.rotation.y = rim.rotation.y;
    head.add(lens);
    const temple = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.52, 8), frame);
    temple.rotation.x = Math.PI / 2;
    temple.position.set(side * 0.53, 0.05, 0.28);
    head.add(temple);
  }
  const bridgeCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.05, 0.06, 0.575),
    new THREE.Vector3(0, 0.1, 0.6),
    new THREE.Vector3(0.05, 0.06, 0.575),
  );
  head.add(mesh(new THREE.TubeGeometry(bridgeCurve, 12, 0.018, 8), frame));

  // Hair: cap + tufts
  const cap = mesh(new THREE.SphereGeometry(0.6, 64, 32, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
  cap.scale.set(1.02, 0.98, 0.98);
  cap.position.set(0, 0.04, -0.03);
  cap.rotation.x = -0.18;
  head.add(cap);
  const back = mesh(new THREE.SphereGeometry(0.58, 48, 32), hair);
  back.scale.set(1.02, 0.9, 0.8);
  back.position.set(0, 0.02, -0.14);
  head.add(back);

  const tufts: [number, number, number, number, number, number][] = [
    // x, y, z, sx, sy, rotZ
    [-0.34, 0.3, 0.3, 0.2, 0.15, 0.5],
    [-0.16, 0.36, 0.38, 0.22, 0.14, 0.25],
    [0.04, 0.37, 0.4, 0.22, 0.14, -0.1],
    [0.24, 0.34, 0.36, 0.22, 0.14, -0.3],
    [0.4, 0.26, 0.26, 0.18, 0.15, -0.6],
    [-0.5, 0.08, 0.1, 0.12, 0.22, 0.2],
    [0.5, 0.08, 0.1, 0.12, 0.22, -0.2],
    [0.1, 0.52, 0.12, 0.2, 0.1, -0.3],
    [-0.18, 0.5, 0.1, 0.18, 0.1, 0.4],
  ];
  for (const [x, y, z, sx, sy, rz] of tufts) {
    const t = mesh(new THREE.SphereGeometry(1, 28, 20), hair);
    t.scale.set(sx, sy, 0.16);
    t.position.set(x, y, z);
    t.rotation.set(-0.35, 0, rz);
    head.add(t);
  }
  // cowlick
  const lick = mesh(new THREE.ConeGeometry(0.06, 0.16, 16), hair);
  lick.position.set(0.02, 0.6, 0.02);
  lick.rotation.set(-0.3, 0, -0.5);
  head.add(lick);

  const characterMeshes: THREE.Mesh[] = [];
  body.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) characterMeshes.push(o as THREE.Mesh);
  });

  // ---------- Crossbody bag (separate layer: "Object 2") ----------
  const bag = new THREE.Group();
  bag.name = 'Object 2';
  const bagMat = clay(COLORS.bag, { roughness: 0.55, sheen: 0.5 });
  const strapMat = clay(COLORS.strap, { roughness: 0.6 });
  const strapCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.3, 1.45, 0.08),
    new THREE.Vector3(-0.22, 1.36, 0.3),
    new THREE.Vector3(0.0, 1.12, 0.35),
    new THREE.Vector3(0.22, 0.9, 0.34),
    new THREE.Vector3(0.36, 0.82, 0.3),
  ]);
  const strap = mesh(new THREE.TubeGeometry(strapCurve, 48, 0.03, 10), strapMat);
  strap.scale.set(1, 1, 1);
  const pouch = mesh(new RoundedBoxGeometry(0.34, 0.3, 0.14, 5, 0.06), bagMat);
  pouch.position.set(0.38, 0.72, 0.36);
  pouch.rotation.set(0.05, -0.25, 0.08);
  const flap = mesh(new RoundedBoxGeometry(0.35, 0.16, 0.05, 4, 0.024), clay('#c9621f', { roughness: 0.5 }));
  flap.position.set(0.39, 0.79, 0.43);
  flap.rotation.copy(pouch.rotation);
  const clasp = mesh(new THREE.SphereGeometry(0.02, 12, 10), clay('#8a3f14'));
  clasp.position.set(0.37, 0.73, 0.46);
  bag.add(strap, pouch, flap, clasp);
  body.add(bag);

  return { root, body, head, leftArm, rightArm, eyes, bag, characterMeshes };
}
