"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { answerQuestion } from "@/lib/services/voiceAgent";

export type Msg = { id: number; from: "agent" | "buyer" | "system"; text: string };

// Conversation state for the mocked AI agent. Replies are "spoken" with the
// browser's speechSynthesis (when not muted) so the call feels live.
// Production: this whole hook is replaced by a real-time voice session.
export function useAgent(roomIdRef: React.MutableRefObject<string | null>) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const idRef = useRef(0);
  const speakTimer = useRef<ReturnType<typeof setTimeout>>();

  const push = useCallback((from: Msg["from"], text: string) => {
    setMessages((m) => [...m, { id: ++idRef.current, from, text }]);
  }, []);

  // Utterances queue (speechSynthesis queues natively); each transcript line
  // appears as it starts being spoken. `interrupt` drops anything queued.
  const pending = useRef(0);
  const say = useCallback(
    (text: string, opts: { interrupt?: boolean } = {}) => {
      const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
      clearTimeout(speakTimer.current);
      if (!synth || mutedRef.current) {
        push("agent", text);
        setSpeaking(true);
        speakTimer.current = setTimeout(() => setSpeaking(false), Math.min(8000, 1000 + text.length * 40));
        return;
      }
      if (opts.interrupt) {
        synth.cancel();
        pending.current = 0;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      let shown = false;
      const show = () => {
        if (shown) return;
        shown = true;
        push("agent", text);
        setSpeaking(true);
      };
      const done = () => {
        show();
        pending.current = Math.max(0, pending.current - 1);
        if (pending.current === 0) setSpeaking(false);
      };
      u.onstart = show;
      u.onend = done;
      u.onerror = done;
      const queued = pending.current > 0;
      pending.current += 1;
      synth.speak(u);
      // Safety net: some browsers never fire onstart/onend (or have no voices).
      setTimeout(show, queued ? 20000 : 1500);
      speakTimer.current = setTimeout(() => {
        pending.current = 0;
        setSpeaking(false);
      }, 15000);
    },
    [push],
  );

  const ask = useCallback(
    async (q: string) => {
      const text = q.trim();
      if (!text) return;
      push("buyer", text);
      setThinking(true);
      window.speechSynthesis?.cancel();
      pending.current = 0;
      // Small, variable latency so it feels like a live agent.
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
      const a = await answerQuestion(text, roomIdRef.current);
      setThinking(false);
      say(a, { interrupt: true });
    },
    [push, say, roomIdRef],
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (!m) window.speechSynthesis?.cancel();
      return !m;
    });
  }, []);

  useEffect(
    () => () => {
      clearTimeout(speakTimer.current);
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    },
    [],
  );

  return { messages, push, say, ask, speaking, thinking, muted, toggleMute };
}

// Optional browser speech-to-text so the buyer can literally talk to the agent
// (Chrome/Safari). Falls back to typing where unsupported.
export function useDictation(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  }, []);

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    window.speechSynthesis?.cancel();
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => onResult(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }, [onResult]);

  const stop = useCallback(() => recRef.current?.stop(), []);
  return { supported, listening, start, stop };
}
