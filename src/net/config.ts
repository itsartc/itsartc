/**
 * Supabase connection for the live world.
 *
 * These are the project's public client credentials — designed to ship in
 * browser code (the URL is public, and the anon key only grants what Row Level
 * Security allows). We keep baked-in defaults so the deployed app "just works",
 * while allowing an env override (e.g. to point a fork at a different project)
 * via NEXT_PUBLIC_* vars.
 *
 * NOTE: this is deliberately the legacy **anon JWT** key, not the newer
 * `sb_publishable_…` key. Supabase Realtime authorizes the websocket with a
 * JWT; the publishable key is not a JWT, so realtime presence/broadcast fails
 * to connect with it on this client version. The anon JWT is the compatible
 * choice for realtime.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://abzyodjcfwssifzesupw.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFienlvZGpjZndzc2lmemVzdXB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NDA0ODIsImV4cCI6MjEwMzQxNjQ4Mn0.OeSywSTOMqi8bEeAizcjl7p0rY8hbeUhChWHdHZkkLU";
