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

  /**
   * The building interior this player is inside, or null/undefined outdoors
   * (Phase 1F).
   *
   * Added as an optional field so it is backward compatible: a client that
   * predates interiors simply omits it and is treated as outdoors, which is
   * exactly where it is. Peers only render each other when this matches, so an
   * interior is a real, separate room rather than a shared overlay.
   */
  interiorId?: string | null;
}

/** A lightweight position update carried over broadcast (high frequency). */
export interface MoveUpdate {
  id: string;
  x: number;
  y: number;
  flipX: boolean;
  /** Which interior the player is in, or null outdoors (Phase 1F). */
  interiorId?: string | null;
}

interface JoinMessage extends RemotePlayerState {
  type: "player_join";
}

interface HeartbeatMessage extends RemotePlayerState {
  type: "heartbeat";
}

interface LeaveMessage {
  type: "player_leave";
  id: string;
}

interface RemoteRecord {
  state: RemotePlayerState;
  lastSeen: number;
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

/** ~12 movement packets/sec. */
const MOVE_INTERVAL_MS = 80;

/** Announce ourselves every 2 seconds so peers stay fresh and late joiners find us quickly. */
const HEARTBEAT_INTERVAL_MS = 2000;

/** Remove a peer if we haven't heard from them for 5 seconds. */
const REMOTE_TIMEOUT_MS = 5000;

/** Check for stale players once per second. */
const CLEANUP_INTERVAL_MS = 1000;

/**
 * Joins the realtime channel for a world.
 *
 * This implementation intentionally uses Supabase Broadcast only.
 *
 * Supabase Presence is currently not relied upon for the roster.
 *
 * Protocol:
 *
 * player_join
 *   Sent when this client joins.
 *
 * heartbeat
 *   Sent every 2 seconds with the player's full current state.
 *   This lets late joiners discover players who were already online and keeps
 *   active players from being treated as stale.
 *
 * move
 *   Sent frequently with lightweight position updates.
 *
 * player_leave
 *   Sent when the page/scene shuts down cleanly.
 */
export function joinWorld(
  worldId: string,
  me: PlayerIdentity,
  getPosition: () => {
    x: number;
    y: number;
    flipX: boolean;
    interiorId?: string | null;
  },
  cb: PresenceCallbacks,
) {
  const playerId = me.id;
  const channelName = `${CHANNEL_PREFIX}${worldId}`;

  const remotes = new Map<string, RemoteRecord>();

  let lastMoveSent = 0;
  let destroyed = false;
  let joined = false;

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let cleanupTimer: ReturnType<typeof setInterval> | null = null;

  const channel: RealtimeChannel = supabase.channel(channelName, {
    config: {
      broadcast: {
        self: false,
      },
    },
  });

  function currentState(): RemotePlayerState {
    const pos = getPosition();

    return {
      ...me,
      id: playerId,
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      flipX: pos.flipX,
      interiorId: pos.interiorId ?? null,
    };
  }

  function updateCount() {
    cb.onCount(remotes.size + 1);
  }

  function registerRemote(state: RemotePlayerState) {
    if (!state || !state.id || state.id === playerId) {
      return;
    }

    const existing = remotes.get(state.id);

    remotes.set(state.id, {
      state,
      lastSeen: Date.now(),
    });

    if (!existing) {
      cb.onJoin(state);
      updateCount();
    }
  }

  function touchRemote(
    id: string,
    update?: Partial<RemotePlayerState>,
  ) {
    if (!id || id === playerId) {
      return;
    }

    const existing = remotes.get(id);

    if (!existing) {
      return;
    }

    if (update) {
      existing.state = {
        ...existing.state,
        ...update,
        id,
      };
    }

    existing.lastSeen = Date.now();
  }

  async function sendJoin() {
    if (destroyed) {
      return;
    }

    const payload: JoinMessage = {
      type: "player_join",
      ...currentState(),
    };

    await channel.send({
      type: "broadcast",
      event: "player_join",
      payload,
    });
  }

  async function sendHeartbeat() {
    if (destroyed) {
      return;
    }

    const payload: HeartbeatMessage = {
      type: "heartbeat",
      ...currentState(),
    };

    await channel.send({
      type: "broadcast",
      event: "heartbeat",
      payload,
    });
  }

  async function sendLeave() {
    const payload: LeaveMessage = {
      type: "player_leave",
      id: playerId,
    };

    try {
      await channel.send({
        type: "broadcast",
        event: "player_leave",
        payload,
      });
    } catch {
      // Best effort only.
    }
  }

  channel
    .on("broadcast", { event: "player_join" }, ({ payload }) => {
      const state = payload as JoinMessage;

      if (!state || state.id === playerId) {
        return;
      }

      registerRemote(state);

      /**
       * If another player joins after us, immediately answer with our current
       * state so they don't have to wait for the next heartbeat.
       */
      void sendHeartbeat();
    })

    .on("broadcast", { event: "heartbeat" }, ({ payload }) => {
      const state = payload as HeartbeatMessage;

      if (!state || state.id === playerId) {
        return;
      }

      const existing = remotes.get(state.id);

      if (!existing) {
        registerRemote(state);
        return;
      }

      touchRemote(state.id, state);
    })

    .on("broadcast", { event: "move" }, ({ payload }) => {
      const move = payload as MoveUpdate;

      if (!move || move.id === playerId) {
        return;
      }

      /**
       * Only forward movement if we already know this remote player.
       *
       * Their join/heartbeat packet carries the full identity needed to create
       * the sprite.
       */
      const existing = remotes.get(move.id);

      if (!existing) {
        return;
      }

      touchRemote(move.id, {
        x: move.x,
        y: move.y,
        flipX: move.flipX,
        interiorId: move.interiorId ?? null,
      });

      cb.onMove(move);
    })

    .on("broadcast", { event: "player_leave" }, ({ payload }) => {
      const leave = payload as LeaveMessage;

      if (!leave || !leave.id || leave.id === playerId) {
        return;
      }

      if (remotes.has(leave.id)) {
        remotes.delete(leave.id);
        cb.onLeave(leave.id);
        updateCount();
      }
    })

    .subscribe(async (status, err) => {
      if (destroyed) {
        return;
      }

      console.log("[itsartc] realtime subscribe status", {
        playerId,
        worldId,
        channelName,
        status,
        error: err ?? null,
      });

      if (status === "SUBSCRIBED") {
        cb.onStatus?.("live");

        if (joined) {
          return;
        }

        joined = true;

        /** Count ourselves immediately. */
        updateCount();

        /** Announce that this player has entered the world. */
        await sendJoin();

        /**
         * Heartbeat every 2 seconds.
         *
         * This keeps peers fresh and lets late joiners discover players who were
         * already online.
         */
        heartbeatTimer = setInterval(() => {
          void sendHeartbeat();
        }, HEARTBEAT_INTERVAL_MS);

        /**
         * Check once per second for peers that have stopped sending data.
         *
         * A remote player is considered gone after 5 seconds without a move,
         * heartbeat, or other state update.
         */
        cleanupTimer = setInterval(() => {
          if (destroyed) {
            return;
          }

          const now = Date.now();
          let changed = false;

          for (const [id, remote] of Array.from(remotes.entries())) {
            if (now - remote.lastSeen > REMOTE_TIMEOUT_MS) {
              remotes.delete(id);
              cb.onLeave(id);
              changed = true;
            }
          }

          if (changed) {
            updateCount();
          }
        }, CLEANUP_INTERVAL_MS);
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
   * Called from the Phaser update loop.
   *
   * Broadcast only lightweight position data here.
   */
  function pushMove(now: number) {
    if (
      destroyed ||
      !joined ||
      now - lastMoveSent < MOVE_INTERVAL_MS
    ) {
      return;
    }

    lastMoveSent = now;

    const pos = getPosition();

    void channel.send({
      type: "broadcast",
      event: "move",
      payload: {
        id: playerId,
        x: Math.round(pos.x),
        y: Math.round(pos.y),
        flipX: pos.flipX,
        interiorId: pos.interiorId ?? null,
      } satisfies MoveUpdate,
    });
  }

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    if (cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }

    /**
     * Best-effort explicit departure.
     *
     * If the browser closes too abruptly for this packet to arrive, the
     * remaining clients will remove this player after roughly 5 seconds.
     */
    void sendLeave().finally(() => {
      supabase.removeChannel(channel);
    });
  }

  return {
    pushMove,
    destroy,
  };
}
