import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./client";
import { ICE_SERVERS } from "./config";

/**
 * Proximity voice over WebRTC.
 *
 * Audio is peer-to-peer (one RTCPeerConnection per remote player). Signalling
 * (SDP offers/answers + ICE candidates) rides on a dedicated Supabase Broadcast
 * channel — `voice:<worldId>` — kept separate from the movement channel so the
 * working presence protocol is untouched.
 *
 * Each remote peer's audio plays through its own <audio> element whose volume
 * the game sets every frame from the players' distance, so voices fade in as
 * you approach and out as you leave — no "join call" button, matching the
 * conversation-range bubble.
 *
 * Connections are established eagerly with every player in the world (a small
 * mesh) so audio is instant once someone enables their mic; distance only
 * gates what you hear. For large crowds this should become proximity-gated or
 * move to an SFU — a later scaling concern.
 */

const CHANNEL_PREFIX = "voice:";

/** WebRTC signalling message, relayed peer→peer over Supabase Broadcast. */
interface SignalMessage {
  from: string;
  to: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

interface Peer {
  pc: RTCPeerConnection;
  audioEl: HTMLAudioElement;
  transceiver: RTCRtpTransceiver;

  /** Perfect-negotiation bookkeeping. */
  makingOffer: boolean;
  ignoreOffer: boolean;

  /** The lower-id side is "impolite"; the higher-id side yields on collision. */
  polite: boolean;

  /** Target volume (0–1); applied to the audio element. */
  volume: number;

  /** Whether the WebRTC transport is currently connected. */
  linked: boolean;
}

export interface VoiceCallbacks {
  onStatus?: (s: {
    micEnabled: boolean;
    micDenied: boolean;
    supported: boolean;
  }) => void;

  /** Number of peers with a live audio transport (independent of distance). */
  onLinks?: (count: number) => void;
}

function isSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof RTCPeerConnection !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export function createVoice(
  worldId: string,
  myId: string,
  cb: VoiceCallbacks = {},
) {
  const supported = isSupported();
  const peers = new Map<string, Peer>();

  let micStream: MediaStream | null = null;
  let micEnabled = false;
  let micDenied = false;
  let destroyed = false;

  /**
   * Some browsers block audio playback until a user gesture.
   * Retry pending audio elements after the user interacts with the page.
   */
  const pendingPlay = new Set<HTMLAudioElement>();

  function tryPlay(el: HTMLAudioElement) {
    el.play()
      .then(() => {
        pendingPlay.delete(el);

        console.log("[itsartc] remote audio playing", {
          volume: el.volume,
          muted: el.muted,
          paused: el.paused,
        });
      })
      .catch((error) => {
        pendingPlay.add(el);

        console.warn("[itsartc] remote audio play blocked", {
          error,
          volume: el.volume,
          muted: el.muted,
          paused: el.paused,
        });
      });
  }

  function flushPending() {
    for (const el of Array.from(pendingPlay)) {
      el.play()
        .then(() => {
          pendingPlay.delete(el);

          console.log("[itsartc] pending remote audio unlocked", {
            volume: el.volume,
            muted: el.muted,
            paused: el.paused,
          });
        })
        .catch((error) => {
          console.warn("[itsartc] pending remote audio still blocked", {
            error,
          });
        });
    }
  }

  if (supported) {
    window.addEventListener("pointerdown", flushPending);
    window.addEventListener("keydown", flushPending);
  }

  const channel: RealtimeChannel | null = supported
    ? supabase.channel(`${CHANNEL_PREFIX}${worldId}`, {
        config: {
          broadcast: {
            self: false,
          },
        },
      })
    : null;

  function emitStatus() {
    cb.onStatus?.({
      micEnabled,
      micDenied,
      supported,
    });
  }

  function emitLinks() {
    let n = 0;

    for (const peer of peers.values()) {
      if (peer.linked) {
        n += 1;
      }
    }

    cb.onLinks?.(n);
  }

  function signal(msg: Omit<SignalMessage, "from">) {
    if (!channel) {
      return;
    }

    void channel.send({
      type: "broadcast",
      event: "signal",
      payload: {
        from: myId,
        ...msg,
      } satisfies SignalMessage,
    });
  }

  function createPeer(peerId: string): Peer {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });

    const audioEl = new Audio();

    audioEl.autoplay = true;
    audioEl.muted = false;
    audioEl.volume = 0;

    (
      audioEl as HTMLAudioElement & {
        playsInline?: boolean;
      }
    ).playsInline = true;

    /**
     * iOS Safari is more reliable when the remote audio element is attached
     * to the DOM rather than remaining completely detached.
     */
    audioEl.style.display = "none";

    if (typeof document !== "undefined") {
      document.body.appendChild(audioEl);
    }

