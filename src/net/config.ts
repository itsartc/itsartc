/**
 * Supabase connection for the live world.
 *
 * These are the project's **publishable** credentials — they are designed to
 * ship in client-side code (the URL is public, and the publishable/anon key
 * only grants what Row Level Security allows). We keep sane baked-in defaults
 * so the deployed app "just works", while still allowing an env override
 * (e.g. to point a fork at a different project) via NEXT_PUBLIC_* vars.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://abzyodjcfwssifzesupw.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_uxym0B5LyEXZk2HuMPg7pw_Cc7dx8yc";
