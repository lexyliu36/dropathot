# Thots.

> Anonymous location-based social network. Twitter-length posts appear as pins on a live map, tied to where they were posted.

**Stack:** React + Vite · Mapbox GL JS · Supabase (Postgres + PostGIS) · Express · Socket.io · Zustand · Tailwind CSS

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Mapbox](https://mapbox.com) account (free tier) for the map token
- A [Supabase](https://supabase.com) project (free tier) for the database

### Environment Setup

**`/.env`** (frontend)
```env
VITE_MAPBOX_TOKEN=pk.your_token_here
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:4000
```

**`/server/.env`** (backend)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
IP_SALT=your_random_string
PORT=4000
```

### Running Locally

```bash
# Frontend — http://localhost:5173
npm install
npm run dev

# Backend — http://localhost:4000
cd server
npm install
npm run dev
```

### Database

Run `supabase/migrations/001_init.sql` in your Supabase SQL editor to set up the schema (PostGIS, thots/users/reports tables, RLS policies, geo query function).

---

## Seeding Local Data

Get your exact coordinates from the map: open `http://localhost:5173/map` in dev mode, allow location, and click the coordinate display in the bottom-left corner — it copies the full seed command to your clipboard.

**Persistent seed** — 8 thots that never expire, for general UI testing:
```bash
node --env-file=server/.env server/seed.js --lat=40.709704 --lng=-74.007315
```

**Opacity demo seed** — 15 thots spread across the 24hr fade window (98% → 5% opacity):
```bash
node --env-file=server/.env server/seed-demo.js --lat=40.709704 --lng=-74.007315
```

Or from inside `server/`:
```bash
npm run seed -- --lat=40.709704 --lng=-74.007315
npm run seed:demo -- --lat=40.709704 --lng=-74.007315
```

Both commands clear all previous seed data before inserting, so re-running is always safe.

---

## Project Structure

```
├── src/
│   ├── pages/          # Landing, AgeGate, Map
│   ├── components/     # ThotPin, ComposeDrawer
│   ├── hooks/          # useLocation, useThots
│   ├── stores/         # Zustand app store
│   └── lib/            # Supabase client, Socket.io, identity
├── server/
│   ├── routes/         # GET/POST /thots, /auth
│   ├── middleware/      # Rate limiting, content moderation
│   ├── lib/            # Supabase (service role), H3 geo helpers
│   └── seed.js         # Local dev data seeder
└── supabase/
    └── migrations/     # Database schema
```

---

## Changelog

### `v0.3` — Session Security & Anonymous Posting

#### Security
- **Session fixation fix** — `POST /auth/anon` always generates a server-side UUID; client-provided session IDs are rejected
- **Cookie hardening** — `sameSite: strict`, `secure: true` in production, max age reduced from 365 → 30 days
- **Session ID spoofing fix** — `POST /thots` reads `session_id` from the httpOnly cookie, not the request body; clients can no longer fabricate a session ID to hide another user's pin
- **Pen name enforcement** — `pen_name` is never trusted from the client; anonymous posts always get `null`, authenticated users have theirs fetched server-side

#### Features
- **Tiered rate limiting** — anonymous users 3 posts/hr, authenticated users 10 posts/hr; determined server-side by validating the Supabase JWT
- **Identity indicator** — compose drawer shows "Posting as anonymous · 3 thots/hr" for guests; pen name in purple for members
- **Instant pin on post** — new thot added to local store immediately on API response, no waiting for Socket.io echo
- **Previous pin auto-removed** — posting again removes your previous pin locally, mirroring server-side hide behaviour
- **Dev seed script** — `node server/seed.js --lat= --lng=` inserts 8 sample thots into Supabase; idempotent on re-run

---

### `v0.2` — Real Map & Live Backend

- Mapbox GL JS map with `dark-v11` style replacing the mock SVG placeholder
- Browser geolocation — map re-centers when permission is granted
- Custom Mapbox markers rendered with React (`createRoot` + `flushSync`)
- `useThots` hook — fetches nearby thots via `GET /thots`, subscribes to real-time updates via Socket.io
- Express + Socket.io backend with H3 geographic rooms (resolution 7, ~1.2 km hex, ~3.6 km coverage)
- Supabase + PostGIS schema — `ST_DWithin` geo queries, generated `lat`/`lng` columns, auto-hide at 3+ reports
- Content moderation via Google Perspective API + OpenAI (fails open in dev)
- IP hashing with SHA-256 + salt for law enforcement logging
- Zustand global store for session, location, thots, and UI state
- `ComposeDrawer` and `ThotPin` as standalone components

---

### `v0.1` — Scaffolding

- React + Vite + Tailwind setup
- Landing page with login / create account / use anonymously flows
- Age gate — birth year picker, ToS checkbox, drag CAPTCHA
- Mock map shell with placeholder pins
- `identity.js` — pen name generator, localStorage session management
