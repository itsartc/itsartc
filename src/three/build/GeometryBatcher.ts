import * as THREE from "three";
import { mergeGeometries } from "./geometry";
import { BLOOM_LAYER } from "../postprocessing/SelectiveBloom";

/**
 * Collects geometry into per-material batches and merges each into one mesh.
 *
 * The city draws hundreds of separate volumes, and one mesh per volume would
 * cost hundreds of draw calls. Batching by material keeps the whole city near
 * thirty regardless of how many buildings, fins or signs are added.
 *
 * It also replaces what used to be a hand-maintained list of geometry arrays
 * threaded through every builder as parameters. A caller now names a batch and
 * supplies the material lazily; the batcher does the bookkeeping and owns
 * disposal of anything it created.
 */
export class GeometryBatcher {
  private readonly batches = new Map<
    string,
    { material: THREE.Material; parts: THREE.BufferGeometry[]; owned: boolean; bloom: boolean }
  >();

  /**
   * Adds geometry to the named batch, creating the material on first use.
   *
   * `owned` marks materials the batcher must dispose — materials from the
   * shared library are cached and reused, so they are not owned. `bloom` puts
   * the resulting mesh on the bloom layer, which is what makes it glow.
   */
  add(
    batch: string,
    makeMaterial: () => THREE.Material,
    geometry: THREE.BufferGeometry | THREE.BufferGeometry[],
    options: { owned?: boolean; bloom?: boolean } = {},
  ) {
    let entry = this.batches.get(batch);
    if (!entry) {
      entry = {
        material: makeMaterial(),
        parts: [],
        owned: options.owned ?? true,
        bloom: options.bloom ?? false,
      };
      this.batches.set(batch, entry);
    }
    if (Array.isArray(geometry)) entry.parts.push(...geometry);
    else entry.parts.push(geometry);
  }

  /** Merges every batch into the group, one mesh per material. */
  flush(group: THREE.Group, geometries: THREE.BufferGeometry[]) {
    for (const [name, entry] of this.batches) {
      if (entry.parts.length === 0) continue;
      const merged = mergeGeometries(entry.parts);
      entry.parts.forEach((p) => p.dispose());
      entry.parts.length = 0;
      geometries.push(merged);
      const mesh = new THREE.Mesh(merged, entry.material);
      mesh.name = name;
      // Only meshes on this layer reach the bloom pass.
      if (entry.bloom) mesh.layers.enable(BLOOM_LAYER);
      group.add(mesh);
    }
  }

  dispose() {
    for (const entry of this.batches.values()) {
      entry.parts.forEach((p) => p.dispose());
      if (entry.owned) entry.material.dispose();
    }
    this.batches.clear();
  }
}
