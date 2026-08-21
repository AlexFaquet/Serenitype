# Serenitype

Serenitype is a calm, local-first web application for focused work, mindful typing, guided breathing, private reflection, ambient sound, and a generative garden that grows from completed moments.

## What is included

- **Today:** a quiet dashboard, mindful totals, and a three-part guided ritual.
- **Focus Room:** intention-led 15, 25, or 50 minute sessions with optional streamed sound.
- **Mindful Typing:** responsive typing passages with accurate WPM, accuracy, and garden growth.
- **Breath Room:** coherent, box, and extended-exhale patterns.
- **Reflection:** private prompts, moods, and journal entries.
- **Serenity Garden:** deterministic generative art built from the user's sessions.
- **Journey:** a twelve-week activity rhythm and private recent history.
- **Sound Room:** a three-channel ambient mixer that streams rather than decoding whole files.
- **Offline use:** an installable PWA shell; large audio is deliberately not cached automatically.
- **Optional sync:** email/password accounts, SQLite persistence, secure session cookies, and revision-aware data sync.

The complete experience works without an account. Data remains in `localStorage` until the user explicitly enables sync.

## Run locally

Node 22.13 or later is required because the backend uses the built-in SQLite module.

```bash
npm start
```

Open <http://127.0.0.1:8787>. Use `npm run dev` for automatic server restarts. Add `?dev=1` to expose 10–15 second Focus and Breath test durations.

## Verify

```bash
npm run check
npm test
```

The test suite uses temporary SQLite databases and exercises registration, authenticated cookies, data sync, conflict handling, and static delivery.

## Configuration

Copy `.env.example` values into your hosting provider's environment configuration. The application reads environment variables directly; it does not load `.env` files itself.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | HTTP port |
| `HOST` | `127.0.0.1` | Bind address; use `0.0.0.0` in a container |
| `NODE_ENV` | development | Enables secure cookies when set to `production` |
| `DATABASE_PATH` | `./data/serenitype.sqlite` | Persistent SQLite location |

## Deployment

`Dockerfile` provides a production image and stores the database in `/data`. `render.yaml` is a ready-to-use Render blueprint with a persistent disk. Any container platform works if it supplies persistent storage and HTTPS.

GitHub Pages can still host the local-only frontend, but it cannot run the sync API. For the complete product, deploy the Node service and point `serenitype.app` to it.

## Data and security model

- Passwords are salted and hashed with `scrypt`.
- Login tokens are random, stored hashed, and sent in HTTP-only, SameSite=Strict cookies.
- Mutating requests validate their origin.
- Auth endpoints are rate limited in memory.
- Responses include CSP, anti-framing, MIME, referrer, and permissions headers.
- Server data uses optimistic revisions to prevent silent cross-device overwrites.
- Reflections are private-by-default but **not end-to-end encrypted** when cloud sync is enabled.

For a multi-instance deployment, replace in-memory rate limiting with a shared store and use a managed PostgreSQL database or a single-writer SQLite service.

## Audio and attribution

Audio is streamed only after interaction. Source and attribution notes live in `FocusRoom/ASSET_ATTRIBUTION.txt`. Before commercial launch, complete the rain asset's license field and confirm that all redistribution terms match the intended deployment.

