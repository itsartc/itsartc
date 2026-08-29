/**
 * Keyboard input for the player.
 *
 * Arrow keys are the documented controls; WASD is accepted too because anyone
 * who has played a 3D game will reach for it, and supporting it costs nothing.
 */

const DIRECTIONS: Record<string, { x: number; z: number }> = {
  // z is "forward", i.e. away from the camera. The camera looks along
  // +(sin yaw, cos yaw), so forward is positive here and PlayerController
  // rotates this vector by the camera's yaw.
  ArrowUp: { x: 0, z: 1 },
  KeyW: { x: 0, z: 1 },
  ArrowDown: { x: 0, z: -1 },
  KeyS: { x: 0, z: -1 },
  ArrowLeft: { x: -1, z: 0 },
  KeyA: { x: -1, z: 0 },
  ArrowRight: { x: 1, z: 0 },
  KeyD: { x: 1, z: 0 },
};

/** Arrow keys scroll the page by default; the world needs them. */
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

export class Input {
  private readonly held = new Set<string>();
  private disposed = false;

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
    if (SCROLL_KEYS.has(e.code)) e.preventDefault();
    if (e.code in DIRECTIONS || e.code === "ShiftLeft" || e.code === "ShiftRight") {
      this.held.add(e.code);
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code);
  };

  /** Losing focus mid-keypress would otherwise leave the player walking forever. */
  private onBlur = () => this.held.clear();

  /** Movement intent in camera space: x is right, z is forward. */
  vector(): { x: number; z: number } {
    let x = 0;
    let z = 0;
    for (const code of this.held) {
      const d = DIRECTIONS[code];
      if (d) {
        x += d.x;
        z += d.z;
      }
    }
    return { x: Math.sign(x), z: Math.sign(z) };
  }

  get running(): boolean {
    return this.held.has("ShiftLeft") || this.held.has("ShiftRight");
  }

  get active(): boolean {
    const v = this.vector();
    return v.x !== 0 || v.z !== 0;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.held.clear();
  }
}
