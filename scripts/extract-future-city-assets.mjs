#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import * as THREE from "three";

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

const SOURCE = {
  title: "Future_city_1",
  creator: "HiQ3D",
  creatorUrl: "https://sketchfab.com/HiQ3D",
  sourceUrl: "https://sketchfab.com/3d-models/future-city-1-1363540d0f934472ac556a6f8cb0bdf1",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
};

const SELECTIONS = [
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((number) => ({
    id: `building-${number}`,
    label: `Future Building ${number}`,
    node: new RegExp(`^Building_${number}_[0-9]+$`),
    normalize: { maxHorizontal: 10 },
  })),
  {
    id: "street-light",
    label: "Future Street Light",
    node: /^Street_lights_191_[0-9]+$/,
    normalize: { height: 3 },
  },
  {
    id: "tube-bridge",
    label: "Future Tube Bridge",
    node: /^Tube_Bridge_[0-9]+$/,
    normalize: { maxHorizontal: 8 },
  },
];

const [inputArg, outputArg = "public/assets/sketchfab/future-city-1"] = process.argv.slice(2);
if (!inputArg) {
  console.error("Usage: node scripts/extract-future-city-assets.mjs <source.glb> [output-directory]");
  process.exit(1);
}

const inputPath = path.resolve(inputArg);
const outputPath = path.resolve(outputArg);
const sourceBytes = await readFile(inputPath);
const { json: source, binary } = readGlb(sourceBytes);

assertSupportedSource(source);
await mkdir(outputPath, { recursive: true });

const parents = makeParentMap(source.nodes);
const worldMatrices = makeWorldMatrices(source, parents);
const manifest = [];

for (const selection of SELECTIONS) {
  const matches = source.nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => selection.node.test(node.name ?? ""));
  if (matches.length !== 1) {
    throw new Error(`${selection.id}: expected one matching node, found ${matches.length}`);
  }

  const result = extractAsset({
    source,
    binary,
    rootIndex: matches[0].index,
    worldMatrices,
    selection,
  });
  const filename = `${selection.id}.glb`;
  await writeFile(path.join(outputPath, filename), result.glb);
  manifest.push({
    id: selection.id,
    label: selection.label,
    file: filename,
    sourceNode: matches[0].node.name,
    bytes: result.glb.length,
    triangles: result.triangles,
    meshes: result.meshes,
    materials: result.materials,
    normalizedBoundsMetres: result.normalizedBounds,
  });
}

const conversionManifest = {
  generatedBy: "scripts/extract-future-city-assets.mjs",
  source: {
    ...SOURCE,
    filename: path.basename(inputPath),
    sha256: createHash("sha256").update(sourceBytes).digest("hex"),
  },
  notes: [
    "The original source GLB is intentionally not deployed.",
    "Each output contains only the nodes, meshes, materials, accessors and buffer data used by that asset.",
    "Outputs are centred, grounded and uniformly normalized for the Three.js world editor.",
    "Geometry has not yet been decimated; future LOD work should retain this manifest and attribution.",
  ],
  deferred: [
    {
      id: "building-11",
      sourceNode: "building_11_536",
      triangles: 465885,
      reason: "Requires decimation and at least one lower-detail model before browser deployment.",
    },
    {
      id: "park-bench",
      sourceNode: "park_bench006_933",
      triangles: 26376,
      reason: "Too detailed and abnormally proportioned; the existing lightweight bench remains the safe fallback.",
    },
  ],
  assets: manifest,
};
await writeFile(
  path.join(outputPath, "manifest.json"),
  `${JSON.stringify(conversionManifest, null, 2)}\n`,
);

for (const asset of manifest) {
  console.log(
    `${asset.id.padEnd(14)} ${formatBytes(asset.bytes).padStart(9)}  ${String(asset.triangles).padStart(8)} triangles`,
  );
}

