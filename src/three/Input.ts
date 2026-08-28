/**
 * Raw input collection for the 3D world.
 *
 * Deliberately dumb: it reports which direction keys are held and where the
 * user last clicked, in normalised device coordinates. It knows nothing about
 * the camera, the ground plane, or the player — resolving a click into a world
 * position needs the camera, so that belongs to the renderer.
 *
 * Mirrors the input contract the Phaser scene already honours (founding
 * principle: three input methods — WASD, arrow keys, click-to-walk) so the two
 * renderers feel identical to the same hands.
 */

/** Keys that move the player, grouped by the direction they push. */
const KEY_DIRECTIONS: Record<string, { x: number; z: number }> = {
  KeyW: { x: 0, z: -1 },
  ArrowUp: { x: 0, z: -1 },
  KeyS: { x: 0, z: 1 },
  ArrowDown: { x: 0, z: 1 },
  KeyA: { x: -1, z: 0 },
  ArrowLeft: { x: -1, z: 0 },
  KeyD: { x: 1, z: 0 },
  ArrowRight: { x: 1, z: 0 },
};

/** Arrow keys scroll the page by default; the world needs them. */
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

/** A click position in normalised device coordinates (-1..1, y up). */
export interface PointerNdc {
  x: number;
  y: number;
}

export class Input {
  private readonly element: HTMLElement;
  private readonly held = new Set<string>();
  private pendingClick: PointerNdc | null = null;
  private disposed = false;

  constructor(element: HTMLElement) {
    this.element = element;

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    element.addEventListener("pointerdown", this.onPointerDown);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!(e.code in KEY_DIRECTIONS)) return;
    // Don't steal keys from a focused input — the world shares the page with UI.
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (SCROLL_KEYS.has(e.code)) e.preventDefault();
    this.held.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code);
  };

  /** Losing focus mid-keypress would otherwise leave the player walking forever. */
  private onBlur = () => {
    this.held.clear();
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return; // left button only
    const rect = this.element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.pendingClick = {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
    };
  };

  /**
   * Current keyboard direction as a raw (unnormalised) vector in world axes.
   * Opposing keys cancel, which is what a player expects when rolling a finger
   * across two keys.
   */
  moveVector(): { x: number; z: number } {
    let x = 0;
    let z = 0;
    for (const code of this.held) {
      const d = KEY_DIRECTIONS[code];
      if (d) {
        x += d.x;
        z += d.z;
      }
    }
    return { x: Math.sign(x), z: Math.sign(z) };
  }

  /** True while any movement key is held. */
  hasKeyboardInput(): boolean {
    const v = this.moveVector();
    return v.x !== 0 || v.z !== 0;
  }

  /** Takes the last click, if any, and clears it. */
  consumeClick(): PointerNdc | null {
    const c = this.pendingClick;
    this.pendingClick = null;
    return c;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.element.removeEventListener("pointerdown", this.onPointerDown);
    this.held.clear();
  }
}
