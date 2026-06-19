# Thots. / dropathot — Project Brief for Claude Code

Anonymous location-based social network. Twitter-length posts ("thots") appear as pins on a live map, tied to where they were posted. Think Ender's Game pen names meets YikYak meets Sniffies UI.

**Live:** [dropathot.com](https://dropathot.com) · API: [thots-production.up.railway.app](https://thots-production.up.railway.app/health)

---

## Current State (v0.34 — fully deployed)

Everything is complete and live. See `README.md` changelog for full version history.

**Frontend (src/)**
- `pages/Landing.jsx` — log in / create account, dark theme
- `pages/AgeGate.jsx` — birth year scroll picker + ToS checkbox + drag CAPTCHA
- `pages/Map.jsx` — real Mapbox GL JS dark map, live thot pins, compose drawer
- `pages/AdminDashboard.jsx` — moderation/admin UI with per-city seed toggles
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
- `lib/` — supabase.js, geo.js (H3 + US bounding-box check), webPush.js, notificationQueue.js, email.js, deletionCron.js, seed-ids.js, io.js
- `jobs/digestEmail.js`
- `seed.js` — 8 persistent thots at coordinates
- `seed-demo.js` — 85 thots across NYC neighborhoods
- `seed-weho.js` — 75 thots across West Hollywood
- `seed-sf.js` — 75 thots across San Francisco
- `seed-pittsburgh.js` — 75 thots across Pittsburgh

---

## Full Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + Vite + Tailwind | Deployed on Vercel |
| Map | Mapbox GL JS | Dark theme (`mapbox://styles/mapbox/dark-v11`), custom markers |
| State | Zustand | `useAppStore.js` |
| Backend | Node + Express | Deployed on Railway |
| Database | Supabase (Postgres + PostGIS) | Geo queries, RLS, Realtime |
| Real-time | Socket.io | Broadcasts new thots by H3 tile; user rooms for DM notifications |
| Moderation | `moderate.js` middleware | Pre-screens posts before saving |
| Auth | Supabase Auth (email/password) | Cookie-based; anonymous browsing only, posting requires account |
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
npm run seed:weho     # seed 75 thots across West Hollywood
npm run seed:sf       # seed 75 thots across San Francisco
npm run seed:pittsburgh  # seed 75 thots across Pittsburgh
```

Each city seed script clears only its own city's previous data before inserting — re-running is safe and won't wipe other cities.

---

## Database Schema

```sql
create extension if not exists postgis;

create table thots (
  id          uuid primary key default gen_random_uuid(),
  content     text not null check (char_length(content) <= 280),
  pen_name    text not null,  -- required; every thot must have a pen name
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

- **Thots expire after up to 72 hours** — default is 3 days; users can shorten via a duration dropdown in ComposeDrawer (options below 72h). Still visible in profile history after expiry.
- **One active thot per 200m radius per user** — a user can have multiple active thots on the map as long as they are more than 200m apart. Posting within 200m of an existing thot by the same user hides that prior pin.
- **Registered account required to post** — anonymous browsing is allowed, but `POST /thots` requires a Supabase-authenticated user. There is no anonymous posting flow.
- **US-only posting** — `POST /thots` rejects coordinates outside CONUS, Alaska, Hawaii, Puerto Rico, and USVI with `403 OUTSIDE_US`. Enforced in `server/lib/geo.js` (`isInUsa`).
- **Anonymous ≠ untraceable** — session IDs and hashed IPs logged server-side, never exposed to users. Required for legal cooperation.
- **Section 230 protection** — moderation blocks/flags, never edits content.
- **Pen names are required on every thot** — the `pen_name` column is `NOT NULL`. The server enforces this: `POST /thots` returns 403 `NO_PEN_NAME` if the authenticated user has no pen name set. Seed scripts must never use `pen_name: null`.
- **No photos** — text only. Avoids CSAM risk.
- **PWA required for iOS push** — Web Push on iOS needs Safari + Add to Home Screen (iOS 16.4+).
- **Legal entity** — Dropathot LLC (Delaware). DMCA designated agent registered with U.S. Copyright Office (provides Section 512 safe harbor).
- **ip_hash and session_id are never returned to clients** — stripped from all public API responses and Socket.io broadcasts via explicit safe column lists.

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

### Keep CLAUDE.md in sync with README.md
**Rule:** The `## Current State` version number in `CLAUDE.md` must always match the latest `### vX.XX` entry in `README.md`. Whenever a session adds a changelog entry to `README.md`, also update the version header and any stale sections in `CLAUDE.md`.

**Why:** Multiple agents work in separate sessions with no shared memory. If `CLAUDE.md` drifts from `README.md`, future agents get wrong context about what's built and what the current constraints are.

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

### Always check the latest migration number before creating a new one
**Rule:** Before writing any migration file, run:
```bash
ls supabase/migrations/ | sort | tail -3
```
Then name the new file `NNN_description.sql` where `NNN` is one higher than the current max. Never assume you know the current max — sessions have no shared memory and another agent or developer may have added migrations since you last looked.

**Why:** Two agents once both created `017_*.sql` because neither checked. The duplicate caused confusion about which SQL had been applied and required a manual rename. The correct file is now `020_fix_get_thots_nearby_param_conflict.sql`.

### `get_thots_nearby` — LANGUAGE SQL parameter/column name conflict
**Rule:** When using `create function … returns table(lat float8, lng float8)` with `language sql`, never name the function parameters `lat` or `lng`. Use `p_lat`/`p_lng` (or any name that doesn't match a return column).

**Why:** In `LANGUAGE SQL` functions, PostgreSQL resolves bare identifiers by first matching return column names before parameters. If a parameter and a return column share a name (e.g. `lat`), then `st_makepoint(lng, lat)` inside the function body resolves to the *row's own column values*, not the passed-in coordinates. The `st_dwithin` filter becomes a no-op (every row has distance 0 from itself), so the function returns the global top-N by recency instead of thots near the requested location. This was the root cause of the geo filter being broken from migration 015 through 019. Fixed in migration 020.

### City seed scripts — each owns only its own session IDs
`server/lib/seed-ids.js` exports per-city session ID prefix ranges (`a/` NYC, `c/` WeHo, `d/` SF, `e/` Pittsburgh). Each seed script uses its own city's IDs to clear on startup. Never import `ALL_SEED_IDS` to clear everything — it will wipe other cities' data.
