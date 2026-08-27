import type { PersonSeed } from "@/world/schema";

/** A person the player is currently near, with live distance in tiles. */
export interface NearPerson {
  person: PersonSeed;
  distanceTiles: number;
}

/** Events the Phaser world emits for the React UI to render. */
export interface WorldEvents {
  /** Player clicked an avatar — open their profile card. */
  "person:selected": PersonSeed;
  /** The set of people within conversation range changed. */
  "proximity:update": NearPerson[];
  /** Player stepped onto an enterable building's entrance. */
  "building:enter": { id: string; name: string; interiorId?: string };
  /** Player's current district changed (for the location HUD). */
  "district:change": { id: string; name: string } | null;
  /** The world scene finished booting. */
  "world:ready": { name: string };
  /** Number of live players currently in the world (including you). */
  "presence:count": number;
  /** Realtime connection status, for the HUD. */
  "net:status": "connecting" | "live" | "offline";
  /** UI → world: the player asked to turn their mic on. */
  "voice:enable": void;
  /** UI → world: the player asked to turn their mic off. */
  "voice:disable": void;
  /** World → UI: current voice/mic state. */
  "voice:status": { micEnabled: boolean; micDenied: boolean; supported: boolean };
  /** World → UI: how many nearby peers you can currently hear. */
  "voice:audible": number;
  /** World → UI: how many peers have a live audio transport (independent of distance). */
  "voice:links": number;
}

type Handler<T> = (payload: T) => void;

/**
 * Minimal typed pub/sub. A single shared instance bridges the imperative
 * Phaser world and the declarative React overlay without coupling them.
 */
class Bus {
  // Internally untyped by key; the public methods enforce the mapping.
  private handlers = new Map<keyof WorldEvents, Set<Handler<unknown>>>();

  on<K extends keyof WorldEvents>(event: K, handler: Handler<WorldEvents[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<unknown>);
    return () => this.off(event, handler);
  }

  off<K extends keyof WorldEvents>(event: K, handler: Handler<WorldEvents[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<unknown>);
  }

  emit<K extends keyof WorldEvents>(event: K, payload: WorldEvents[K]): void {
    this.handlers.get(event)?.forEach((h) => (h as Handler<WorldEvents[K]>)(payload));
  }
}

/**
 * The world scene loads in a lazily-imported chunk while the React overlay
 * lives in the main chunk. To guarantee both sides share the *same* instance
 * (rather than one copy per webpack chunk), the singleton is pinned to
 * globalThis.
 */
const globalScope = globalThis as unknown as { __itsartcBus?: Bus };
export const bus: Bus = globalScope.__itsartcBus ?? (globalScope.__itsartcBus = new Bus());
