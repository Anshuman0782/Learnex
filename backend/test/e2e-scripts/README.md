# End-to-end check scripts

Small scripts that exercise the real API (and sockets) against a running
backend + your local database. They create their own test users and clean up.

Run a second copy of the server on port 3001 (so your dev server is untouched):

```bash
PORT=3001 node dist/main
```

Then, from `backend/`:

```bash
node test/e2e-scripts/guest-e2e.mjs
```

| Script | Covers |
|---|---|
| `guest-e2e.mjs` | Guest role: can post/comment, no XP/streak/badges, not ranked, no challenges, upgrade |
| `live-e2e.mjs` | Live feed/circle updates, follow + repost flags, circle-admin events |
| `skills-e2e.mjs` | Multi-skill: a role per skill, per-skill XP + boards, critique rights, main skill, guests |
| `chat-admin-e2e.mjs` | Chat photo/document attachments + URL safety, admin people-per-skill counts, XP activity skill/role |
| `session-e2e.mjs` | Login never drops: refresh grace window, 1-year sessions, logout |

Auth routes are rate-limited (5/min) by design â€” if a script reports 429s,
wait a minute and re-run. Never point these at production.
