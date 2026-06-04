# Thots. — Project Brief for Claude Code

Anonymous location-based social network. Twitter-length posts ("thots") appear as pins on a live map, tied to where they were posted. Think Ender's Game pen names meets YikYak meets Sniffies UI.

---

## What's Already Built (Phase 1)

- **React + Vite + Tailwind** scaffold (port 5173)
- **Landing page** (`/`) — Log in / Create account / Use anonymously, dark theme
- **Age gate** (`/age-gate`) — birth year scroll picker + ToS checkbox + drag CAPTCHA (2-step hard gate for legal cover)
- **Map shell** (`/map`) — dark grid placeholder map, mock thot pins with anonymous SVG avatars, floating text bubbles, compose drawer, tap-to-expand detail sheet
- **Identity lib** (`src/lib/identity.js`) — pen name generator, localStorage session management

---

## Full Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + Tailwind | Already scaffolded |
| Map | Mapbox GL JS | Dark theme, custom markers, clustering |
| State | Zustand | Lightweight, no boilerplate |
| Backend | Node + Express (Railway) | Simple REST + WebSocket server |
| Database | Supabase (Postgres + PostGIS) | Geo queries, Realtime, free tier |
| Real-time | Socket.io | Broadcast new thots to nearby users by H3 tile |
| Moderation | Google Perspective API + OpenAI Moderation API | Pre-screen posts before saving |
| Auth | Supabase Auth (email/password) + anonymous sessions | Cookie-based persistence |
| Deployment | Vercel (frontend) + Railway (backend) | |

---

## Environment Variables Needed

```
# Frontend (.env)
VITE_MAPBOX_TOKEN=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:4000

# Backend (.env)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
PERSPECTIVE_API_KEY=
OPENAI_API_KEY=
PORT=4000
```

---

## Folder Structure (target)

```
Thots./
├── src/
│   ├── pages/
│   │   ├── Landing.jsx       ✅ done
│   │   ├── AgeGate.jsx       ✅ done
│   │   ├── Map.jsx           ✅ done (mock data, needs real Mapbox)
│   │   └── Profile.jsx       ⬜ user/anon profile sheet
│   ├── components/
│   │   ├── ThotPin.jsx       ⬜ real Mapbox marker component
│   │   ├── ComposeDrawer.jsx ⬜ extract from Map.jsx
│   │   └── ProfileSheet.jsx  ⬜ slide-up profile with post history
│   ├── lib/
│   │   ├── identity.js       ✅ done
│   │   ├── supabase.js       ⬜ Supabase client
│   │   └── socket.js         ⬜ Socket.io client
│   ├── hooks/
│   │   ├── useThots.js       ⬜ fetch + subscribe to nearby thots
│   │   └── useLocation.js    ⬜ browser geolocation hook
│   └── stores/
│       └── useAppStore.js    ⬜ Zustand: session, radius, composing state
├── server/
│   ├── index.js              ⬜ Express + Socket.io entry
│   ├── routes/
│   │   ├── thots.js          ⬜ POST /thots, GET /thots?lat&lng&radius
│   │   ├── auth.js           ⬜ POST /auth/signup, /auth/login, /auth/anon
│   │   └── profile.js        ⬜ GET /profile/:id, GET /profile/:id/thots
│   ├── middleware/
│   │   ├── moderate.js       ⬜ Perspective + OpenAI check before saving
│   │   └── rateLimit.js      ⬜ 5 posts/hour per session
│   └── lib/
│       └── geo.js            ⬜ H3 tile helpers, ST_DWithin queries
└── supabase/
    └── migrations/
        └── 001_init.sql      ⬜ schema below
```

---

## Database Schema

