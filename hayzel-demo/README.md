# Hayzel onboarding demo

Standalone demo. Not connected to Hayzel's voice AI or any other Hayzel system. No database:
state lives in the browser (localStorage) or in the booking link itself.

- `/setup` agency onboarding (desktop-first, live phone preview)
- `/b/<slug>?c=<config>` buyer booking page (mobile-first)
- `/api/csv?url=` Google Sheets "Publish to web" CSV proxy

Deployed as its own Vercel project (`hayzel-demo`) with this folder as the root.

```bash
node test/unit.js     # CSV parser, mapping and config round-trip checks
node test/server.js   # local server on :4173 mimicking vercel.json routing
```
