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

### `v0.21` — DM Fixes, Search, Report Modal & UX Tweaks

#### DM / Messaging
- **DM bubble alignment fixed** — messages sent by you now appear on the right; root cause was `myId = session?.userId` (always `undefined` since login response omits `user_id`) replaced with `myId = session?.id` which holds the Supabase UUID matching `messages.from_user_id`
- **Conversation list partner name fixed** — list was always showing the wrong pen name because client re-derived `partner` from `session?.userId`; now uses server-computed `convo.partner` directly
- **Search closes open DM** — clicking the map search icon now calls `setDmPartner(null)` so any open DM thread closes first

#### Messages Tab — Pen Name Search
- New search bar in Messages tab lets you find any user by pen name and start a DM directly
- Debounced 250ms, calls `GET /users/search?q=` (auth required)
- Shows matching results with tap-to-open DM; falls back to conversation list when query is empty

#### New Route: `GET /users/search`
- `server/routes/users.js` — case-insensitive prefix match on `pen_name`, excludes banned users and self, limit 10
- Registered in `server/index.js` as `/users`

#### Report User — Confirm Modal
- Clicking Report on a user profile now shows a modal identical in style to the Block modal ("Report this user?" / Cancel / Report), instead of the previous inline "Confirm?" tab-bar state
- After confirming, button shows "Reported" for 3 seconds then resets

### `v0.20` — Expanded Security Tests

#### New Security Test Groups (10 new groups, 32 new tests — 60 total)
- **Anon users cannot post** — verifies POST /thots requires `req.user` (Supabase auth) and the "anonymous posting is disabled" guard; also confirms `session_id` from cookie is authoritative over body (prevents client spoofing)
- **DM privacy** — conversation list and thread both scope queries to the authenticated caller; GET /:userId uses `from_user_id.eq.${user.id}` and `to_user_id.eq.${user.id}` so you can never read another user's messages; unauthenticated access returns `AUTH_REQUIRED`
- **Self-action prevention** — cannot message yourself (400) or follow yourself (400)
- **Message hype membership** — liking a message in a conversation you're not part of returns 403 "Not part of this conversation"
- **Thot deletion ownership** — DELETE /thots/:id requires a valid session (401 if missing) and checks `thot.session_id !== session_id` (403 "not yours") before hiding
- **Comment deletion ownership** — DELETE /comments/:id checks `comment.user_id !== user.id` (403) before allowing delete
- **Auth required on all write routes** — POST /comments, POST /comments/:id/hype, POST /thots/:id/hype, POST /follows/:userId, DELETE /follows/:userId all verified to return 401 for unauthenticated callers
- **UUID validation** — all route params (thot id, comment id, user id, message id) validated against `/^[0-9a-f-]{36}$/` regex before any DB query
- **Content length limits** — POST /comments enforces ≤280 chars; POST /messages enforces ≤1000 chars; POST /thots wired through `moderate` middleware
- **IP hash** — confirmed `createHash` (crypto) is imported and used; `ip_hash` field never assigned a raw IP string
- **Moderation wired** — `moderate` middleware imported and listed in `router.post('/'...)` args; `moderate.js` uses shared Supabase client (not `createClient` directly, preventing Node 18 WebSocket crash)

#### Pre-existing Test Fix
- Corrected ownership-check assertion from `callerSessionId !== sessionId` → `callerSessionId !== rawId` to match the actual variable name in `thots.js`


### `v0.19` — UI Polish & Delete/Report Modals

#### Custom Confirm Modals
- **Delete thot (ProfileSheet)** — trash icon now opens an in-app "Delete this thot?" modal matching the block-user modal style; replaced browser `window.confirm`
- **Delete thot (Tools → Your drops)** — same modal treatment for the trash icon in the Tools panel
- **Report thot** — flag icon opens "Report this thot?" modal (orange theme); if already reported, same modal shows "Remove your report?" with appropriate copy
- **Backdrop dismiss** — tapping outside any confirm modal cancels it; all three modals (block, delete, report) are now visually consistent

#### Share Sheet Hype Count Fix
- **ProfileSheet** — ShareSheet was passed the raw `thot` object with stale `hype_count`; now passes `{ ...thot, hype_count: hypeCount }` so likes made before opening share are reflected
- **Top Thots** — same fix; share button now reads live hype count from Zustand store at click time before opening the sheet

