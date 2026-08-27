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

  /** Realtime connection lifecycle, for surfacing status in the UI. */
  onStatus?: (status: "connecting" | "live" | "offline") => void;
}

const CHANNEL_PREFIX = "world:";
const MOVE_INTERVAL_MS = 80; // ~12 position updates/sec

/**
 * Joins the realtime channel for a world and bridges Supabase Realtime to the
 * game.
 *
 * One canonical ID is used for the player everywhere:
 *
 *   me.id
 *     ↓
 * Presence key
 *     ↓
 * Presence state id
 *     ↓
 * Broadcast movement id
 *     ↓
 * Remote player id
 *
 * Because guest identities are stored in sessionStorage, each browser tab/window
 * receives a different me.id and therefore appears as a separate multiplayer
 * participant.
 *
 * Two transports are used:
 *
 * - Presence carries identity and join/leave state.
 * - Broadcast carries high-frequency movement updates.
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

  /**
   * The guest identity ID is also the realtime player ID.
   *
   * No separate connection ID is needed because each browser tab/window already
   * receives its own unique identity via sessionStorage.
   */
  const playerId = me.id;

  const channel: RealtimeChannel = supabase.channel(
    `${CHANNEL_PREFIX}${worldId}`,
    {
      config: {
        presence: {
          key: playerId,
        },
        broadcast: {
          self: false,
        },
      },
    },
  );

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<RemotePlayerState>();

      console.log("[itsartc] presence sync", {
        playerId,
        worldId,
        channelName: `${CHANNEL_PREFIX}${worldId}`,
        state,
        keys: Object.keys(state),
      });

      const ids = new Set(Object.keys(state));

      // New peers → join
      for (const id of ids) {
        if (id === playerId || known.has(id)) {
          continue;
        }

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
      const move = payload as MoveUpdate;

      if (move && move.id !== playerId) {
        cb.onMove(move);
      }
    })

    .subscribe(async (status, err) => {
      if (destroyed) {
        return;
      }

      console.log("[itsartc] realtime subscribe status", {
        playerId,
        worldId,
        status,
        error: err ?? null,
      });

      if (status === "SUBSCRIBED") {
        cb.onStatus?.("live");

        const pos = getPosition();

        /**
         * Track the player's complete identity + initial position.
         *
         * me.id is already playerId, so we keep one canonical ID all the way
         * through the realtime layer.
         */
        const trackPayload: RemotePlayerState = {
          ...me,
          id: playerId,
          x: pos.x,
          y: pos.y,
          flipX: pos.flipX,
        };

        console.log("[itsartc] tracking presence", {
          playerId,
          worldId,
          trackPayload,
        });

        const trackResult = await channel.track(trackPayload);

        console.log("[itsartc] track result", {
          playerId,
          worldId,
          trackResult,
        });
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        console.warn(
          "[itsartc] realtime status:",
          status,
          err ?? "",
        );

        cb.onStatus?.("offline");
      }
    });

  cb.onStatus?.("connecting");

  /**
   * Call frequently (e.g. every game frame).
   * Movement broadcasts are throttled internally.
   */
  function pushMove(now: number) {
    if (
      destroyed ||
      now - lastSent < MOVE_INTERVAL_MS
    ) {
      return;
    }

    lastSent = now;

    const pos = getPosition();

    channel.send({
      type: "broadcast",
      event: "move",
      payload: {
        id: playerId,
        x: Math.round(pos.x),
        y: Math.round(pos.y),
        flipX: pos.flipX,
      },
    });
  }

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;
    supabase.removeChannel(channel);
  }

  return {
    pushMove,
    destroy,
  };
}
