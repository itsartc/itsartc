import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./client";

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
 * gates what *you* hear. For large crowds this should become proximity-gated or
 * move to an SFU — a later scaling concern.
 */

const CHANNEL_PREFIX = "voice:";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

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
}

export interface VoiceCallbacks {
  onStatus?: (s: { micEnabled: boolean; micDenied: boolean; supported: boolean }) => void;
}

function isSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof RTCPeerConnection !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export function createVoice(worldId: string, myId: string, cb: VoiceCallbacks = {}) {
  const supported = isSupported();
  const peers = new Map<string, Peer>();

  let micStream: MediaStream | null = null;
  let micEnabled = false;
  let micDenied = false;
  let destroyed = false;

  // Some browsers block audio playback until a user gesture; retry pending
  // elements once the user interacts with the page.
  const pendingPlay = new Set<HTMLAudioElement>();
  function tryPlay(el: HTMLAudioElement) {
    el.play().catch(() => {
      pendingPlay.add(el);
    });
  }
  function flushPending() {
    for (const el of Array.from(pendingPlay)) {
      el.play().then(() => pendingPlay.delete(el)).catch(() => {});
    }
  }
  if (supported) {
    window.addEventListener("pointerdown", flushPending);
    window.addEventListener("keydown", flushPending);
  }

  const channel: RealtimeChannel | null = supported
    ? supabase.channel(`${CHANNEL_PREFIX}${worldId}`, { config: { broadcast: { self: false } } })
    : null;

  function emitStatus() {
    cb.onStatus?.({ micEnabled, micDenied, supported });
  }

  function signal(msg: Omit<SignalMessage, "from">) {
    if (!channel) return;
    void channel.send({
      type: "broadcast",
      event: "signal",
      payload: { from: myId, ...msg } satisfies SignalMessage,
    });
  }

  function createPeer(peerId: string): Peer {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const audioEl = new Audio();
    audioEl.autoplay = true;
    (audioEl as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
    audioEl.volume = 0;

    // One audio transceiver per peer; starts receive-only and flips to
    // send+receive when this client enables its mic.
    const transceiver = pc.addTransceiver("audio", { direction: "recvonly" });
    if (micStream) {
      const track = micStream.getAudioTracks()[0];
      if (track) {
        void transceiver.sender.replaceTrack(track);
        transceiver.direction = "sendrecv";
      }
    }

    const peer: Peer = {
      pc, audioEl, transceiver,
      makingOffer: false, ignoreOffer: false,
      polite: myId > peerId, // deterministic, opposite on the two ends
      volume: 0,
    };

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        signal({ to: peerId, description: pc.localDescription ?? undefined });
      } catch {
        /* renegotiation races are recovered by perfect negotiation */
      } finally {
        peer.makingOffer = false;
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) signal({ to: peerId, candidate: candidate.toJSON() });
    };

    pc.ontrack = ({ streams }) => {
      if (streams[0]) {
        audioEl.srcObject = streams[0];
        tryPlay(audioEl);
      }
    };

    peers.set(peerId, peer);
    return peer;
  }

  async function handleSignal(msg: SignalMessage) {
    if (msg.to !== myId || msg.from === myId) return;
    const peerId = msg.from;
    const peer = peers.get(peerId) ?? createPeer(peerId);
    const { pc } = peer;

    try {
      if (msg.description) {
        const offerCollision =
          msg.description.type === "offer" &&
          (peer.makingOffer || pc.signalingState !== "stable");
        peer.ignoreOffer = !peer.polite && offerCollision;
        if (peer.ignoreOffer) return;

        await pc.setRemoteDescription(msg.description);
        if (msg.description.type === "offer") {
          await pc.setLocalDescription();
          signal({ to: peerId, description: pc.localDescription ?? undefined });
        }
      } else if (msg.candidate) {
        try {
          await pc.addIceCandidate(msg.candidate);
        } catch {
          if (!peer.ignoreOffer) throw new Error("addIceCandidate failed");
        }
      }
    } catch {
      /* swallow — a failed peer will be retried on next heartbeat-driven addPeer */
    }
  }

  channel
    ?.on("broadcast", { event: "signal" }, ({ payload }) => {
      void handleSignal(payload as SignalMessage);
    })
    .subscribe();

  // --- Public API ----------------------------------------------------------

  /** Begin a connection to a newly-seen player (idempotent). */
  function addPeer(peerId: string) {
    if (!supported || destroyed || peerId === myId || peers.has(peerId)) return;
    // Only the impolite (lower-id) side kicks off the initial offer, to avoid a
    // needless offer collision; the other side answers. Either can renegotiate
    // later (e.g. when enabling mic) and perfect negotiation sorts out glare.
    const peer = createPeer(peerId);
    if (!peer.polite) {
      // recvonly transceiver already triggers negotiationneeded; nothing else needed.
    }
  }

  /** Tear down the connection to a player who left. */
  function removePeer(peerId: string) {
    const peer = peers.get(peerId);
    if (!peer) return;
    peer.pc.onnegotiationneeded = null;
    peer.pc.onicecandidate = null;
    peer.pc.ontrack = null;
    peer.pc.close();
    peer.audioEl.srcObject = null;
    pendingPlay.delete(peer.audioEl);
    peers.delete(peerId);
  }

  /** Distance-driven volume (0–1) for one peer, applied to its audio element. */
  function setPeerVolume(peerId: string, volume: number) {
    const peer = peers.get(peerId);
    if (!peer) return;
    const v = Math.max(0, Math.min(1, volume));
    peer.volume = v;
    if (peer.audioEl.volume !== v) peer.audioEl.volume = v;
  }

  async function enableMic(): Promise<boolean> {
    if (!supported || destroyed) return false;
    if (micEnabled) return true;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
    } catch {
      micDenied = true;
      emitStatus();
      return false;
    }
    micEnabled = true;
    micDenied = false;
    const track = micStream.getAudioTracks()[0];
    // Push the mic into every existing peer; triggers renegotiation per peer.
    for (const peer of peers.values()) {
      await peer.transceiver.sender.replaceTrack(track);
      peer.transceiver.direction = "sendrecv";
    }
    flushPending();
    emitStatus();
    return true;
  }

  function disableMic() {
    if (!micEnabled) return;
    micEnabled = false;
    for (const peer of peers.values()) {
      void peer.transceiver.sender.replaceTrack(null);
      peer.transceiver.direction = "recvonly";
    }
    micStream?.getTracks().forEach((t) => t.stop());
    micStream = null;
    emitStatus();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (supported) {
      window.removeEventListener("pointerdown", flushPending);
      window.removeEventListener("keydown", flushPending);
    }
    for (const id of Array.from(peers.keys())) removePeer(id);
    micStream?.getTracks().forEach((t) => t.stop());
    micStream = null;
    if (channel) supabase.removeChannel(channel);
  }

  emitStatus();

  return { addPeer, removePeer, setPeerVolume, enableMic, disableMic, destroy, supported };
}

export type VoiceManager = ReturnType<typeof createVoice>;