#### Delete Animation Sequencing
- **ProfileSheet & Tools** — when deleting a thot that restores a previous one, `addThot` (restored pin pop-in) is now deferred 400 ms after `removeThot`; the deleted pin disappears first, then the old pin reappears, rather than both changes landing on the same frame

#### Landing Page
- Auto-redirect on mount now checks `session.type === 'user'` (strict equality) instead of truthy `session.type`; prevents anonymous sessions from being redirected past the landing page

### `v0.18` — Navigation Polish & Messaging Fixes

#### Click-to-fly Navigation
- **Top Thots** — clicking thot content now flies the map to that pin's location and closes the panel; pen name click still opens the profile sheet as before
- **Tools → Your drops** — thots with an active map pin are clickable to fly; expired, hidden, or user-deleted thots show "no longer on map" in dim text and are non-clickable (cursor default, 50% opacity)
- **Tools → Liked** — same behaviour: active liked thots fly to their location on click; off-map ones are visually dimmed and non-interactive
- **Consistency** — matches the existing fly-to behaviour in ProfileSheet and the "your profile" sheet, so all thot lists now behave the same way

#### ProfileSheet — Hidden Thot Styling
- **Removed Live / Hidden badges** — the green "Live" pill and grey "Hidden" pill are gone from thot cards in ProfileSheet
- **Replaced with opacity** — hidden/expired thots now render at 50% opacity, matching the subtle approach in the Tools panel list; no visual clutter for active thots
- **Removed unused imports** — `Eye` and `EyeOff` from lucide-react removed from ProfileSheet

#### Messaging Bug Fixes
- **Unread dot clears immediately on open** — previously the unread indicator in the Messages tab persisted after opening a conversation (MessagesTab fetched once on mount and never updated); clicking a conversation now optimistically sets `unread: 0` in local state so the dot disappears instantly without waiting for a refetch
- **Message hearts persist across reloads** — `GET /messages/:userId` previously returned `select('*')` from the messages table; `i_hyped` is not a column there, so hearts always reset to false on DM reopen or the 8-second poll; server now fetches `message_hypes` for the current user and attaches `i_hyped: true/false` to each message in the response

### `v0.17` — Post-hardening `user_id` identity fixes

#### Bug Fixes
- **Map pins show correct colour after security hardening** — migration 015 stripped `session_id` from `get_thots_nearby` results, causing all `session_id === session.id` checks in `Map.jsx` to silently resolve `false`; all four comparisons now fall back to `|| user_id === session.id`:
  - `thots.find(...)` for `YouPin` `hasThot` — own active pin now renders red
  - `const isYou` for `ThotPin` — pin styled as yours
  - `onClick` handler — tapping own pin opens your profile, not a stranger’s sheet
  - `thot={...}` passed to your own `ProfileSheet`
- **`ProfileSheet` `isYou` / `isOwn` fall back to `user_id`** — `ThotCard` pen-names now render red for the logged-in user’s own posts after `session_id` was stripped from geo results
- **`ProfileSheet` history route uses `?user_id=` for other profiles** — previously always sent `?session_id=` (requires auth, 403s for others); now sends `?user_id=` for non-own profiles and `?session_id=` + auth token only for your own history
- **Server `GET /thots?user_id=`** — new public profile-history endpoint; queries by `user_id` column, returns only non-hidden non-deleted thots, no auth required

### `v0.16` — Security Hardening, Legal Accuracy & Production Readiness

#### Critical Fixes
- **Missing `sendThotReviewEmail` import** (`server/routes/reports.js`) — function was called but never imported, causing a silent `ReferenceError` on every 3rd report; admin review email was never firing
- **`ip_hash` and `session_id` stripped from all public API responses** — `GET /thots/:id`, `GET /thots?session_id=`, `GET /thots/liked`, and the Socket.io `thot:new` broadcast all used `select('*')`; now use an explicit safe column list (`id, content, pen_name, user_id, lat, lng, hype_count, comment_count, created_at, expires_at, hidden, user_deleted`); `ip_hash` and `session_id` are never returned to any client
- **`POST /thots` broadcast sanitized** — `ip_hash` and `session_id` are destructured out of the insert result before being passed to `req.io.emit('thot:new', ...)`
- **`GET /thots?session_id=` now requires session ownership** — previously unauthenticated; now validates the caller's session cookie or JWT matches the requested `session_id`, returning 403 otherwise; prevents any user from reading another user's post history
- **`email` removed from `POST /auth/login` response body** — client already knows the email it submitted; including it in the response let it flow into proxies, logs, and any intercepting middleware
- **`user_id` removed from `POST /auth/signup` response body** — Supabase UUID was unnecessarily disclosed on account creation

