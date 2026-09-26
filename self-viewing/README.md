# Self-Viewing Prototype — buyer flow

A clickable, mobile-web prototype of an AI-guided self-viewing platform:
book a slot → verify ID → get a door code → let yourself in → an AI assistant
"calls" and guides you room by room → nurture → offer → hand-off to a licensed
human agent.

**Everything external is mocked.** Nothing is sent, uploaded or charged. The
point is to feel the UX before building integrations.

## Run it

```bash
cd self-viewing
npm install
npm run dev          # http://localhost:3000 — open on a phone-sized window
npm run build && npm start
```

Turn your sound on for the call screen: replies are read aloud with the
browser's built-in speech synthesis, and the 🎙 button uses browser speech
recognition where supported (Chrome, Safari).

## The flow

| # | Route | Screen |
|---|---|---|
| 1 | `/` | Fake portal listing → **Book a viewing** |
| 1b | `/book` | Slot picker + name/phone |
| 2 | `/verify` | ID + selfie upload → fake "verifying…" |
| 3 | `/confirmed` | Time window + 6-digit door code + preview of the SMS |
| 4 | `/arrive` | Smart-lock keypad; right code → unlock animation |
| 5–7 | `/call` | Incoming call → "AI Agent — On Call" with waveform, room-by-room walkthrough, questions, **End viewing** |
| 8 | `/after` | "Interested?" → ask another question / second viewing / make an offer |
| 9 | `/offer`, `/offer/sent` | Offer amount + context → explicit hand-off to a licensed agent |

"Restart demo" (top right) clears state. State lives in `sessionStorage`.

## Where the real integrations plug in

Each stub lives in `lib/services/` with a `MOCK` banner comment and a
`TODO(integration)` line at the swap point.

| Stub | File | Production replacement |
|---|---|---|
| `sendAccessCodeSMS()` | `lib/services/sms.ts` | Twilio Verify / Messaging, WhatsApp Business. Currently logs to the server console. |
| `verifyIdentity()` | `lib/services/kyc.ts` | KYC vendor (document + liveness + face match), result via webhook. Files never leave the browser. |
| `issueAccessCode()` / `validateAccessCode()` | `lib/services/smartLock.ts` | Lock vendor API (time-bound PINs); lock reports "door opened/closed" events. Codes are HMAC-derived from the booking ID so no DB is needed. Time window not enforced in the demo. |
| `answerQuestion()` + `useAgent()` | `lib/services/voiceAgent.ts`, `components/useAgent.ts` | Real-time voice agent (Vapi / Retell / Bland) placing an actual outbound call, backed by an LLM with the listing as knowledge. Currently keyword matching over `lib/property.ts`. |
| `submitOfferForHandoff()` | `lib/services/offers.ts` | Agency CRM record + negotiator notification. |
| "End viewing" button | `app/call/page.tsx` | Lock's door-closed event. |
| Slots | `lib/slots.ts` | Agency viewing calendar / lock availability. |

API routes (`app/api/bookings`, `app/api/lock/unlock`) are where a real
backend (DB, auth, webhooks) would grow.

**AI guardrail:** the agent refuses to negotiate price or give legal advice and
routes those to a licensed agent (`HANDOFF_TOPICS` in `voiceAgent.ts`). The
offer screen only captures intent.

## Market-neutral by design

No city, country or regulation is assumed. Currency symbol is a single
placeholder (`CURRENCY_SYMBOL` in `lib/property.ts`).

## Deploy (Vercel)

Import the repo in Vercel and set **Root Directory** to `self-viewing`.
Optionally set `ACCESS_CODE_SECRET` (see `.env.example`). No other config.

Listing photos load from Unsplash; if they can't load, a soft placeholder is shown.
