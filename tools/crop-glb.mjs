import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dequantize, prune, dedup, meshopt } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

/**
 * Crops a GLB to a half-space, splitting triangles that straddle the boundary.
 *
 *   npm i --no-save @gltf-transform/core @gltf-transform/extensions \
 *                   @gltf-transform/functions meshoptimizer
 *   node tools/crop-glb.mjs in.glb out.glb x -98 above
 *
 * Kept out of package.json: this runs once when the map changes, and the app
 * itself needs none of it. The model in public/ is a *derived* file — this is
 * the record of how, and the only way to redo the crop at a different line.
 *
 * Filtering whole triangles is not enough here: the model is grouped by
 * material rather than by block, so a single road or pavement triangle can span
 * the entire city. Testing its centroid would keep the whole ground plane;
 * requiring every vertex inside would delete it. So each triangle is clipped
 * against the plane and re-triangulated, interpolating every vertex attribute.
 *
 * The plane is given in world space and pushed into each node's local space
 * (P_local = Mᵀ·P), which is cheaper and more accurate than transforming every
 * vertex out and back.
 */

const [, , IN, OUT, AXIS, VALUE, KEEP] = process.argv;
const axis = { x: 0, y: 1, z: 2 }[AXIS];
const value = Number(VALUE);
const sign = KEEP === "above" ? 1 : -1;      // keep coord*sign >= value*sign

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

const doc = await io.read(IN);
await doc.transform(dequantize());

/** World-space plane as a 4-vector: P·(x,y,z,1) >= 0 is the keep side. */
const P = [0, 0, 0, 0];
P[axis] = sign;
P[3] = -value * sign;

const localPlane = (m) => {
  const out = [0, 0, 0, 0];
  for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let c = 0; c < 4; c++) s += m[r * 4 + c] * P[c];
    out[r] = s;
  }
  return out;
};

let trisIn = 0, trisOut = 0, primsDropped = 0;

for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const pl = localPlane(node.getWorldMatrix());
  const side = (p) => pl[0] * p[0] + pl[1] * p[1] + pl[2] * p[2] + pl[3];

  for (const prim of mesh.listPrimitives()) {
    const semantics = prim.listSemantics();
    const attrs = semantics.map((s) => prim.getAttribute(s));
    const posAt = semantics.indexOf("POSITION");
    if (posAt < 0) continue;
    const indices = prim.getIndices();
    const count = indices ? indices.getCount() : attrs[posAt].getCount();

    const read = (i) => attrs.map((a) => a.getElement(i, []));
    const lerp = (a, b, t) => a.map((v, k) => v.map((x, j) => x + (b[k][j] - x) * t));
    const out = semantics.map(() => []);
    const outIdx = [];
    let next = 0;

    const emit = (poly) => {
      const base = next;
      for (const v of poly) {
        v.forEach((el, k) => out[k].push(...el));
        next++;
      }
      for (let i = 1; i + 1 < poly.length; i++) outIdx.push(base, base + i, base + i + 1);
    };

    for (let t = 0; t < count; t += 3) {
      trisIn++;
      const tri = [0, 1, 2].map((k) => read(indices ? indices.getScalar(t + k) : t + k));
      const d = tri.map((v) => side(v[posAt]));
      if (d[0] >= 0 && d[1] >= 0 && d[2] >= 0) { emit(tri); continue; }
      if (d[0] < 0 && d[1] < 0 && d[2] < 0) continue;

      // Sutherland-Hodgman against the single plane.
      const poly = [];
      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3;
        if (d[i] >= 0) poly.push(tri[i]);
        if ((d[i] >= 0) !== (d[j] >= 0)) {
          poly.push(lerp(tri[i], tri[j], d[i] / (d[i] - d[j])));
        }
      }
      if (poly.length >= 3) emit(poly);
    }

    trisOut += outIdx.length / 3;

    if (outIdx.length === 0) { prim.dispose(); primsDropped++; continue; }

    semantics.forEach((s, k) => {
      const a = attrs[k];
      const arr = new Float32Array(out[k]);
      // Normals and tangent directions stop being unit length once interpolated.
      if (s === "NORMAL" || s === "TANGENT") {
        const size = a.getElementSize();
        for (let i = 0; i < arr.length; i += size) {
          const L = Math.hypot(arr[i], arr[i + 1], arr[i + 2]) || 1;
          arr[i] /= L; arr[i + 1] /= L; arr[i + 2] /= L;
        }
      }
      prim.setAttribute(s, doc.createAccessor().setType(a.getType()).setArray(arr));
    });
    const max = next;
    const IdxArray = max > 65535 ? Uint32Array : Uint16Array;
    prim.setIndices(doc.createAccessor().setType("SCALAR").setArray(new IdxArray(outIdx)));
  }
  if (mesh.listPrimitives().length === 0) node.setMesh(null);
}

// Dequantizing to clip stripped the compression the model shipped with;
// putting it back is what keeps the crop a saving rather than a cost.
await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: "high" }));
await io.write(OUT, doc);
console.log(`triangles ${trisIn} -> ${Math.round(trisOut)} (${(100 * trisOut / trisIn).toFixed(1)}%), empty primitives dropped: ${primsDropped}`);