#### Rate Limiting (new — all previously unlimited)
- **`loginLimiter`** — 10 attempts per IP per 15 minutes on `POST /auth/login`; blocks brute-force credential attacks
- **`authInfoLimiter`** — 20 requests per IP per minute on `GET /auth/check-email` and `POST /auth/resend-verification`; stops account enumeration at machine speed
- **`commentLimiter`** — 20 comments per session per hour on `POST /comments`
- **`reportLimiter`** — 30 reports per session per hour on `POST /reports`
- **`socialLimiter`** — 60 requests per session per hour on `POST` routes in follows and messages

#### Supabase RLS & Grants — migration 015
- **`get_thots_nearby` rewritten** — previously `returns setof thots` (exposed every column including `ip_hash` and `session_id`); now returns an explicit safe column table type; drop-and-recreate with new signature
- **Open `anon_insert` policy on `thots` removed** — replaced with `server_only_insert` (`with check (false)`) so the server (using service_role, which bypasses RLS) is the only write path; direct Supabase client inserts bypassing rate limiting, moderation, and IP hashing are now blocked
- **Open `anon_insert` policy on `reports` removed** — same fix
- **`GRANT ALL` on social tables replaced with scoped grants** — `follows`: authenticated SELECT only; `messages`: authenticated SELECT + INSERT; `message_hypes`: authenticated SELECT + INSERT + DELETE; `user_reports`: authenticated INSERT only (no SELECT — reporter privacy); `anon` role revoked from all four tables
- **Column-level revoke** — `ip_hash` and `session_id` columns on `thots` revoked from `anon` and `authenticated` roles at the Postgres column-permission level

#### Legal Pages
- **Privacy Policy — SameSite corrected** — was `SameSite=Strict`; actual cookie is `SameSite=Lax` (required for cross-subdomain auth); policy now matches implementation
- **Privacy Policy — birth year retention corrected** — was "not stored beyond the session"; birth year is stored persistently in `users` table and `auth.user_metadata` for age-gate compliance; policy now accurately describes this
- **Privacy Policy — ip_hash clarified** — added explicit disclosure that a SHA-256 hashed IP is stored server-side per post for law enforcement cooperation; plaintext IP never stored
- **Terms of Service — anonymous posting removed** — `POST /thots` requires a registered account; Terms now reflect this instead of describing guest posting
- **Terms of Service — rate limit section corrected** — removed "3 thots/hr for anon, no limit for registered" claim; replaced with accurate description of per-session velocity limits
- **Terms of Service — DMCA registration softened** — removed false claim "We are registered with the U.S. Copyright Office"; replaced with "in the process of completing" pending actual registration at copyright.gov

#### Block List Persistence
- **`blockedSessions` now persists to localStorage** — previously in-memory only, resetting on every page reload; now initialised from `localStorage.getItem('blockedSessions')` and written on every block/unblock, matching the same pattern as `reportedThotIds`

#### Security Tests (`server/test/security.test.js`) — 26 new tests
- `ip_hash` not in `GET /thots/:id` select clause
- `ip_hash`/`session_id` stripped before Socket.io broadcast
- Session history select does not use `select('*')`
- `GET /thots?session_id=` contains ownership enforcement (`callerSessionId !== sessionId`)
- Login response does not contain `email: data.user.email`
- Signup response does not contain `user_id`
- Every admin route includes `requireAdmin` middleware
- All five new rate limiters exported from `rateLimit.js`
- All six route files wire their respective limiters
- `sendThotReviewEmail` importable from `email.js`
- Block list reads from and writes to localStorage
- Privacy Policy states `SameSite=Lax`, not `Strict`
- Privacy Policy doesn't claim birth year not stored
- Terms doesn't claim DMCA registration complete
- Terms doesn't describe anonymous posting as available

**Test suite: 53 tests, 5 files, all passing**

### `v0.15` — Social Graph, Moderation Review & Admin Emails

