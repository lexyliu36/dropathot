# drop-a-thot

> Anonymous location-based social network. Drop a thought onto the map — it appears as a pin wherever you are. Think YikYak meets Sniffies, text only.

**Live:** [dropathot.com](https://dropathot.com) · API: [thots-production.up.railway.app](https://thots-production.up.railway.app/health)

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

**NYC demo seed** — 85 thots across Hell's Kitchen, Central Park, Williamsburg, Queens, LES, FiDi, and scattered landmarks (no coordinates needed):
```bash
node --env-file=server/.env server/seed-demo.js
```

Or from inside `server/`:
```bash
npm run seed -- --lat=40.709704 --lng=-74.007315
npm run seed:demo
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

### `v0.7` — Compliance: Reporting, Moderation Logging & Legal Pages

#### Policy Compliance Fixes
- **Report button** — Flag icon added to every thot's action row (hidden on your own thots). Tapping sends `POST /reports`; button turns orange and shows "reported" on success
- **`POST /reports` server route** — inserts into the existing `reports` table; the DB trigger auto-hides thots with 3+ reports from different sessions
- **Blocked attempt logging** — `moderate.js` now logs every flagged post to a new `moderation_logs` table (session_id, hashed IP, content preview, reason) before returning 422. Retained 3 years per Privacy Policy
- **Comment moderation** — `POST /comments` now runs through the same Perspective + OpenAI moderation middleware as thots
- **Migration 004** — `moderation_logs` table with RLS (service_role only; anon/authenticated have zero access)

#### Legal Pages
- **Terms of Service** (`/legal/terms`) — 16 sections: eligibility, UGC license, prohibited conduct, Section 230, DMCA, law enforcement cooperation, arbitration/class action waiver
- **Privacy Policy** (`/legal/privacy`) — data collected (session ID, hashed IP, coordinates), sub-processors, 3-year moderation log retention, CCPA rights
- **Safety Policy** (`/legal/safety`) — CSAM/NCMEC reporting, violence, harassment, doxxing, self-harm resources (988/Crisis Text Line), moderation flow, law enforcement cooperation
- **Landing links** — footer links wired to `/legal/terms`, `/legal/privacy`, `/legal/safety`

### `v0.6` — drop-a-thot: Rebrand, Comments & Map Intelligence

#### Rebrand
- **Renamed to drop-a-thot** — updated app title, page titles, all in-app copy, `package.json`, and meta tags across Landing, AgeGate, Map, and share pages
- **Live at [dropathot.com](https://dropathot.com)** — CORS origin updated to accept comma-separated `FRONTEND_ORIGIN` env var so both the old Vercel URL and the new domain work simultaneously

#### Threads-style ThotCard UI
- **New card layout** — avatar pin icon + pen name + relative timestamp header; content body; action row with heart, comment bubble, and share icons
- **Heart icon** replaces the upvote arrow everywhere: map pins, Top Thots leaderboard, Profile tab, and the `ThotPin` bubble; count hidden when zero
- **Outline heart when not liked, filled red when liked** — leaderboard and profile cards connect to the Zustand `hypedThotIds` store so state is consistent across all surfaces
- **Share and like on Top Thots and Profile** — both panels now show the full action row, not just the count

#### Share & Public Pages
- **`ShareSheet` component** — centered modal (not a bottom sheet) with Copy link and native Share via buttons; copy button turns green on success
- **`/t/:id` public thot page** — every thot has a permanent shareable URL; reverse-geocoded neighbourhood + city shown in subtle text via Nominatim; works even for thots hidden from the map (replaced by a newer post); "Open drop-a-thot" CTA
- **`/c/:id` public comment page** — comments are independently shareable; shows the parent thot dimmed above for context, then the comment card highlighted with a branded border

#### Comment System
- **`CommentThread` component** — flat comment list that opens under any thot when the bubble icon is tapped; renders inside ProfileSheet and the map detail sheet
- **Reply without nesting** — clicking Reply on a comment pre-fills `@penname ` in the compose box and shows a "Replying to" pill; `reply_to_pen_name` stored on the row so the mention renders in accent colour inline; replying at the same level (YouTube-style, no nesting)
- **Comment likes** — each comment has its own heart button; `comment_hypes` table with a trigger keeping `hype_count` in sync; auth-only, count hidden when zero
- **Comment share** — `Upload` icon on every comment opens the ShareSheet with the `/c/:id` URL
- **`comment_count` on thots** — DB trigger keeps `thots.comment_count` in sync; comment bubble shows live count
- **`GET /comments/:id`** — new server endpoint powering the `/c/:id` page; no auth or hidden filter so shared comments are always accessible

#### Map & Fetch Intelligence
- **Viewport-based fetch radius** — replaced fixed `40000 / 2^(zoom-10)` formula with the actual half-diagonal of the visible map bounds in metres, guaranteeing that everything on screen is always within the fetch radius regardless of zoom or aspect ratio
- **Fetch limit raised to 100** — prevents Manhattan thots from consuming the entire limit when the map center is on the Brooklyn waterfront; spatial dedupe (max 2 pins per 150 px grid cell) controls what actually renders
- **Distance-ordered `get_thots_nearby`** — migration `002` drops old signatures and recreates the function ordering by `ST_Distance ASC, created_at DESC` so the thots closest to wherever you're looking always appear first
- **NYC demo seed spread across all 5 boroughs** — 85 thots with pen names covering all five boroughs plus NJ; seed pen names are on the `thots` table only and do not block real user registration

#### Auth & Expiry
- **No rate limiting for logged-in users** — `smartRateLimit` middleware validates the Supabase JWT and calls `next()` immediately for authenticated requests; anon cap stays at 3/hr
- **Auth thot expiry capped at 72 hours** — "Forever" option removed from ComposeDrawer; max duration is 3 days regardless of input; default is 72h

#### Database (`supabase/migrations/`)
- `002_distance_ordering.sql` — updated `get_thots_nearby` with distance-first ordering and `max_results` parameter
- `003_comments_reply.sql` — creates `comments` and `comment_hypes` tables (idempotent), adds `reply_to_pen_name` and `comment_count` columns, installs count-sync triggers, and sets RLS policies + grants for anon/authenticated read

---

### `v0.5` — Production Launch 🚀

- **Live at [thots-beta.vercel.app](https://thots-beta.vercel.app)**
- **Frontend deployed to Vercel** — `vite build` output served via Vercel CDN; `vercel.json` rewrites all routes to `index.html` for client-side routing
- **Backend deployed to Railway** — Express + Socket.io server running via `node index.js`; environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `RESEND_API_KEY`, `SITE_URL`, etc.) configured in Railway dashboard
- **Supabase production project** — schema applied, RLS disabled on app tables, `get_thots_nearby` function deployed with PostGIS
- **`SITE_URL`** updated to production domain so email verification links redirect correctly after click
- **`FRONTEND_ORIGIN`** set to the Vercel deployment URL to allow CORS and Socket.io connections from production

---

### `v0.4` — Auth, Hype & Smart Map

#### Auth & Enrollment
- **Full signup flow** — pen name, email, password → age gate → CAPTCHA → account created in Supabase with credentials stored in `user_metadata`; branded verification email sent via Resend
- **Email verification page** (`/verify-email`) — dedicated screen shown when login fails due to unverified email; 60-second resend cooldown with server-side throttle (max 3/hr per email)
- **Login** — real `POST /auth/login`; returns `access_token` + `refresh_token`; Supabase SDK auto-refreshes the token via `onAuthStateChange` so sessions never silently expire
- **Route guard** — `/map` requires completed enrollment; direct navigation without age gate redirects to `/`
- **Logout** — Settings tab in the Tools panel clears session and returns to landing
- **Sign up / Sign in CTAs** — all nudges throughout the app (ComposeDrawer, ProfileSheet, ToolsPanel) now correctly navigate to the Landing form in the right mode

#### Email Infrastructure
- **Resend integration** (`server/lib/email.js`) — branded HTML email template; dev mode overrides all recipients to a single test address; falls back to console-logging the link when no API key is configured
- **`RESEND_API_KEY` / `EMAIL_FROM` / `SITE_URL`** added to `server/.env`

#### Map & Thots
- **Zoom-aware fetching** — radius and thot limit scale with zoom level automatically on pan and zoom; street level shows everything, country level shows only the top handful
- **`get_thots_nearby` updated** — accepts `max_results`, orders by `created_at DESC`, returns `hype_count`
- **Stable session identity for auth users** — `session_id` is now the user's Supabase UUID so thots remain linked across logouts and re-logins
- **Pen name on posts** — server reads `pen_name` from `user_metadata` instead of the `users` table

#### Hype (Upvote)
- **`hypes` table** — `(thot_id, user_id)` unique constraint; trigger keeps `thots.hype_count` in sync automatically
- **`POST /thots/:id/hype`** — toggles hype; auth-only; anon attempts return `AUTH_REQUIRED` and redirect to sign-up
- **`GET /thots/my-hypes`** — loads which thots the current user has hyped on map mount so pins show the correct state immediately
- **Live counts** — ThotPin and ProfileSheet read `hypedThotIds` and `hype_count` from the Zustand store; counts update instantly without re-fetching
- **Leaderboard** — re-ranks by `hype_count DESC` with recency as tiebreaker

#### Seed Data
- **`seed-demo.js` rewritten** — 85 thots with real NYC coordinates across Hell's Kitchen, Central Park, Williamsburg, Queens, LES, FiDi, and scattered landmarks; no `--lat/--lng` args needed
- **Duration support** — anonymous thots expire in 3h; auth thots are permanent; seeder reflects these rules

#### Database (`supabase/migrations/001_init.sql`)
- `hypes` table with cascade delete
- `hype_count int default 0` column on `thots`
- `hype_count_sync` trigger
- RLS disabled on all app tables (auth enforced server-side via JWT validation)

---

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
