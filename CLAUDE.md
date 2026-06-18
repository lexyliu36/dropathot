# Thots. / dropathot — Project Brief for Claude Code

Anonymous location-based social network. Twitter-length posts ("thots") appear as pins on a live map, tied to where they were posted. Think Ender's Game pen names meets YikYak meets Sniffies UI.

**Live:** [dropathot.com](https://dropathot.com) · API: [thots-production.up.railway.app](https://thots-production.up.railway.app/health)

---

## Current State (v0.24 — fully deployed)

Everything in the original build phases is complete and live. See `README.md` changelog for full version history.

**Frontend (src/)**
- `pages/Landing.jsx` — log in / create account / use anonymously, dark theme
- `pages/AgeGate.jsx` — birth year scroll picker + ToS checkbox + drag CAPTCHA
- `pages/Map.jsx` — real Mapbox GL JS dark map, live thot pins, compose drawer
- `pages/AdminDashboard.jsx` — moderation/admin UI
- `pages/ThotPage.jsx`, `CommentPage.jsx`, `VerifyEmail.jsx` — supporting pages
- `pages/legal/` — TermsPage, PrivacyPage, SafetyPage
- `components/ThotPin.jsx` — real Mapbox custom marker
- `components/ComposeDrawer.jsx`, `ProfileSheet.jsx`, `DMDrawer.jsx`, `ShareSheet.jsx`, `CommentThread.jsx`, `TopThots.jsx`, `ToolsPanel.jsx`, `AuthModal.jsx`
- `hooks/useThots.js`, `useLocation.js`, `usePush.js`
- `lib/supabase.js`, `socket.js`, `identity.js`, `auth.js`, `geocode.js`, `animations.js`, `thotCache.js`
- `stores/useAppStore.js` — Zustand: session, radius, composing state

**Backend (server/)**
- `index.js` — Express + Socket.io + Sentry + CORS + helmet
- `routes/` — thots, auth, comments, reports, admin, follows, users, messages, push
- `middleware/` — moderate.js, rateLimit.js, subnetLimit.js
- `lib/` — supabase.js, geo.js (H3), webPush.js, notificationQueue.js, email.js, deletionCron.js
- `jobs/digestEmail.js`

---

## Full Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + Vite + Tailwind | Deployed on Vercel |
| Map | Mapbox GL JS | Dark theme (`mapbox://styles/mapbox/dark-v11`), custom markers |
| State | Zustand | `useAppStore.js` |
| Backend | Node + Express | Deployed on Railway |
| Database | Supabase (Postgres + PostGIS) | Geo queries, RLS, Realtime |
| Real-time | Socket.io | Broadcasts new thots by H3 tile |
| Moderation | `moderate.js` middleware | Pre-screens posts before saving |
| Auth | Supabase Auth (email/password) + anonymous sessions | Cookie-based |
| Error tracking | Sentry (`@sentry/react` + `@sentry/node`) | No-op when DSN not set |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | Runs on push to main/dev |
| Push notifications | Web Push API + `web-push` library | iOS requires PWA (Add to Home Screen) |

---

## Environment Variables

**`/.env`** (frontend)
```
VITE_MAPBOX_TOKEN=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:4000
VITE_SENTRY_DSN=          # optional
```

**`/server/.env`** (backend)
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
IP_SALT=
PORT=4000
SENTRY_DSN=               # optional
FRONTEND_ORIGIN=          # comma-separated allowed origins
```

---

## Commands

```bash
npm run dev           # frontend dev server, port 5173
npm run build         # production build
npm test              # Vitest

cd server
npm run dev           # backend dev server, port 4000
npm run seed -- --lat=LAT --lng=LNG   # seed 8 persistent thots at coords
npm run seed:demo     # seed 85 thots across NYC neighborhoods
```

---

## Database Schema

```sql
create extension if not exists postgis;

create table thots (
  id          uuid primary key default gen_random_uuid(),
  content     text not null check (char_length(content) <= 280),
  pen_name    text,
  session_id  uuid not null,
  ip_hash     text not null,
  location    geography(Point, 4326) not null,
  created_at  timestamptz default now(),
  expires_at  timestamptz default now() + interval '24 hours',
  hidden      boolean default false
);
create index thots_location_idx on thots using gist(location);
create index thots_expires_idx on thots(expires_at);

create table users (
  id          uuid primary key references auth.users,
  pen_name    text unique not null,
  birth_year  int not null,
  created_at  timestamptz default now(),
  is_banned   boolean default false
);

create table reports (
  id               uuid primary key default gen_random_uuid(),
  thot_id          uuid references thots(id),
  reporter_session uuid,
  reason           text,
  created_at       timestamptz default now()
);
-- Auto-hide thot at 3+ reports (trigger in 001_init.sql)
```

Full schema + RLS policies in `supabase/migrations/001_init.sql`.

---

## Key Design Decisions

- **Thots expire after 24 hours** on the map. Still visible in profile history.
- **One active thot per user** — posting again hides the previous pin.
- **Anonymous ≠ untraceable** — session IDs and hashed IPs logged server-side, never exposed to users. Required for legal cooperation.
- **Section 230 protection** — moderation blocks/flags, never edits content.
- **Pen names are optional** — only signed-up users have them. Anonymous shows as "anon" with SVG avatar.
- **No photos** — text only. Avoids CSAM risk.
- **PWA required for iOS push** — Web Push on iOS needs Safari + Add to Home Screen (iOS 16.4+).

---

## Design System

- **Font:** Inter (all weights)
- **Background:** `#0a0a0f`
- **Card background:** `#0e0e1a`
- **Brand red:** `#e11d48` — your pin, post button
- **Brand purple:** `#7c3aed` — named users, accents
- **Brand blue:** `#2563eb` — CTAs, age gate
- **Map style:** `mapbox://styles/mapbox/dark-v11`
- **Avatar:** anonymous SVG (no photos ever)

---

## Gotchas / Lessons Learned

### Never create a Supabase client directly in server files
**Rule:** Always `import { supabase } from '../lib/supabase.js'`. Never call `createClient()` directly in route or middleware files.

**Why:** Railway runs Node 18. The `@supabase/supabase-js` Realtime client requires native WebSocket (Node 20+) or an explicit `ws` transport. `server/lib/supabase.js` is the one place that wires up `{ realtime: { transport: ws } }` correctly. Direct `createClient()` calls crash on startup:
```
Error: Node.js 18 detected without native WebSocket support.
```

### Git commits must be done from the user's terminal
Claude's sandbox can stage files (`git add`) but cannot commit — git identity isn't configured in the sandbox and index.lock is often held by Claude Code's background process. Always ask Lexy to run `git commit` + `git push` from her terminal.

### `push_subscriptions` table has RLS disabled
Table is server-only (service role); RLS is intentionally off. Do not re-enable — it breaks push subscription on signup.

### Multi-agent coordination — always update the changelog
When multiple Claude agents work on this repo in separate sessions, they have no shared memory. The README.md changelog is the source of truth for what has changed and why.

**Rule:** At the end of every session where code or docs are modified, add a `### vX.XX — ...` entry to the `## Changelog` section in `README.md` describing what changed. Future agents (and Lexy) will read the changelog to understand prior work before making new changes.

This applies to any change — code, legal pages, config, docs. If you touched it, log it.