#### Social Graph
- **Followers list in Tools** — "followers" stat in the Profile tab is now clickable; tapping switches to a followers view listing every user following you with tap-to-profile shortcuts, matching the existing following view
- **`GET /follows/followers` endpoint** — new server route returns the list of users who follow the current authenticated user, using a Supabase foreign key join to resolve pen names
- **Follow notification** — following a user enqueues a push notification to the followed user via `notificationQueue`

#### Moderation Review Flow
- **Admin email at 3 reports (thots)** — `POST /reports` now counts reports after every insert; at exactly 3, sends a branded dark-theme email to the admin with the thot content and a direct "Review thot →" link to `/drop-ops?review=thot&id=xxx`
- **Admin email at 3 reports (users)** — `POST /follows/:userId/report` does the same for `user_reports`; sends "Review user →" link to `/drop-ops?review=user&id=xxx`
- **`/drop-ops` review panel** — AdminDashboard reads `?review=thot&id=` or `?review=user&id=` query params from the email link and renders an inline review panel without leaving the dashboard:
  - **Thot review**: shows content, all reports with reasons, and two action buttons — "Unhide (restore)" or "Keep removed"
  - **User review**: shows profile, all reports, full post history (last 50 thots), full comment history (last 50), and action buttons
- **Proximity rule preserved on unhide** — before restoring a thot, the server calls `get_nearby_user_thots` (new PostGIS function in migration `014`) to find other active thots by the same user within 250m; any conflicts are hidden first so the one-active-thot-per-area rule is never broken
- **Correct user review actions** — non-banned users show "No action — notify user" (dismiss) and "Ban + hide all posts"; already-banned users show only "Reinstate user" — no "Unban" button when there's nothing to undo
- **User emails on every moderation action**:
  - Thot restored → author emailed that their post was cleared after review
  - Thot removed → author emailed with content removal notice and appeal instructions
  - User banned → user emailed with suspension notice, reason, and appeal instructions
  - User unbanned/reinstated → user emailed that their account is restored
  - Reports dismissed (no action) → user emailed that reports were reviewed and nothing was found

#### New Server Endpoints (`server/routes/admin.js`)
- `GET /admin/review/thot/:id` — thot + all reports
- `POST /admin/review/thot/:id/unhide` — restore with proximity enforcement + email author
- `POST /admin/review/thot/:id/remove` — keep hidden + email author
- `GET /admin/review/user/:id` — user profile + reports + thots + comments
- `POST /admin/review/user/:id/ban` — ban + hide all thots + email user
- `POST /admin/review/user/:id/unban` — reinstate previously-banned user + email
- `POST /admin/review/user/:id/dismiss` — no action, email user they're clear

#### Email (`server/lib/email.js`)
- `sendThotReviewEmail` — dark-theme admin alert with thot content and review link
- `sendUserReviewEmail` — dark-theme admin alert with user info and review link
- `sendThotRestoredEmail` — user notification: thot restored after review
- `sendThotRemovedEmail` — user notification: content removal notice with reason
- `sendUserBannedEmail` — user notification: account suspension with appeal path
- `sendUserUnbannedEmail` — user notification: account reinstated
- `sendUserReportsDismissedEmail` — user notification: reports reviewed, no action taken
- `APP_URL` in email templates now reads `SITE_URL` first (already set on Railway), eliminating the need for a separate `APP_URL` env var

#### DB (`supabase/migrations/014_nearby_user_thots_fn.sql`)
- `get_nearby_user_thots(p_session_id, p_exclude_id, p_meters)` — stable SQL function returning active, non-expired thots by a given session within a radius of another thot; used by the admin unhide endpoint to enforce the proximity rule

#### TopThots Polish
- Tightened spacing between pen name and geo label (`-mt-1.5 mb-1.5` on GeoLabel wrapper)
- Icon row sits flush under geo label (`mt-0` instead of `mt-1`)

### `v0.14` — Performance: Caching, Pagination & Location UX

#### Caching & Pagination
- **Server-side pagination** — `GET /thots?session_id` now accepts `limit` (default 20, max 50) and `offset` params; returns `{ thots, total, offset, limit }` instead of a flat array; capped at 50 rows per page to keep response times fast regardless of history length
- **Client-side thot history cache** (`src/lib/thotCache.js`) — module-level `Map` with 5-minute TTL; first open of a ProfileSheet or the Tools Panel drops list renders instantly from cache on repeat visits; pending-deduplication ensures only one in-flight request per session ID
- **"Load more" button** — ProfileSheet and ToolsPanel both show `Load more (N left)` when the server reports more thots than the current page; each tap appends the next 20 and merges into the cache
- **Cache invalidation** — posting a new thot calls `invalidateThotCache(session.id)` so the next ProfileSheet open always reflects the latest post; deleting a thot removes it from the cache immediately via `removeFromCache` without requiring a re-fetch
- **Geocode cache** (`src/lib/geocode.js`) — module-level Map caches reverse-geocode results by coordinate (4 decimal places); concurrent calls for the same coordinate share a single in-flight promise; eliminates redundant Mapbox Geocoding API calls when multiple cards share a location