function extractAsset({ source, binary, rootIndex, worldMatrices, selection }) {
  const descendants = collectDescendants(source.nodes, rootIndex);
  const orderedNodes = [...descendants].sort((a, b) => a - b);
  const bounds = measureBounds(source, orderedNodes, worldMatrices);
  if (bounds.isEmpty()) throw new Error(`${selection.id}: no measurable geometry`);

  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scalar = selection.normalize.height
    ? selection.normalize.height / size.y
    : selection.normalize.maxHorizontal / Math.max(size.x, size.z);
  if (!Number.isFinite(scalar) || scalar <= 0) {
    throw new Error(`${selection.id}: invalid source bounds`);
  }

  const meshIndices = orderedNodes
    .map((index) => source.nodes[index].mesh)
    .filter((index) => index !== undefined);
  const uniqueMeshes = [...new Set(meshIndices)].sort((a, b) => a - b);
  const meshMap = new Map(uniqueMeshes.map((oldIndex, index) => [oldIndex, index]));

  const materialIndices = [];
  for (const meshIndex of uniqueMeshes) {
    for (const primitive of source.meshes[meshIndex].primitives) {
      if (primitive.material !== undefined) materialIndices.push(primitive.material);
    }
  }
  const uniqueMaterials = [...new Set(materialIndices)].sort((a, b) => a - b);
  const materialMap = new Map(uniqueMaterials.map((oldIndex, index) => [oldIndex, index]));

  const accessorIndices = [];
  for (const meshIndex of uniqueMeshes) {
    for (const primitive of source.meshes[meshIndex].primitives) {
      if (primitive.indices !== undefined) accessorIndices.push(primitive.indices);
      accessorIndices.push(...Object.values(primitive.attributes));
      for (const target of primitive.targets ?? []) accessorIndices.push(...Object.values(target));
    }
  }
  const uniqueAccessors = [...new Set(accessorIndices)].sort((a, b) => a - b);
  const accessorMap = new Map(uniqueAccessors.map((oldIndex, index) => [oldIndex, index]));

  const packed = packAccessors(source, binary, uniqueAccessors);

  const nodeMap = new Map(orderedNodes.map((oldIndex, index) => [oldIndex, index + 1]));
  const normalizer = new THREE.Matrix4().set(
    scalar, 0, 0, -scalar * center.x,
    0, scalar, 0, -scalar * bounds.min.y,
    0, 0, scalar, -scalar * center.z,
    0, 0, 0, 1,
  );

  const nodes = [
    {
      name: `${selection.id}:normalized-root`,
      matrix: normalizer.toArray(),
      children: [nodeMap.get(rootIndex)],
      extras: {
        sourceTitle: SOURCE.title,
        sourceCreator: SOURCE.creator,
        sourceUrl: SOURCE.sourceUrl,
        license: SOURCE.license,
        licenseUrl: SOURCE.licenseUrl,
        modified: true,
      },
    },
    ...orderedNodes.map((oldIndex) => {
      const oldNode = source.nodes[oldIndex];
      const node = structuredClone(oldNode);
      if (node.children) node.children = node.children.filter((child) => descendants.has(child)).map((child) => nodeMap.get(child));
      if (node.mesh !== undefined) node.mesh = meshMap.get(node.mesh);
      if (oldIndex === rootIndex) {
        delete node.translation;
        delete node.rotation;
        delete node.scale;
        node.matrix = worldMatrices[oldIndex].toArray();
      }
      return node;
    }),
  ];

  const meshes = uniqueMeshes.map((oldIndex) => {
    const mesh = structuredClone(source.meshes[oldIndex]);
    for (const primitive of mesh.primitives) {
      if (primitive.indices !== undefined) primitive.indices = accessorMap.get(primitive.indices);
      primitive.attributes = Object.fromEntries(
        Object.entries(primitive.attributes).map(([name, index]) => [name, accessorMap.get(index)]),
      );
      if (primitive.material !== undefined) primitive.material = materialMap.get(primitive.material);
      if (primitive.targets) {
        primitive.targets = primitive.targets.map((target) => Object.fromEntries(
          Object.entries(target).map(([name, index]) => [name, accessorMap.get(index)]),
        ));
      }
    }
    return mesh;
  });

  const json = {
    asset: {
      version: "2.0",
      generator: "ItsArtC Future City extractor",
      copyright: `${SOURCE.title} by ${SOURCE.creator}, ${SOURCE.license}; modified for ItsArtC`,
    },
    scene: 0,
    scenes: [{ name: selection.label, nodes: [0] }],
    nodes,
    meshes,
    materials: uniqueMaterials.map((index) => structuredClone(source.materials[index])),
    accessors: packed.accessors,
    bufferViews: packed.bufferViews,
    buffers: [{ byteLength: packed.binary.length }],
  };

  return {
    glb: writeGlb(json, packed.binary),
    triangles: countTriangles(source, uniqueMeshes),
    meshes: uniqueMeshes.length,
    materials: uniqueMaterials.length,
    normalizedBounds: {
      width: round(size.x * scalar),
      height: round(size.y * scalar),
      depth: round(size.z * scalar),
    },
  };
}

