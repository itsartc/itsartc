import { supabase } from "@/net/client";

/**
 * Lightweight client observability (Phase 0).
 *
 * Dependency-free error monitoring + structured logging for the browser:
 *  - installs global `error` / `unhandledrejection` handlers,
 *  - exposes `captureError` and `logEvent` for deliberate reporting,
 *  - de-dupes and rate-limits so a render loop can't spam,
 *  - always logs to the console (tagged), and makes a *best-effort* insert into
 *    a Supabase `client_errors` table — any failure (missing table, offline,
 *    RLS) is swallowed so monitoring can never break the app.
 *
 * This is the foundation a hosted monitor (Sentry etc.) can later replace or
 * augment without changing call sites.
 */

type Level = "error" | "warn" | "info";

interface Payload {
  level: Level;
  message: string;
  stack?: string;
  url?: string;
  user_agent?: string;
  context?: Record<string, unknown>;
}

const TAG = "[itsartc]";
const RECENT_WINDOW_MS = 10_000;
const MAX_PER_WINDOW = 20;

let installed = false;
const recentKeys = new Map<string, number>();
let windowStart = 0;
let windowCount = 0;

function throttled(key: string): boolean {
  const now = Date.now();
  // Per-window global cap.
  if (now - windowStart > RECENT_WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  if (windowCount >= MAX_PER_WINDOW) return true;
  // Per-key de-dupe.
  const last = recentKeys.get(key);
  if (last && now - last < RECENT_WINDOW_MS) return true;
  recentKeys.set(key, now);
  windowCount += 1;
  // Occasional cleanup.
  if (recentKeys.size > 200) {
    for (const [k, t] of recentKeys) if (now - t > RECENT_WINDOW_MS) recentKeys.delete(k);
  }
  return false;
}

async function persist(p: Payload): Promise<void> {
  try {
    await supabase.from("client_errors").insert({
      level: p.level,
      message: p.message.slice(0, 2000),
      stack: p.stack?.slice(0, 8000) ?? null,
      url: p.url ?? null,
      user_agent: p.user_agent ?? null,
      context: p.context ?? null,
    });
  } catch {
    /* best-effort only — never let monitoring throw */
  }
}

function report(p: Payload): void {
  const key = `${p.level}:${p.message}`;
  if (throttled(key)) return;

  const line = `${TAG} ${p.level.toUpperCase()}: ${p.message}`;
  if (p.level === "error") console.error(line, p.context ?? "");
  else if (p.level === "warn") console.warn(line, p.context ?? "");
  else console.info(line, p.context ?? "");

  void persist(p);
}

function base(): Pick<Payload, "url" | "user_agent"> {
  if (typeof window === "undefined") return {};
  return { url: window.location.href, user_agent: navigator.userAgent };
}

/** Report a caught error with optional structured context. */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  const err = error instanceof Error ? error : new Error(String(error));
  report({ level: "error", message: err.message, stack: err.stack, context, ...base() });
}

/** Record a structured, non-error event (funnel steps, lifecycle, etc.). */
export function logEvent(name: string, data?: Record<string, unknown>): void {
  report({ level: "info", message: name, context: data, ...base() });
}

/** Record a warning. */
export function logWarning(message: string, data?: Record<string, unknown>): void {
  report({ level: "warn", message, context: data, ...base() });
}

/** Install global handlers once. Safe to call on every mount. */
export function initMonitoring(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e: ErrorEvent) => {
    report({
      level: "error",
      message: e.message || "Uncaught error",
      stack: e.error instanceof Error ? e.error.stack : undefined,
      context: { filename: e.filename, lineno: e.lineno, colno: e.colno },
      ...base(),
    });
  });

  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    const reason = e.reason;
    const err = reason instanceof Error ? reason : new Error(String(reason));
    report({ level: "error", message: `Unhandled rejection: ${err.message}`, stack: err.stack, ...base() });
  });

  logEvent("app_loaded");
}