#### Location & Map
- **Location Randomizer UX** — slider now places thots AT the chosen distance (±10%) rather than randomly within the ring; Gaussian spread replaced with `r = radiusM * (0.9 + Math.random() * 0.2)` so posts appear on the ring, matching user expectation
- **Stale JWT fix** — `visibilitychange` listener on the map page forces `supabase.auth.getSession()` on tab resume; prevents "You must be signed in" errors after laptop sleep with a still-valid session

#### ProfileSheet & ToolsPanel UX
- **Neighborhood label on all thots** — location label (e.g. "Financial District") shown above thot content in ProfileSheet, Top Thots, and ToolsPanel drops list; powered by geocode cache so repeated coordinates don't re-fetch
- **Following tab in Tools** — new "Following" view in the Profile tab lists all users you follow with a tap-to-profile shortcut
- **Mobile bottom sheet** — ProfileSheet slides up from the bottom at 45vh on mobile (map visible above); desktop keeps right-sidebar layout; `slideInFromBottom` / `slideInFromRight` animations switch via CSS media query
- **Delete removes from ProfileSheet instantly** — trashing a thot filters it from the history list and drops count in real time; no re-fetch needed
- **Follow button responsive** — icon-only on desktop (saves space next to follower count); shows "Follow" / "Unfollow" label on mobile where there's more room

#### Bug Fixes
- **Delete + restore showing both nearby thots** — restore logic now calls `count_nearby_session_thots` RPC before un-hiding a prior thot; if a live thot already exists within the block radius the restore is skipped, preventing two visible pins for the same session
- **Compose drawer keyboard zoom on iOS** — all inputs and textareas in the app set `font-size: 16px` to suppress iOS auto-zoom on focus; map viewport no longer shifts when the keyboard appears
- **Map resize after drawer close** — `mapInstance.resize()` called 100ms after ComposeDrawer closes so the Mapbox canvas fills the correct dimensions after keyboard dismissal

### `v0.13` — Privacy, UX Polish & Mobile Layout

#### Identity & Privacy
- **Removed anonymous users** — "Use anonymously" removed from Landing; `RequireAuth` now requires `type === "user"`; `POST /thots` returns 401 if no authenticated user; AgeGate hardcoded to `"user"` flow
- **Location Randomizer** — slider in ComposeDrawer adds Gaussian noise (0–250m) to posted coordinates before hitting the server; purple-themed with live "~Xm offset" readout; max capped at 250m
- **250m range ring** — dashed red ring drawn on the Mapbox map around your location showing the postable radius; fill and stroke use brand red `#e11d48`
- **Rebrand: dropathot** — replaced all remaining `drop-a-thot` hyphenated references across `package.json`, email templates, legal pages, and all UI copy

#### Map & Navigation
- **Fly-to on pin click** — clicking any thot pin on the map now flies the camera to that pin before opening the ProfileSheet, matching the behaviour of the in-sheet thot navigation
- **Centered logo + left search** — dropathot wordmark moved to absolute center of the map header; Search button moved to the left side
- **ProfileSheet mobile bottom sheet** — on mobile the ProfileSheet slides up from the bottom at 50vh so the map remains visible above it; on desktop it keeps the right-sidebar layout; animation switches between `slideInFromBottom` and `slideInFromRight` via media query

#### ProfileSheet UX
- **4-slot action row** — heart, comment, share, and delete/report now each occupy an equal `flex-1` slot, centered, for perfect symmetry across all thot cards
- **Block confirmation dialog** — tapping Block now shows an in-sheet overlay asking "Block this user?" with Cancel/Block buttons; unblock remains immediate
- **Live/Hidden badge alignment** — card header uses relative positioning for the badge to avoid layout interference
- **Comment auto-focus** — opening a ProfileSheet via the Top Thots comment button focuses the comment input automatically