function assertSupportedSource(source) {
  if (source.asset?.version !== "2.0") throw new Error("Only glTF 2.0 sources are supported");
  if ((source.buffers?.length ?? 0) !== 1) throw new Error("Expected one embedded GLB buffer");
  if (source.images?.length || source.textures?.length) {
    throw new Error("This extractor intentionally requires the texture-free Future City source");
  }
  if (source.skins?.length || source.animations?.length) {
    throw new Error("Skinned or animated source nodes are not supported by this extractor");
  }
  if (source.extensionsRequired?.length) {
    throw new Error(`Required glTF extensions are not supported: ${source.extensionsRequired.join(", ")}`);
  }
}

function readGlb(bytes) {
  if (bytes.readUInt32LE(0) !== GLB_MAGIC) throw new Error("Input is not a GLB file");
  if (bytes.readUInt32LE(4) !== 2) throw new Error("Only GLB version 2 is supported");
  let offset = 12;
  let json;
  let binary;
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === JSON_CHUNK) json = JSON.parse(data.toString("utf8").trimEnd());
    if (type === BIN_CHUNK) binary = data;
    offset += 8 + length;
  }
  if (!json || !binary) throw new Error("GLB must contain JSON and BIN chunks");
  return { json, binary };
}

function writeGlb(json, binary) {
  const jsonBytes = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
  const paddedJson = Buffer.concat([jsonBytes, Buffer.alloc(jsonPadding, 0x20)]);
  const binaryPadding = (4 - (binary.length % 4)) % 4;
  const paddedBinary = Buffer.concat([binary, Buffer.alloc(binaryPadding)]);
  const totalLength = 12 + 8 + paddedJson.length + 8 + paddedBinary.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(paddedJson.length, 0);
  jsonHeader.writeUInt32LE(JSON_CHUNK, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(paddedBinary.length, 0);
  binHeader.writeUInt32LE(BIN_CHUNK, 4);
  return Buffer.concat([header, jsonHeader, paddedJson, binHeader, paddedBinary]);
}

function makeParentMap(nodes) {
  const parents = new Map();
  nodes.forEach((node, index) => {
    for (const child of node.children ?? []) {
      if (parents.has(child)) throw new Error(`Node ${child} has more than one parent`);
      parents.set(child, index);
    }
  });
  return parents;
}

function makeWorldMatrices(source, parents) {
  const matrices = [];
  const visit = (index) => {
    if (matrices[index]) return matrices[index];
    const local = nodeMatrix(source.nodes[index]);
    const parent = parents.get(index);
    matrices[index] = parent === undefined ? local : visit(parent).clone().multiply(local);
    return matrices[index];
  };
  source.nodes.forEach((_, index) => visit(index));
  return matrices;
}

function nodeMatrix(node) {
  if (node.matrix) return new THREE.Matrix4().fromArray(node.matrix);
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...(node.translation ?? [0, 0, 0])),
    new THREE.Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
    new THREE.Vector3(...(node.scale ?? [1, 1, 1])),
  );
}