```sql
-- Enable PostGIS
create extension if not exists postgis;

-- Thots table
create table thots (
  id          uuid primary key default gen_random_uuid(),
  content     text not null check (char_length(content) <= 280),
  pen_name    text,                          -- null = anonymous
  session_id  uuid not null,                 -- for moderation/law enforcement
  ip_hash     text not null,                 -- hashed IP, never plaintext
  location    geography(Point, 4326) not null,
  created_at  timestamptz default now(),
  expires_at  timestamptz default now() + interval '24 hours',
  hidden      boolean default false          -- hidden if user posts again
);

-- Index for geo queries
create index thots_location_idx on thots using gist(location);
create index thots_expires_idx on thots(expires_at);

-- Users table (only for signed-up users)
create table users (
  id          uuid primary key references auth.users,
  pen_name    text unique not null,
  birth_year  int not null,
  created_at  timestamptz default now(),
  is_banned   boolean default false
);

-- Reports table
create table reports (
  id          uuid primary key default gen_random_uuid(),
  thot_id     uuid references thots(id),
  reporter_session uuid,
  reason      text,
  created_at  timestamptz default now()
);
-- Auto-hide thot when 3+ reports
create or replace function check_report_threshold()
returns trigger as $$
begin
  if (select count(*) from reports where thot_id = NEW.thot_id) >= 3 then
    update thots set hidden = true where id = NEW.thot_id;
  end if;
  return NEW;
end;
$$ language plpgsql;
create trigger report_threshold after insert on reports
  for each row execute function check_report_threshold();
```

---

## Build Phases (remaining)

### Phase 2 — Real Map + Live Data
- Replace mock map in `Map.jsx` with real Mapbox GL JS
- Wire `useLocation.js` hook (request browser geolocation on mount)
- `useThots.js` — fetch thots within radius via `GET /thots?lat&lng&radius`
- Real `ThotPin` component as a Mapbox custom marker
- Pin clustering with `mapbox-gl-cluster`

### Phase 3 — Backend + Auth
- Express server with Supabase client
- `POST /thots` — moderate → save → broadcast via Socket.io to H3 neighbors
- `GET /thots` — `ST_DWithin` geo query, exclude expired/hidden
- Supabase Auth for signed-up users; UUID cookie for anonymous users
- Rate limiting: 5 thots/hour per session_id

### Phase 4 — Profile Sheet
- Tap any avatar → slide-up `ProfileSheet`
- Shows: pen name (or "Anonymous"), post history (non-expired thots), badges, online status
- DM button (future), Block button (hides their thots locally)
- Your own profile shows all your thots including hidden-on-map ones

### Phase 5 — Moderation + Legal
- `moderate.js` middleware: run Perspective API toxicity check + OpenAI moderation before every `POST /thots`
- Block posts scoring >0.85 toxicity or flagging `THREAT` / `SEVERE_TOXICITY`
- Log all blocked attempts with session_id + ip_hash for law enforcement subpoenas
- Add report button to every thot detail sheet
- DMCA agent registration (copyright.gov, ~$6)
- Add to ToS: IP/session logging, law enforcement cooperation policy

### Phase 6 — Ship
- Deploy frontend to Vercel
- Deploy backend to Railway
- Set up Supabase prod project
- Cloudflare in front of everything (DDoS, rate limiting at edge)
- Set up Sentry for error tracking

---

## Key Design Decisions

- **Thots expire after 6 hours** on the map. Still visible in profile history.
- **One active thot per user** on the map — posting again hides the previous pin.
- **Anonymous ≠ untraceable** — session IDs and hashed IPs are logged server-side, never exposed to other users. Required for legal cooperation.
- **Section 230 protection** — never editorially alter post content. Moderation blocks/flags, doesn't edit.
- **Pen names are optional** — only signed-up users have them. Anonymous users show as "anon" with a generic avatar. Both can post.
- **No photos** — text only. Keeps it simple, avoids CSAM risk.

---

## Design System

- **Font:** Inter (all weights)
- **Background:** `#0a0a0f` (near black)
- **Card background:** `#0e0e1a`
- **Brand red:** `#e11d48` — your pin, post button
- **Brand purple:** `#7c3aed` — named users, accents
- **Brand blue:** `#2563eb` — CTAs, age gate
- **Map style:** Mapbox `mapbox://styles/mapbox/dark-v11`
- **Avatar:** anonymous SVG (no photos ever)
- **Bubble tail:** bottom-left pointing down from text to avatar

---

## Commands

```bash
npm run dev       # frontend dev server, port 5173
npm run build     # production build
node server/index.js  # backend, port 4000 (once created)
```
