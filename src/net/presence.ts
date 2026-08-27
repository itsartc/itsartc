import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./client";
import type { PlayerIdentity } from "./identity";

/** A remote player's full live state: their identity plus current position. */
export interface RemotePlayerState extends PlayerIdentity {
  /** World-space pixel position. */
  x: number;
  y: number;
  /** Facing left (sprite flipped). */
  flipX: boolean;
}

/** A lightweight position update carried over broadcast (high frequency). */
export interface MoveUpdate {
  id: string;
  x: number;
  y: number;
  flipX: boolean;
}

export interface PresenceCallbacks {
  /** A peer appeared (or re-synced) with their identity + initial position. */
  onJoin: (state: RemotePlayerState) => void;
  /** A peer moved. */
  onMove: (update: MoveUpdate) => void;
  /** A peer left. */
  onLeave: (id: string) => void;
  /** Total players online (including self) changed. */
  onCount: (count: number) => void;
}

const CHANNEL_PREFIX = "world:";
const MOVE_INTERVAL_MS = 80; // ~12 position updates/sec

/**
 * Joins the realtime channel for a world and bridges Supabase Realtime to the
 * game.
 *
 * Two transports, each for what it's best at:
 *  - **Presence** carries identity and join/leave — the durable roster. On
 *    every `sync` we diff the roster so late joiners and reconnects are handled
 *    without relying on individual join/leave packets.
 *  - **Broadcast** carries the fast stream of position updates, throttled so we
 *    never exceed the client's events-per-second budget.
 */
export function joinWorld(
  worldId: string,
  me: PlayerIdentity,
  getPosition: () => { x: number; y: number; flipX: boolean },
  cb: PresenceCallbacks,
) {
  const known = new Set<string>();
  let lastSent = 0;
  let destroyed = false;

  // A per-connection id, distinct from the persistent persona id. Two tabs of
  // the same browser share one persona (localStorage) but each get their own
  // connection, so they appear as two live participants and see each other
  // move. This is also the roster key and the self-filter key.
  const connId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `conn-${Math.random().toString(36).slice(2)}-${Date.now()}`;

  const channel: RealtimeChannel = supabase.channel(`${CHANNEL_PREFIX}${worldId}`, {
    config: { presence: { key: connId }, broadcast: { self: false } },
  });

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<RemotePlayerState>();
      const ids = new Set(Object.keys(state));

      // New peers → join
      for (const id of ids) {
        if (id === connId || known.has(id)) continue;
        const meta = state[id]?.[0];
        if (meta) {
          known.add(id);
          cb.onJoin(meta);
        }
      }
      // Departed peers → leave
      for (const id of Array.from(known)) {
        if (!ids.has(id)) {
          known.delete(id);
          cb.onLeave(id);
        }
      }
      cb.onCount(ids.size);
    })
    .on("broadcast", { event: "move" }, ({ payload }) => {
      const m = payload as MoveUpdate;
      if (m && m.id !== connId) cb.onMove(m);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED" && !destroyed) {
        const pos = getPosition();
        // The roster keys players by connId, so the wire `id` is the connId.
        await channel.track({ ...me, id: connId, x: pos.x, y: pos.y, flipX: pos.flipX });
      }
    });

  /** Call frequently (e.g. every frame); it self-throttles. */
  function pushMove(now: number) {
    if (destroyed || now - lastSent < MOVE_INTERVAL_MS) return;
    lastSent = now;
    const pos = getPosition();
    channel.send({
      type: "broadcast",
      event: "move",
      payload: { id: connId, x: Math.round(pos.x), y: Math.round(pos.y), flipX: pos.flipX },
    });
  }

  function destroy() {
    destroyed = true;
    supabase.removeChannel(channel);
  }

  return { pushMove, destroy };
}
