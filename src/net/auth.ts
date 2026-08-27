import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./client";

/**
 * Authentication foundation (Phase 0).
 *
 * This is the thin service layer that later phases build real accounts on top
 * of (Phase 2A). It intentionally does NOT render any UI or force sign-in — the
 * world runs fine for anonymous guests today. It just makes the auth capability
 * available and consistent: read the current session, subscribe to changes,
 * start a passwordless (magic-link) or password sign-in, and sign out.
 */

export type { Session, User };

/** Current session, or null for an anonymous guest. */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Current signed-in user, or null. */
export async function getUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** Subscribe to auth state changes. Returns an unsubscribe function. */
export function onAuthChange(cb: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

/**
 * Send a passwordless magic-link / OTP to an email. The redirect returns the
 * user to the app, where `detectSessionInUrl` completes sign-in.
 */
export async function signInWithEmail(email: string): Promise<{ error: string | null }> {
  const emailRedirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/world` : undefined;
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } });
  return { error: error?.message ?? null };
}

/** Password sign-in (available for later flows; email magic-link is the default). */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

/** Sign out the current user. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