    /**
     * One audio transceiver per peer.
     *
     * It begins as receive-only and becomes send+receive once this local player
     * enables their microphone.
     */
    const transceiver = pc.addTransceiver("audio", {
      direction: "recvonly",
    });

    /**
     * If the microphone was already enabled before this peer was discovered,
     * immediately attach the existing microphone track.
     */
    if (micStream) {
      const track = micStream.getAudioTracks()[0];

      if (track) {
        console.log("[itsartc] attaching existing mic track to new peer", {
          peerId,
          trackId: track.id,
          kind: track.kind,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        });

        void transceiver.sender.replaceTrack(track);
        transceiver.direction = "sendrecv";
      }
    }

    const peer: Peer = {
      pc,
      audioEl,
      transceiver,
      makingOffer: false,
      ignoreOffer: false,
      polite: myId > peerId,
      volume: 0,
      linked: false,
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      const linked = state === "connected";

      if (linked !== peer.linked) {
        peer.linked = linked;
        emitLinks();
      }

      if (state === "failed") {
        console.warn("[itsartc] voice connection failed for peer", peerId);
      }

      console.log("[itsartc] voice connectionState", {
        peerId,
        state,
      });
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[itsartc] voice iceConnectionState", {
        peerId,
        state: pc.iceConnectionState,
      });
    };

    pc.onsignalingstatechange = () => {
      console.log("[itsartc] voice signalingState", {
        peerId,
        state: pc.signalingState,
      });
    };

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;

        await pc.setLocalDescription();

        console.log("[itsartc] voice sending local description", {
          peerId,
          type: pc.localDescription?.type,
        });

        signal({
          to: peerId,
          description: pc.localDescription ?? undefined,
        });
      } catch (error) {
        console.warn("[itsartc] voice negotiationneeded failed", {
          peerId,
          error,
        });
      } finally {
        peer.makingOffer = false;
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) {
        return;
      }

      signal({
        to: peerId,
        candidate: candidate.toJSON(),
      });
    };

    /**
     * Critical remote-audio handler.
     *
     * Some WebRTC flows deliver a valid remote audio track while
     * `event.streams` is empty.
     *
     * The previous implementation only played `streams[0]`, which meant a
     * perfectly valid remote track could arrive but never be attached to the
     * audio element.
     *
     * We now fall back to creating a MediaStream directly from event.track.
     */
    pc.ontrack = (event) => {
      console.log("[itsartc] voice remote track", {
        peerId,
        kind: event.track.kind,
        trackId: event.track.id,
        enabled: event.track.enabled,
        muted: event.track.muted,
        readyState: event.track.readyState,
        streamCount: event.streams.length,
      });

      const remoteStream =
        event.streams[0] ?? new MediaStream([event.track]);

      console.log("[itsartc] attaching remote stream to audio element", {
        peerId,
        trackCount: remoteStream.getTracks().length,
        audioTrackCount: remoteStream.getAudioTracks().length,
      });

      audioEl.srcObject = remoteStream;

      event.track.onmute = () => {
        console.log("[itsartc] remote audio track muted", {
          peerId,
          trackId: event.track.id,
        });
      };

      event.track.onunmute = () => {
        console.log("[itsartc] remote audio track unmuted", {
          peerId,
          trackId: event.track.id,
        });

        tryPlay(audioEl);
      };

      event.track.onended = () => {
        console.log("[itsartc] remote audio track ended", {
          peerId,
          trackId: event.track.id,
        });
      };

      tryPlay(audioEl);
    };

    peers.set(peerId, peer);

    return peer;
  }

  async function handleSignal(msg: SignalMessage) {
    if (msg.to !== myId || msg.from === myId) {
      return;
    }

    const peerId = msg.from;
    const peer = peers.get(peerId) ?? createPeer(peerId);
    const { pc } = peer;

    try {
      if (msg.description) {
        const offerCollision =
          msg.description.type === "offer" &&
          (peer.makingOffer || pc.signalingState !== "stable");

        peer.ignoreOffer = !peer.polite && offerCollision;

        if (peer.ignoreOffer) {
          console.log("[itsartc] voice ignoring collided offer", {
            peerId,
          });

          return;
        }

        console.log("[itsartc] voice applying remote description", {
          peerId,
          type: msg.description.type,
        });

        await pc.setRemoteDescription(msg.description);

        if (msg.description.type === "offer") {
          await pc.setLocalDescription();

          console.log("[itsartc] voice sending answer", {
            peerId,
            type: pc.localDescription?.type,
          });

          signal({
            to: peerId,
            description: pc.localDescription ?? undefined,
          });
        }
      } else if (msg.candidate) {
        try {
          await pc.addIceCandidate(msg.candidate);
        } catch (error) {
          if (!peer.ignoreOffer) {
            console.warn("[itsartc] voice addIceCandidate failed", {
              peerId,
              error,
            });

            throw error;
          }
        }
      }
    } catch (error) {
      console.warn("[itsartc] voice signal handling error", {
        peerId,
        error,
      });
    }
  }

  channel
    ?.on("broadcast", { event: "signal" }, ({ payload }) => {
      void handleSignal(payload as SignalMessage);
    })
    .subscribe((status, error) => {
      console.log("[itsartc] voice signaling channel status", {
        worldId,
        myId,
        status,
        error: error ?? null,
      });
    });

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Begin a connection to a newly-seen player. Idempotent. */
  function addPeer(peerId: string) {
    if (
      !supported ||
      destroyed ||
      peerId === myId ||
      peers.has(peerId)
    ) {
      return;
    }

    /**
     * Creating the recvonly transceiver triggers negotiationneeded.
     * Perfect negotiation handles later renegotiations such as microphone
     * enable/disable.
     */
    createPeer(peerId);
  }

  /** Tear down the connection to a player who left. */
  function removePeer(peerId: string) {
    const peer = peers.get(peerId);

    if (!peer) {
      return;
    }

    peer.pc.onnegotiationneeded = null;
    peer.pc.onicecandidate = null;
    peer.pc.ontrack = null;
    peer.pc.onconnectionstatechange = null;
    peer.pc.oniceconnectionstatechange = null;
    peer.pc.onsignalingstatechange = null;

    peer.pc.close();

    peer.audioEl.pause();
    peer.audioEl.srcObject = null;
    peer.audioEl.remove();

    pendingPlay.delete(peer.audioEl);
    peers.delete(peerId);

    emitLinks();
  }

  /**
   * Distance-driven volume for one remote peer.
   *
   * 0 = inaudible
   * 1 = full volume
   */
  function setPeerVolume(peerId: string, volume: number) {
    const peer = peers.get(peerId);

    if (!peer) {
      return;
    }

    const v = Math.max(0, Math.min(1, volume));

    peer.volume = v;

    if (peer.audioEl.volume !== v) {
      peer.audioEl.volume = v;
    }
  }

  async function enableMic(): Promise<boolean> {
    if (!supported || destroyed) {
      return false;
    }

    if (micEnabled) {
      return true;
    }

    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch (error) {
      console.error("[itsartc] microphone capture failed", {
        error,
      });

      micDenied = true;
      emitStatus();

      return false;
    }

    micEnabled = true;
    micDenied = false;

    const track = micStream.getAudioTracks()[0];

    if (!track) {
      console.error("[itsartc] microphone stream has no audio track");

      micEnabled = false;
      micDenied = true;

      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;

      emitStatus();

      return false;
    }

    console.log("[itsartc] local microphone track acquired", {
      trackId: track.id,
      kind: track.kind,
      label: track.label,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
      settings: track.getSettings(),
    });

    track.onmute = () => {
      console.log("[itsartc] local microphone track muted", {
        trackId: track.id,
      });
    };

    track.onunmute = () => {
      console.log("[itsartc] local microphone track unmuted", {
        trackId: track.id,
      });
    };

    track.onended = () => {
      console.log("[itsartc] local microphone track ended", {
        trackId: track.id,
      });
    };

    /**
     * Push the microphone track into every existing peer.
     *
     * Changing the transceiver from recvonly → sendrecv triggers WebRTC
     * renegotiation where required.
     */
    for (const [peerId, peer] of peers.entries()) {
      console.log("[itsartc] sending local microphone track to peer", {
        peerId,
        trackId: track.id,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      });

      await peer.transceiver.sender.replaceTrack(track);
      peer.transceiver.direction = "sendrecv";
    }

    /**
     * The mic button itself is a user gesture, so retry any remote audio that
     * the browser previously refused to autoplay.
     */
    flushPending();

    emitStatus();

    return true;
  }

  function disableMic() {
    if (!micEnabled) {
      return;
    }

    micEnabled = false;

    for (const [peerId, peer] of peers.entries()) {
      console.log("[itsartc] removing local microphone track from peer", {
        peerId,
      });

      void peer.transceiver.sender.replaceTrack(null);
      peer.transceiver.direction = "recvonly";
    }

    micStream?.getTracks().forEach((track) => {
      track.stop();
    });

    micStream = null;

    emitStatus();
  }

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    if (supported) {
      window.removeEventListener("pointerdown", flushPending);
      window.removeEventListener("keydown", flushPending);
    }

    for (const id of Array.from(peers.keys())) {
      removePeer(id);
    }

    micStream?.getTracks().forEach((track) => {
      track.stop();
    });

    micStream = null;

    if (channel) {
      supabase.removeChannel(channel);
    }
  }

  emitStatus();
  emitLinks();

  return {
    addPeer,
    removePeer,
    setPeerVolume,
    enableMic,
    disableMic,
    destroy,
    supported,
  };
}

export type VoiceManager = ReturnType<typeof createVoice>;
