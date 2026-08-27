import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

/**
 * A single shared Supabase client for the browser. Pinned to globalThis so the
 * lazily-imported Phaser chunk and the main React chunk share one realtime
 * connection rather than opening a socket per webpack chunk.
 */
const globalScope = globalThis as unknown as { __itsartcSupabase?: SupabaseClient };

export const supabase: SupabaseClient =
  globalScope.__itsartcSupabase ??
  (globalScope.__itsartcSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: { params: { eventsPerSecond: 15 } },
    auth: { persistSession: false },
  }));