function collectDescendants(nodes, rootIndex) {
  const result = new Set();
  const visit = (index) => {
    if (result.has(index)) return;
    result.add(index);
    for (const child of nodes[index].children ?? []) visit(child);
  };
  visit(rootIndex);
  return result;
}

function measureBounds(source, nodeIndices, worldMatrices) {
  const result = new THREE.Box3();
  const corner = new THREE.Vector3();
  for (const nodeIndex of nodeIndices) {
    const meshIndex = source.nodes[nodeIndex].mesh;
    if (meshIndex === undefined) continue;
    for (const primitive of source.meshes[meshIndex].primitives) {
      const positionIndex = primitive.attributes.POSITION;
      const accessor = source.accessors[positionIndex];
      if (!accessor.min || !accessor.max) throw new Error(`POSITION accessor ${positionIndex} has no bounds`);
      for (const x of [accessor.min[0], accessor.max[0]]) {
        for (const y of [accessor.min[1], accessor.max[1]]) {
          for (const z of [accessor.min[2], accessor.max[2]]) {
            corner.set(x, y, z).applyMatrix4(worldMatrices[nodeIndex]);
            result.expandByPoint(corner);
          }
        }
      }
    }
  }
  return result;
}

function packAccessors(source, binary, indices) {
  const chunks = [];
  const accessors = [];
  const bufferViews = [];
  let offset = 0;
  for (const index of indices) {
    const accessor = source.accessors[index];
    if (accessor.bufferView === undefined || accessor.sparse) {
      throw new Error(`Accessor ${index} must use a non-sparse buffer view`);
    }
    const oldView = source.bufferViews[accessor.bufferView];
    if (oldView.buffer !== 0) throw new Error("Only the embedded GLB buffer is supported");
    const elementSize = componentByteSize(accessor.componentType) * componentCount(accessor.type);
    const stride = oldView.byteStride ?? elementSize;
    if (stride < elementSize) throw new Error(`Accessor ${index} has an invalid byte stride`);
    const start = (oldView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    let data;
    if (stride === elementSize) {
      data = binary.subarray(start, start + accessor.count * elementSize);
    } else {
      data = Buffer.alloc(accessor.count * elementSize);
      for (let item = 0; item < accessor.count; item++) {
        binary.copy(data, item * elementSize, start + item * stride, start + item * stride + elementSize);
      }
    }
    const padding = (4 - (offset % 4)) % 4;
    if (padding) {
      chunks.push(Buffer.alloc(padding));
      offset += padding;
    }
    const nextView = { buffer: 0, byteOffset: offset, byteLength: data.length };
    if (oldView.target !== undefined) nextView.target = oldView.target;
    bufferViews.push(nextView);
    const nextAccessor = structuredClone(accessor);
    nextAccessor.bufferView = bufferViews.length - 1;
    nextAccessor.byteOffset = 0;
    accessors.push(nextAccessor);
    chunks.push(data);
    offset += data.length;
  }
  return { accessors, bufferViews, binary: Buffer.concat(chunks) };
}

function componentByteSize(componentType) {
  if (componentType === 5120 || componentType === 5121) return 1;
  if (componentType === 5122 || componentType === 5123) return 2;
  if (componentType === 5125 || componentType === 5126) return 4;
  throw new Error(`Unsupported accessor component type: ${componentType}`);
}

function componentCount(type) {
  const counts = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
  const count = counts[type];
  if (!count) throw new Error(`Unsupported accessor type: ${type}`);
  return count;
}

function countTriangles(source, meshIndices) {
  let triangles = 0;
  for (const meshIndex of meshIndices) {
    for (const primitive of source.meshes[meshIndex].primitives) {
      const mode = primitive.mode ?? 4;
      const count = primitive.indices === undefined
        ? source.accessors[primitive.attributes.POSITION].count
        : source.accessors[primitive.indices].count;
      if (mode === 4) triangles += Math.floor(count / 3);
      else if (mode === 5 || mode === 6) triangles += Math.max(0, count - 2);
    }
  }
  return triangles;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}