#### Visual Polish
- **Location Randomizer colors** — icon, labels, slider accent, and offset readout all purple (`brand-purple`); slider track rendered with inline gradient (purple fill → white/13 unfilled); container border dimmed to `white/5`
- **Range ring color** — changed from white to brand red with 35% opacity dashed stroke and 4% fill
- **Select font size** — duration dropdown forced to `13px` via inline style to override iOS mobile browser enlargement

### `v0.12` — Thot Deletion, Animations & Session Security

#### Thot Deletion
- **Trash icon on own thots** — delete button visible on your thots in both the ProfileSheet and the Tools Panel "Your Drops" list; requires confirmation before acting
- **Soft delete with restore** — deleting your current (visible) thot sets `hidden=true, user_deleted=true` and restores the most recent auto-hidden prior thot back to the map, provided it hasn't expired and wasn't itself user-deleted
- **`user_deleted` column** (`supabase/migrations/010_user_deleted_flag.sql`) — distinguishes manually deleted thots (`user_deleted=true`) from auto-hidden ones (replaced by a newer post); auto-hidden thots remain visible in profile history, user-deleted ones are hidden everywhere
- **Profile history filtering** — `GET /thots?session_id=` now excludes `user_deleted=true` thots; falls back to `hidden=false` if the migration hasn't run yet (graceful degradation)
- **Instant UI removal** — `onDelete` callback threads from ThotCard up through ProfileSheet, removing the card from the history list immediately without a re-fetch; `removeThot` in Zustand also clears `selectedThot` so the ProfileSheet closes automatically
- **Reports toggle** — flag icon on other users' thots now persists across refreshes via a `localStorage`-backed `reportedThotIds` Set in Zustand; toggling off sends `DELETE /reports/:thotId`; duplicate reports return 409 and are silently treated as reported
- **`supabase/migrations/009_reports_unique.sql`** — unique constraint on `(thot_id, reporter_session)` prevents duplicate report rows

#### Session Security — Delete Auth Fix
- **JWT fallback on DELETE** — `DELETE /thots/:id` previously only accepted the `session_id` cookie, causing silent 401 failures in cross-origin setups where `SameSite=Lax` cookies aren't forwarded for non-GET methods; server now verifies the `Authorization: Bearer <token>` JWT first (same pattern as hype routes) and falls back to cookie for anonymous users
- **Client sends JWT header** — both ProfileSheet and ToolsPanel now include `Authorization: Bearer <supabaseToken>` on all delete fetches when the user is logged in
- **Error feedback** — deletion failures now surface a red error message next to the trash icon instead of silently doing nothing

#### Bubble Animations
- **Pop-in on new thots** — any thot created in the last 15 seconds mounts with a spring pop + shake: starts at 8% scale, overshoots to 113%, bounces through 4 dampening oscillations, and settles at 100%; `transform-origin` anchored at the tail attachment point so the bubble grows from the avatar upward
- **Restored thot animation** — when a deleted thot restores a prior one, the restored thot is flagged `_isNew: true` so it plays the full pop-in animation even though its `created_at` is old
- **Particle explosion on delete** — when any thot marker is removed from the map, `explodeMarker()` projects the marker's lat/lng to screen coordinates via `map.project()`, instantly hides the bubble, then spawns 22 particles (mix of circles and rounded squares in brand red, pink, white, and purple) that burst outward using the Web Animations API; DOM cleaned up after 800ms

#### Account Management
- **Change email** — members can update their email from Settings; current email shown read-only; requires current password verification; audit log entry written; support alert sent
- **Change password** — three-field form (current + new + confirm); server-side current-password verification; audit log entry; support alert
- **Account deletion (30-day soft delete)** — two-step confirmation with plain-English explanation; pending deletion shows countdown + cancel option; daily cron at 02:00 UTC hard-deletes expired accounts
- **`supabase/migrations/007_account_deletion.sql`** — `deletion_requested_at` column on `users`
- **`supabase/migrations/008_account_audit_log.sql`** — audit log table (service-role only RLS)

#### Email & Verification
- **Production email links** — `SITE_URL` env var on Railway ensures verification and password-reset emails link to `dropathot.com` instead of `localhost`
- **Verified toast on landing** — returning from an email verification link shows a green "✓ Email verified — you're good to go" banner with slide-up animation; hash cleaned from the URL
- **Verify-email loop fix** — `resend-verification` endpoint now uses the Supabase Admin REST API with `per_page=50` and exact `.find()` match instead of `listUsers` (whose `filter` param is silently ignored), preventing "already verified" false positives

