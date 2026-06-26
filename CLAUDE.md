# Thots. / dropathot — Project Brief for Claude Code

Anonymous location-based social network. Twitter-length posts ("thots") appear as pins on a live map, tied to where they were posted. Think Ender's Game pen names meets YikYak meets Sniffies UI.

**Live:** [dropathot.com](https://dropathot.com) · API: [thots-production.up.railway.app](https://thots-production.up.railway.app/health)

---

## Current State (v0.48 — fully deployed)

Everything is complete and live. See `README.md` changelog for full version history.

**Frontend (src/)**
- `pages/Landing.jsx` — log in / create account, dark theme
- `pages/AgeGate.jsx` — birth year scroll picker + ToS checkbox + drag CAPTCHA
- `pages/Map.jsx` — real Mapbox GL JS dark map, live thot pins, compose drawer
- `pages/AdminDashboard.jsx` — moderation/admin UI with per-city seed toggles
- `pages/ThotPage.jsx`, `CommentPage.jsx`, `VerifyEmail.jsx` — supporting pages
- `pages/legal/` — TermsPage, PrivacyPage, SafetyPage
- `components/ThotPin.jsx` — real Mapbox custom marker
- `components/VibeButton.jsx` — sparkle ✦ icon button (top-left, below search); confirmation modal before calling `GET /vibe` for AI neighborhood summary using current map viewport radius; portaled to `document.body` to escape Mapbox stacking context
- `components/ComposeDrawer.jsx`, `ProfileSheet.jsx`, `DMDrawer.jsx`, `ShareSheet.jsx`, `CommentThread.jsx`, `TopThots.jsx`, `ToolsPanel.jsx`, `AuthModal.jsx`
- `ProfileSheet.jsx` also contains `IncognitoSheet` (anonymous view for incognito pins) — same positioning as ProfileSheet (`h-[45vh]` mobile, side panel desktop)
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
| Moderation | `moderate.js` middleware | OpenAI Moderation API only (Perspective API removed v0.38 — end-of-service); covers 11 violation categories |
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
VITE_VAPID_PUBLIC_KEY=    # web push — must match server VAPID_PUBLIC_KEY
```

**`/server/.env`** (backend)
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
IP_SALT=
PORT=4000
SENTRY_DSN=               # optional
FRONTEND_ORIGIN=          # comma-separated allowed origins
RESEND_API_KEY=           # email sending via Resend
EMAIL_FROM=               # sender address for transactional email
SITE_URL=                 # production URL (dropathot.com) — used in email links
APP_URL=                  # same as SITE_URL; used in some email templates
VAPID_PUBLIC_KEY=         # web push VAPID key pair
VAPID_PRIVATE_KEY=
ADMIN_SECRET=             # bearer token required for all /admin/* endpoints
OPENAI_API_KEY=           # OpenAI Moderation API + /vibe AI summary endpoint
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

Current schema after all migrations (001–021). See `supabase/migrations/` for full SQL + RLS.

```sql
-- Core
create table thots (
  id           uuid primary key default gen_random_uuid(),
  content      text not null check (char_length(content) <= 280),
  pen_name     text not null,
  session_id   uuid not null,
  ip_hash      text not null,
  location     geography(Point, 4326) not null,
  lat          float8,           -- denormalized for fast reads
  lng          float8,
  created_at   timestamptz default now(),
  expires_at   timestamptz default now() + interval '24 hours',
  hidden       boolean default false,
  user_deleted boolean default false,  -- explicit user delete (vs auto-hidden)
  is_seed      boolean not null default false,
  user_id      uuid references auth.users(id) on delete set null,
  hype_count   int not null default 0,
  comment_count int not null default 0
);

create table users (
  id                    uuid primary key references auth.users,
  pen_name              text unique not null,
  birth_year            int not null,
  created_at            timestamptz default now(),
  is_banned             boolean default false,
  deletion_requested_at timestamptz,           -- 30-day soft-delete window
  email_dm_digest       boolean not null default true,
  email_activity_digest boolean not null default true
);

create table reports (
  id               uuid primary key default gen_random_uuid(),
  thot_id          uuid references thots(id),
  reporter_session uuid,
  reason           text,
  created_at       timestamptz default now(),
  unique(thot_id, reporter_session)  -- one report per session per thot
);
-- Trigger: auto-hide thot at 3+ distinct-session reports

create table comments (
  id         uuid primary key default gen_random_uuid(),
  thot_id    uuid not null references thots(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  pen_name   text not null,
  content    text not null check (char_length(content) <= 280),
  parent_id  uuid references comments(id) on delete cascade,
  hype_count int not null default 0,
  created_at timestamptz default now()
);

create table hypes (
  thot_id    uuid not null references thots(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (thot_id, user_id)
);

create table follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  uuid not null references users(id) on delete cascade,
  following_id uuid not null references users(id) on delete cascade,
  created_at   timestamptz default now(),
  unique(follower_id, following_id),
  check(follower_id <> following_id)
);

create table messages (
  id           uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references users(id) on delete cascade,
  to_user_id   uuid not null references users(id) on delete cascade,
  content      text not null check (char_length(content) <= 1000),
  hype_count   int not null default 0,
  read_at      timestamptz,
  emailed_at   timestamptz,  -- set when included in digest email
  created_at   timestamptz default now(),
  check(from_user_id <> to_user_id)
);

create table message_hypes (
  message_id uuid not null references messages(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  primary key (message_id, user_id)
);

create table user_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references users(id) on delete set null,
  reported_id uuid not null references users(id) on delete cascade,
  reason      text,
  created_at  timestamptz default now()
);

create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);
-- RLS disabled — server-only (service role)

create table notification_queue (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references users(id) on delete cascade not null,
  type           text not null check (type in ('like', 'comment', 'follow')),
  actor_pen_name text,
  thot_id        uuid,
  created_at     timestamptz default now()
);

create table moderation_logs (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid,
  content    text,
  reason     text,
  source     text,
  categories text[],  -- OpenAI violation categories e.g. ["hate","violence"]
  created_at timestamptz default now()
);

create table velocity_flags (
  id          uuid primary key default gen_random_uuid(),
  h3_tile     text,
  thot_count  int,
  window_mins int,
  lat         float8,
  lng         float8,
  created_at  timestamptz default now()
);

create table account_audit_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,
  action     text,
  detail     jsonb,
  created_at timestamptz default now()
);
```

---

## Key Design Decisions

- **Thots expire after up to 24 hours** — default is 1 day (24h); server enforces a hard max of 24h (rejects `duration_hours > 24` with 400). Users can shorten via a duration dropdown in ComposeDrawer (options: 1 day, 6h, 3h, 1h, 15 min). Still visible in profile history after expiry.
- **One active thot per 150m radius per user** — a user can have multiple active thots on the map as long as they are more than 150m apart. Posting within 150m of an existing thot by the same user hides that prior pin.
- **Registered account required to post** — anonymous browsing is allowed, but `POST /thots` requires a Supabase-authenticated user. There is no anonymous posting flow.
- **US-only posting** — `POST /thots` rejects coordinates outside CONUS, Alaska, Hawaii, Puerto Rico, and USVI with `403 OUTSIDE_US`. Enforced in `server/lib/geo.js` (`isInUsa`).
- **Anonymous ≠ untraceable** — session IDs and hashed IPs logged server-side, never exposed to users. Required for legal cooperation.
- **Section 230 protection** — moderation blocks/flags, never edits content.
- **Pen names are required on every thot** — the `pen_name` column is `NOT NULL`. The server enforces this: `POST /thots` returns 403 `NO_PEN_NAME` if the authenticated user has no pen name set. Seed scripts must never use `pen_name: null`.
- **No photos** — text only. Avoids CSAM risk.
- **PWA required for iOS push** — Web Push on iOS needs Safari + Add to Home Screen (iOS 16.4+).
- **Legal entity** — Dropathot LLC (Delaware). DMCA designated agent registered with U.S. Copyright Office (provides Section 512 safe harbor).
- **ip_hash and session_id are never returned to clients** — stripped from all public API responses and Socket.io broadcasts via explicit safe column lists.
- **Server-side IP geolocation check** — `POST /thots` verifies claimed coordinates against IP geolocation via `ipwho.is`; posts more than 500km from the IP's location are rejected. Fails open if the lookup times out. Skipped for local/private IPs in dev.
- **Location Randomizer** — ComposeDrawer lets users add 0–150m noise to their posted coordinates before the request hits the server. Stored coordinates are therefore not necessarily the user's exact location.
- **Two distinct hidden states** — `hidden=true` without `user_deleted` means the thot was auto-hidden by the 200m proximity rule (still appears in profile history, can be restored by the server). `user_deleted=true` means the user explicitly deleted it — hidden everywhere and never automatically restored.
- **Incognito Mode** — bottom-center toggle on the map. When on, posts show `pen_name: 'Anonymous'` and `user_id: null` to all clients; real identity stays in DB for moderation. Incognito thots are filtered from public profile views. Author can delete their own incognito thots via localStorage tracking (`ownIncognitoIds`). Pins and bubbles show a glasses overlay. `maskIncognito()` in `server/routes/thots.js` handles the stripping; `is_incognito` column added in migration 026.
- **Online presence** — `last_seen_at timestamptz` on `users` table (migration 027). `PUT /users/me/heartbeat` updates it every 30s from authenticated sessions. `enrichWithUserId()` batch-fetches `last_seen_at` for all thot authors and attaches it to API responses (null for incognito). Display: green dot = online (<2 min), grey dot + relative time = recent, grey dot + "offline" = >24h. Shown in ThotPin bubble (next to name) and ProfileSheet header.
- **VibeButton portaling** — the confirm modal and result card use `createPortal(…, document.body)` to escape the Mapbox stacking context, which otherwise traps `fixed` children regardless of z-index.
- **`is_seed` flag** — thots have an `is_seed` boolean. Dedup logic and SQL ordering always sort real thots before seed data at equal distance/hype, so seed pins never crowd out real posts from the LIMIT.

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

**Always check the latest version number before writing a changelog entry:**
```bash
grep "^### \`v" README.md | head -3
```
Then increment by 0.01. Never assume you know the current version — another agent may have already used the number you had in mind. Entries must always be inserted at the **top** of the changelog, never in the middle.

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

### Proximity enforcement on thot restore
When a user deletes their active thot, the server attempts to restore their most recently auto-hidden prior thot. Before doing so it calls the `count_nearby_session_thots` RPC to check for other active thots by the same user within 200m. If one exists, the restore is skipped — the 200m radius rule must never be broken even during restore.

### City seed scripts — each owns only its own session IDs
`server/lib/seed-ids.js` exports per-city session ID prefix ranges (`a/` dev/persistent seed, `b/` NYC, `c/` WeHo, `d/` SF, `e/` Pittsburgh). Each seed script uses its own city's IDs to clear on startup. Never import `ALL_SEED_IDS` to clear everything — it will wipe other cities' data.

### Tests are required for every new feature and every change to existing features

**Rule:** Any session that adds a new server-side feature or modifies existing server-side logic must also add or update tests in `server/test/`. Run `npm test` in `server/` before finishing the session and confirm all tests pass.

**What to test:**
- New route handlers — at least: happy path, missing/invalid params (400), auth failures where applicable (401/403), and DB error path (500)
- New pure/utility functions — export them and unit-test edge cases (empty input, invalid input, determinism where relevant)
- New cron jobs — export pure helper functions (parsers, ID generators, dedup logic) and test them in isolation with mocked dependencies
- Changes to existing features — update the relevant existing test file; don't leave tests that no longer reflect the code

**How:** Mock `../lib/supabase.js` and other I/O dependencies with `vi.mock`. Use `supertest` + a minimal Express app for route tests. Keep tests fast and offline — no real DB, no real API calls.

**Why:** This project is worked on by multiple agents across separate sessions with no shared memory. Tests are the only reliable signal that a change didn't silently break something a previous session built.
