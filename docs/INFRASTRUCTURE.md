# Infrastructure (Phase 0 — Technical Foundation)

This documents the technical skeleton the product is built on. Phase 0's goal is
a cleanly deployed app with dev/staging/production infra, ready for world
development.

## Environments

| Environment | Where | How it updates |
| ----------- | ----- | -------------- |
| **Development** | Local — `npm run dev` (http://localhost:3000) | Live as you edit |
| **Staging** | Vercel **Preview Deployments** — a unique URL per branch/commit | Automatically on every push to a non-production branch / PR |
| **Production** | `itsartc-app.vercel.app` (Vercel project `itsartc-app`) | Automatically on every push to the production branch |

Deployment is fully automated: GitHub → Vercel. Every push builds once on the
canonical project; preview builds double as staging for review before promotion.

## Domain

Currently served from the free **`itsartc-app.vercel.app`** subdomain. A custom
domain is deferred until purchased; connecting one is a Vercel dashboard +
DNS step (Project → Settings → Domains) with no code change.

## Data & realtime

- **Database / realtime:** Supabase (project `itsartc`, region `eu-central-1`).
  - Realtime Broadcast powers live multiplayer (movement roster) and WebRTC
    voice signalling.
  - `public.client_errors` table backs client error monitoring.
- **Client credentials** live in `src/net/config.ts`, overridable via
  `NEXT_PUBLIC_*` env vars (Supabase URL/key, TURN servers).

## Authentication foundation

Supabase Auth is wired at the client level (`src/net/auth.ts`): session
persistence, auto-refresh, and magic-link / password sign-in helpers. No
sign-in is required yet — the world runs for anonymous guests. Full accounts,
onboarding and profiles are **Phase 2**.

## Asset storage foundation

A public Supabase Storage bucket **`world-assets`** exists for sprite sheets and
tilesets, with a helper `assetUrl(path)` in `src/net/assets.ts`. World art is
generated in code today; real binary assets drop in behind the same data model
later with no renderer changes.

## Observability

Client error monitoring + structured logging: `src/observability/monitor.ts`.

- Installs global `error` / `unhandledrejection` handlers (via `<Monitoring />`
  in the root layout).
- `captureError(err, ctx)`, `logEvent(name, data)`, `logWarning(msg, data)` for
  deliberate reporting.
- De-duped and rate-limited; always logs to the console, and makes a
  best-effort insert into `public.client_errors` (failures are swallowed so
  monitoring can never break the app).
- This is a foundation a hosted monitor (e.g. Sentry) can later replace or
  augment without changing call sites.

## Secrets / environment variables

Public client config ships with safe baked-in defaults and is overridable via
`NEXT_PUBLIC_*` (see `src/net/config.ts`). No private secrets are required by the
client. Server-side secrets, when introduced, belong in Vercel project env vars.