### `v0.11` — Account Management, Animations & Share Sheet

#### Account Settings (Tools Panel → Settings)
- **Change email** — members can update their email address; requires current password verification before any change is applied; current email shown read-only at top of form; fetched live from `/auth/profile` so it works for all existing sessions
- **Change password** — three-field form (current, new, confirm) with client-side match and length validation; requires current password verification server-side
- **Account deletion (30-day soft delete)** — "Delete account" button in Danger zone with two-step confirmation, plain-English consequences shown before any action; pending deletion shows countdown + cancel; daily cron job at 02:00 UTC hard-deletes expired accounts (anonymises thots/comments, removes hypes, deletes user record + auth entry, releases email for re-use)
- **Audit log** (`supabase/migrations/008_account_audit_log.sql`) — every email and password change is recorded with `event_type`, SHA-256-hashed old/new email, hashed IP, hashed User-Agent, pen name, email domain, and timestamp; service-role only RLS; indexed by user + event type for support queries
- **Support alerts** — email sent to support on every email change, password change, and account deletion request/hard-delete failure
- **DB migration** (`supabase/migrations/007_account_deletion.sql`) — adds `deletion_requested_at` column to `users` table

#### Animations
- **Slide-in panels** — Tools Panel, Profile Sheet, Top Thots all slide in from the right on mount using `cubic-bezier(0.22, 1, 0.36, 1)` (iOS spring curve); Compose Drawer slides up from below
- **Search bar expand** — clicking the search icon animates the bar sliding in from the right with the input fading in 80ms after the bar lands, consistent spring easing throughout

#### Share Sheet
- **Centered modal via React portal** — ShareSheet now renders via `createPortal` into `document.body`, escaping the ToolsPanel's `overflow-hidden` stacking context so it always centres on the full screen
- **Thot card preview** — replaced the raw URL box with a proper card showing avatar, pen name (purple for named users, grey for anon), relative time, bold content, hype/comment counts, and city; Copy link + Share via buttons remain below
- **Consistent accent colour** — matches the rest of the app: named users are always `#7c3aed`, anonymous `#64748b`

#### UI Polish
- **Delete account UX** — "Danger zone" renamed to "Delete account" section header; one-liner below explains 30-day grace before user even clicks
- **Settings forms** — Change email and Change password expand inline as collapsible forms; only one open at a time; success message auto-collapses after 2 seconds


### `v0.10` — Map UX Polish & CAPTCHA Hardening

#### Map — 2D Lock
- **Removed 3D tilt** — `dragRotate`, `touchPitch`, and `touchZoomRotate` rotation disabled on map init; map stays flat at all times
- **Recenter resets orientation** — the recenter button now flies to `pitch: 0, bearing: 0` so north is always up after recentering, even if the map had drifted

#### Age Gate — CAPTCHA Improvements
- **SVG triangle outline** — target is now a proper dashed SVG triangle matching the draggable shape exactly, replacing the old dashed rectangle
- **Bot hardening** — four checks now required to pass: (1) shape placed within 20px of target, (2) drag must take ≥400ms, (3) pointer must travel ≥50px total, (4) positions randomised on every mount and reset so hardcoded coordinates fail
- **Fix: Terms of Service link** — was `href="#"` (dead link); now opens `/legal/terms` in a new tab via React Router `Link`
- **Fix: mobile scroll during drag** — `touch-action: none` on container and draggable + `preventDefault` on touchstart/touchmove stops the page from scrolling while dragging the shape

#### Top Thots
- **Clickable pen names** — tapping a pen name opens that user's ProfileSheet and closes the leaderboard
- **Comment count badge** — shows 💬 N next to each thot (only when >0); tapping it also opens the ProfileSheet to read the thread

### `v0.9` — Anti-Abuse: Profile Tab, Subnet Limits & Alert Emails

#### Profile Tab (Tools Panel)
- **Clickable stats** — thots count toggles your post history; liked count toggles thots you've hyped (fetched from `GET /thots/liked` with Bearer token)
- **Pen name opens ProfileSheet** — tapping your pen name in the profile tab opens your own profile sheet and closes the panel; liked-thots list also has clickable pen names
- **Fixed rate limit label** — was incorrectly showing "10 thots/hr" for auth users; now shows "no rate limit" for members and "3 thots/hr" for guests
- **Sign-up nudge for anon users** — purple card with "Get a pen name" CTA dispatches the auth modal instead of navigating away

