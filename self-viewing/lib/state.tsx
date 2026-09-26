"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Client-side demo state, persisted to sessionStorage so a refresh doesn't
// lose your place. No auth — production would tie this to a buyer account.

export type Booking = {
  bookingId: string;
  code: string;
  start: string;
  end: string;
  smsPreview: string;
  kind: "first" | "second";
};

export type DemoState = {
  buyerName: string;
  phone: string;
  slot: { start: string; end: string } | null;
  verified: boolean;
  kycRef: string | null;
  booking: Booking | null;
  secondBooking: Booking | null;
  offer: { amount: number; reference: string; financing: string } | null;
};

const initial: DemoState = {
  buyerName: "",
  phone: "",
  slot: null,
  verified: false,
  kycRef: null,
  booking: null,
  secondBooking: null,
  offer: null,
};

const KEY = "self-viewing-demo";

const Ctx = createContext<{
  state: DemoState;
  update: (p: Partial<DemoState>) => void;
  reset: () => void;
  ready: boolean;
} | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) setState({ ...initial, ...JSON.parse(raw) });
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state, ready]);

  return (
    <Ctx.Provider
      value={{
        state,
        ready,
        update: (p) => setState((s) => ({ ...s, ...p })),
        reset: () => setState(initial),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useDemo() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDemo outside DemoProvider");
  return c;
}
