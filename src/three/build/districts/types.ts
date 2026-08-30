import type * as THREE from "three";
import type { Building } from "@/world/schema";
import type { GeometryBatcher } from "../GeometryBatcher";
import type { CityMaterials } from "../../materials/CityMaterials";

/**
 * What a district's signature builder is handed.
 *
 * Everything a bespoke building needs, and nothing about the rest of the city.
 * A district module can therefore be written, read and changed on its own — the
 * alternative, which this replaces, was a growing switch inside the city
 * builder and a parameter list that grew by several arrays per district.
 */
export interface SignatureContext {
  /** Batch geometry under a named material. See GeometryBatcher. */
  add(
    batch: string,
    makeMaterial: () => THREE.Material,
    geometry: THREE.BufferGeometry | THREE.BufferGeometry[],
    options?: { owned?: boolean; bloom?: boolean },
  ): void;

  /** Registers a solid the player collides with. */
  solid(box: THREE.Box3): void;

  /** The shared tiling material library, for surfaces that need no bespoke look. */
  materials: CityMaterials;

  /** Textures created here are disposed with the city. */
  ownTexture(texture: THREE.Texture): void;

  /**
   * Adds a standalone object, for the rare element that cannot be batched —
   * anything that has to move independently. Everything static should go
   * through `add` instead, or the draw-call budget goes with it.
   */
  object(object: THREE.Object3D, dispose?: () => void): void;

  /**
   * Registers a per-frame update. This runs on the render path, so it must stay
   * to a handful of arithmetic operations: nudging a texture offset or a
   * rotation, not rebuilding geometry.
   */
  animate(update: (elapsed: number, dt: number) => void): void;

  batcher: GeometryBatcher;
}

/**
 * A district's architectural identity.
 *
 * `build` runs after the standard shell, so a signature normally decorates and
 * extends the base volume rather than replacing it — which keeps the hollow
 * interior, the doorway opening and its collision working unchanged.
 */
export interface DistrictSignature {
  build(building: Building, ctx: SignatureContext): void;
}