#### Subnet Rate Limiting
- **`server/middleware/subnetLimit.js`** — new middleware that caps posts from the same `/24` IP subnet to the same H3 geo tile at 3 unique sessions per hour
- **In-memory store** — no DB required; map is pruned every 5 minutes; resets on server restart (fail-open by design)
- **Private IPs exempt** — localhost and RFC-1918 ranges are never blocked (dev + Railway health checks)
- **Proper 429 UI** — subnet limit errors show an orange "Network limit reached" card in the compose drawer with an explanation and reset time, distinct from generic red error cards

#### Velocity Spike Detection
- **Post-insert async check** — after every successful thot, counts posts in the same H3 tile over the last 10 minutes; if >15, flags it
- **`velocity_flags` table** (`supabase/migrations/006_velocity_flags.sql`) — stores h3 tile, count, coordinates, timestamp, and `reviewed` boolean for admin triage
- **In-process cooldown** — same tile is not re-flagged within a 10-minute window to prevent table flooding
- **Admin socket event** — emits `velocity:spike` to the `admin` Socket.io room for real-time monitoring

#### Alert Emails (support)
- **`alertSupport()` utility** in `server/lib/email.js` — sends a formatted HTML alert to `dev.lexliu@gmail.com` for every important server-side detection, using the existing Resend integration
- **Per-type cooldowns** — suppresses repeat alerts for the same key within a configurable window; logs to console when `RESEND_API_KEY` is absent
- **Wired to all detections:**
  - Subnet rate limit trigger (cooldown: 1 hr per subnet+tile)
  - Velocity spike (cooldown: 10 min per tile)
  - Location spoof attempt (cooldown: 10 min per session)
  - Moderation block (cooldown: 5 min per session)

### `v0.8` — Map UX, Auth Modal & Location Integrity

#### Top Thots Panel
- **Moved to standalone gold star button** — Top Thots is now its own panel opened via a ⭐ button in the top bar, separate from the Tools panel
- **Synced to visible map pins** — `dedupeThots` now filters out thots projected outside the canvas viewport, so Top Thots always exactly matches what's on screen
- **Star always gold, recenter always red** — consistent icon colors regardless of panel state

#### Location Search
- **Search bar** — tap the 🔍 icon in the top bar to expand a full search input; closes back to normal with ✕
- **Mapbox Search Box API** — switched from legacy geocoding to the Search Box API (`/suggest` + `/retrieve` two-step) for Google-quality POI and business results
- **Proximity bias** — results ranked by distance from current map center; flying to a result triggers a normal `moveend` thot fetch for that area

#### Auth Modal
- **Sign in / Sign up modal on the map** — tapping any auth prompt now opens an inline modal overlay instead of navigating away to the landing page
- **`AuthModal` component** — full email/password forms with validation, pen name field for signup, show/hide password toggle, error handling
- **Sign in completes on the map** — session updates in place and modal closes; Sign up still routes to `/age-gate` for age verification
- **Close to cancel** — tap the ✕ or backdrop to dismiss without leaving the map

#### Bug Fixes & Security
- **Fix: named user thots showing as "you" after logout** — `POST /auth/logout` endpoint clears the httpOnly `session_id` cookie; `clearSession()` now calls it so the next anonymous session gets a fresh UUID
- **Fix: anon default duration changed to 6 hours** — was defaulting to 3 hours; options are now 6h / 3h / 2h / 1h
- **Fix: iOS keyboard zoom on compose** — textarea `fontSize` set to `16px` to prevent Safari auto-zoom on focus
- **Server-side location verification** — `POST /thots` now checks claimed coordinates against IP geolocation (via `ipwho.is`); posts more than 500 km from the IP's location are rejected. Fails open if the lookup times out. Skipped for local/private IPs in dev
- **Fix: Node 18 WebSocket crash** — `server/routes/reports.js` and `server/middleware/moderate.js` now import the shared Supabase client from `lib/supabase.js` instead of calling `createClient()` directly
- **Migration 005** — fixes report auto-hide trigger to count `distinct reporter_session` (prevents a single user from filing 3 reports to remove a post)

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
