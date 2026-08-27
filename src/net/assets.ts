import { supabase } from "./client";

/**
 * Asset storage foundation (Phase 0).
 *
 * World art is generated in code today (no binary assets yet), but real sprite
 * sheets and tilesets will drop in behind the same data model later. This is
 * the ready-to-use bridge: a public Supabase Storage bucket (`world-assets`)
 * and a helper that resolves a stored path to a public URL.
 */
export const ASSET_BUCKET = "world-assets";

/** Resolve a path within the world-assets bucket to a public CDN URL. */
export function assetUrl(path: string): string {
  const { data } = supabase.storage.from(ASSET_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
