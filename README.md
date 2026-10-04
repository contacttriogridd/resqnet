# RESQNET — Resilient Emergency & Safety Network

**An offline-first disaster response and emergency coordination platform.**
*When the network fails, the application should not fail.*

RESQNET is an installable Progressive Web App that helps civilians, volunteers, emergency responders and
administrators coordinate during floods, cyclones, earthquakes, landslides, tsunamis, fires and other
large-scale emergencies. Every emergency action is stored on the device first and delivered when a
connection exists — so asking for help, reading safety guidance and finding emergency numbers keep
working with no internet at all.

---

## Contents

1. [Problem statement](#problem-statement)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Tech stack](#tech-stack)
5. [Database design](#database-design)
6. [Offline architecture](#offline-architecture)
7. [Getting started](#getting-started)
8. [Testing](#testing)
9. [PWA installation](#pwa-installation)
10. [Demo / simulation mode](#demo--simulation-mode)
11. [Deployment](#deployment)
12. [Project structure](#project-structure)
13. [Limitations](#limitations)
14. [Future improvements](#future-improvements)

Further documentation: [Architecture](docs/ARCHITECTURE.md) · [Database & ER diagram](docs/DATABASE.md) ·
[REST API](docs/API.md)

---

## Problem statement

During disasters the mobile data network is the first thing to degrade: towers lose power, backhaul is
congested, people are indoors or underground. Conventional web apps then show a blank page or a technical
error at exactly the moment someone needs help. RESQNET is designed so that a person can always answer:

1. **Am I safe?** 2. **What is happening around me?** 3. **Where can I get help?**
4. **How can I request help?** 5. **What should I do right now?** 6. **Does this work without internet?**

— and so that the app is honest about what it *cannot* do offline.

## Features

### Everyone (no account needed)
- **Home** — current situation (most severe active alert), four large emergency actions, quick actions,
  persistent 🟢 Online / 🟠 Limited / 🔴 Offline indicator.
- **SOS / Request help** — confirmation screen (nothing is sent or dialled without an explicit tap), quick
  type picker, GPS → saved location → manual description, your emergency info, one-tap calls to 112/108/101.
- **Full request / report form** — type, severity, people (1 / 2–5 / 6–10 / 10+), special requirements,
  location, message, optional phone. Drafts auto-save to the device.
- **Offline submission** — saved to IndexedDB with a local ID and **WAITING FOR CONNECTION** status, then
  delivered automatically (with duplicate protection) when connectivity returns.
- **My reports** — delivery state, reference code (e.g. `RQ-7K3M9P`), live status, cancel ("we no longer need help").
- **Alerts** — severity (Information / Advisory / Warning / Critical), region, instruction, expiry;
  offline copies are labelled with their sync time and never shown after expiry.
- **Shelters** — list and map, sort by distance (GPS or saved location), filters, capacity bars,
  facilities, accessibility, call shelter, open in a maps app; offline data clearly dated.
- **Emergency contacts** — bundled in the app, so they show with **no API request**, with `tel:` links.
- **Safety guides** — Flood, Earthquake, Cyclone, Tsunami, Fire, Landslide, Storms, Forest fire, Emergency kit — fully offline.
- **My safety status** — Safe / Need assistance / Emergency / Unknown; saved locally, synced later.
- **Family & group** — names, numbers, medical info, accessibility needs, preferred shelter — stored **only on the device**.
- **Share location** — via SMS (mobile network, not internet), share sheet or clipboard.
- **Offline Data Center** — what is stored, when it last synced, "Download emergency information for
  *region*", **Sync now**, what does / doesn't work offline, storage usage, wipe device data.

### Volunteers
- Open help requests near you (approximate location until accepted), accept tasks (atomic — no double
  booking), mark in progress / resolved with notes, cached task list offline.

### Responders
- Triage dashboard sorted **Critical → High → Medium → Low**, then suggested priority, then waiting time;
  counts by severity; list or map; "queued offline N min" flag for reports delivered by sync.
- Incident detail: accept/assign to me, status workflow, severity change, assign responder/volunteer,
  notes, timeline, call reporter, map. Suggested priority is shown as **advisory** with its reasons.
- Update shelter occupancy.

### Administrators
- Overview: totals (users, active/critical/resolved incidents, shelters, volunteers, responders, active
  alerts), median time-to-assign / time-to-resolve, daily volume, incidents by type / severity / location / status.
- Manage users (create responders/admins, change roles, disable), alerts, shelters, emergency contacts;
  audit log.
- **Simulation mode** (clearly labelled DEMO) — see [Demo mode](#demo--simulation-mode).

### Cross-cutting
- WCAG-minded UI: large touch targets (≥ 48 px), visible focus, semantic HTML, labels, skip link, status
  never shown by colour alone, reduced-motion support, automatic dark mode, 106 % base font size.
- Mobile-first (tested at 360 px with no horizontal scrolling), bottom navigation with an always-visible
  **HELP** button; sidebar on desktop.

## Architecture

```text
UI components → hooks → services → offline manager → IndexedDB → sync engine → REST API
                                                                                 ↓
                                      routes → controllers → services → Prisma → PostgreSQL
```

Detailed diagrams (system, offline request sequence, connectivity state machine, security model) are in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tech stack

| Area | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 4, React Router 7, React Hook Form + Zod |
| Offline | vite-plugin-pwa (injectManifest) + Workbox service worker, Dexie (IndexedDB), Background Sync, Web Locks |
| Maps | Leaflet + OpenStreetMap tiles (lazy-loaded; list fallback offline) |
| Backend | Node.js, Express 5, TypeScript, Zod, Helmet, CORS, express-rate-limit, pino |
| Auth | Argon2id, JWT access tokens (in memory), rotating HttpOnly refresh cookie |
| Database | PostgreSQL + Prisma ORM |
| Shared | `@resqnet/shared` — enums, Zod schemas, labels, priority rules, workflow, bundled content |
| Testing | Vitest, Supertest, fake-indexeddb, Testing Library, Playwright |
| Deployment | Docker, Docker Compose, nginx |

## Database design

15 application tables: `users`, `refresh_sessions`, `responders`, `volunteers`, `disaster_types`, `emergency_contacts`,
`safety_guides`, `alerts`, `shelters`, `shelter_resources`, `incidents`, `incident_updates`,
`user_safety_status`, `sync_logs`, `audit_logs` (plus Prisma's `_prisma_migrations`). UUID keys, foreign keys with
explicit delete behaviour, indexes on every hot path, and CHECK constraints for coordinates, capacity,
priority and "every incident has a location". Device-generated `client_id` columns (UNIQUE) are the
idempotency keys for offline sync. See [docs/DATABASE.md](docs/DATABASE.md) for the ER diagram.

## Offline architecture

| Capability | How |
|---|---|
| App opens offline | Service worker precaches the shell and every code-split chunk; SPA routes fall back to cached `index.html` |
| Request help offline | Written to IndexedDB (`incidents` + `syncQueue`) in one transaction, shown as *Waiting for connection* |
| Automatic delivery | Sync engine flushes on enqueue, on reconnect (backoff reset), every 20 s with pending work, on Background Sync, and on "Sync now" |
| No duplicates | Stable `operationId` + `clientId` with UNIQUE constraints server-side, Web Lock client-side |
| Honest connectivity | `navigator.onLine` **plus** `/api/health` checks **plus** per-request signals → Online / Limited / Offline |
| Honest data age | Every cached dataset stores the *server's* timestamp; screens show "last synchronised …" and warn when offline |
| Contacts & guides | Bundled into the JavaScript — available on first launch, before any successful request |

## Getting started

### Prerequisites
- **Node.js 20.19+** (developed on Node 24) and npm 10+
- **PostgreSQL 14+** — local install, or use Docker (`docker compose up db`)

### 1. Install

```bash
git clone <repo-url> resqnet && cd resqnet
npm install          # installs all workspaces, builds @resqnet/shared, generates the Prisma client
```

### 2. Configure the environment

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://resqnet:pw@localhost:5432/resqnet?schema=public` | Main database |
| `TEST_DATABASE_URL` | `…/resqnet_test` | **Wiped** by backend tests — must differ from `DATABASE_URL` |
| `TEST_E2E_DATABASE_URL` | `…/resqnet_e2e` | Used by Playwright tests |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | 48 random bytes each | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` — must differ |
| `SEED_ADMIN_PASSWORD` | ≥ 10 chars | Quote it if it contains `#` |
| `SEED_DEMO_PASSWORD` | optional | Creates demo responder / volunteer / civilian accounts |
| `DEMO_MODE_ENABLED` | `true` locally, `false` in production | Enables admin simulation endpoints |

Do **not** put `NODE_ENV` in `.env` — Vite reads the same file, and `NODE_ENV=development` would make the
production build bundle React's development build.

Create the databases (any PostgreSQL client), e.g. `createdb resqnet && createdb resqnet_test && createdb resqnet_e2e`.

### 3. Migrate and seed

```bash
npm run db:deploy    # apply migrations (non-destructive)
npm run db:seed      # reference data, admin, demo accounts, SAMPLE shelters/alerts/incidents
```

The seed is idempotent. Sample shelters and regional numbers are **fictional** (Coimbatore & Chennai);
national emergency numbers (112, 100, 101, 108, 1078, 1070, 1077, 1091, 1098) are real Indian numbers.

| Account | Password |
|---|---|
| `admin@resqnet.local` (or `SEED_ADMIN_EMAIL`) | `SEED_ADMIN_PASSWORD` |
| `responder@resqnet.local`, `volunteer@resqnet.local`, `civilian@resqnet.local` | `SEED_DEMO_PASSWORD` |

### 4. Run

```bash
npm run dev          # API on http://localhost:4000/api, web on http://localhost:5173
```

The service worker is **only active in production builds**. To try offline behaviour locally:

```bash
npm run build -w @resqnet/frontend
npm run preview -w @resqnet/frontend   # http://localhost:4173 (proxies /api to :4000)
```

Then open DevTools → Network → *Offline*, or use the app's **Simulation mode**.

## Testing

```bash
npm test                           # shared (15) + backend (60) + frontend unit (23)
npx playwright install chromium    # once
npm run test:e2e                   # builds the PWA, then 7 browser scenarios
```

| Suite | What it covers |
|---|---|
| `shared` (Vitest) | Validation schemas, priority scoring, triage ordering, geo helpers |
| `backend` unit | JWT signing/tampering, Argon2id, refresh-token hashing, reference codes |
| `backend` integration (Supertest + real PostgreSQL) | Registration/login/refresh rotation & reuse detection/CSRF/logout; anonymous & idempotent incident creation incl. 5 concurrent duplicates; RBAC for every role; volunteer data minimisation; atomic accept; status workflow; sync batches (apply, replay, direct+queued dedupe, partial rejection, cancel ordering, attribution); alerts/shelters/contacts/offline pack; analytics & demo isolation; security headers, CORS, `alg:none`, forged/expired tokens, DB-role-over-token-role, injection strings, error leakage, body limit |
| `frontend` unit (Vitest + fake-indexeddb) | Sync engine (delivery, backoff, reset on reconnect, stable operation IDs, duplicates, permanent vs transient rejection, batching & ordering, per-entity ordering, stuck-op recovery); offline submission, validation, drafts, cancel; bundled datasets; alert expiry; network state machine |
| `frontend` E2E (Playwright, production build + service worker) | **UAT 1** online submit reaches backend · **UAT 2** offline submit stored in IndexedDB · **UAT 3** auto-sync on reconnect, no duplicates · **UAT 4** guides offline · **UAT 5** contacts offline with `tel:` links · **UAT 6** cached shelters with last-sync time · status indicator · 360 px layout |

## PWA installation

- **Android / Chrome / Edge**: open the site, then use the in-app *"Install RESQNET for faster emergency
  access"* card (shown once, dismissible for 14 days) or the browser menu → *Install app*.
- **iOS Safari**: Share → *Add to Home Screen*.

Installed, it opens full-screen with shortcuts (Request help, Find shelter, Emergency contacts) and the
browser is more likely to keep its offline data (the app also requests persistent storage).

## Demo / simulation mode

Sign in as an administrator → **Simulation mode** (`/admin/demo`). Available only when
`DEMO_MODE_ENABLED=true`.

| Control | Effect |
|---|---|
| Simulate offline | This browser behaves as offline (purple DEMO banner) — persists across reloads |
| Generate flood alert | CRITICAL `[DEMO]` alert for the region |
| Generate rescue requests | N random flagged incidents near the region |
| Change shelter capacity | Randomises occupancy of the region's shelters |
| Restore connection | Ends the offline simulation → queued data syncs automatically |
| Synchronise data | Runs the sync engine and refreshes cached data now |
| Reset demo data | Deletes only `is_demo` incidents and alerts |

Everything generated is flagged `is_demo`, labelled **DEMO** in every view, excluded from analytics by
default, and audited. A suggested 6-step demonstration script is shown on the page.

## Deployment

```bash
cp .env.example .env   # set JWT secrets, SEED_ADMIN_PASSWORD, POSTGRES_PASSWORD
docker compose up --build -d
docker compose exec backend npx tsx backend/src/database/seed.ts   # first run
# → http://localhost:8080
```

- `db` — PostgreSQL 17 with a named volume and healthcheck.
- `backend` — runs `prisma migrate deploy` then the compiled API as a non-root user; `TRUST_PROXY=1`.
- `frontend` — nginx serving the PWA with a strict CSP, `no-cache` for `sw.js`/`index.html`, immutable
  hashed assets, and `/api` proxied to the backend (same origin, so no CORS and the `SameSite=Strict`
  refresh cookie works).

Production checklist: HTTPS (required for service workers & geolocation outside localhost), strong unique
secrets, `DEMO_MODE_ENABLED=false`, real regional contacts and shelters, database backups, and log shipping.

## Project structure

```text
resqnet/
├── shared/                 @resqnet/shared — enums, Zod schemas, labels, priority, workflow, bundled content
├── backend/
│   ├── src/
│   │   ├── config/         validated environment
│   │   ├── routes/         URL → middleware → controller
│   │   ├── controllers/    HTTP in/out only
│   │   ├── services/       business logic (incidents, sync, auth, alerts, analytics, demo…)
│   │   ├── middleware/     auth/RBAC, validation, CSRF, rate limits, errors
│   │   ├── models/         Prisma client + DTO mappers (data minimisation)
│   │   ├── validators/     API-only request schemas
│   │   ├── utils/          tokens, passwords, errors, logger
│   │   ├── database/seed.ts
│   │   ├── app.ts · server.ts
│   └── test/               integration & security tests
├── frontend/
│   ├── src/
│   │   ├── pages/          civilian, staff/, admin/
│   │   ├── components/     UI kit, layout, cards, charts, map
│   │   ├── hooks/          reactive IndexedDB + store hooks, geolocation
│   │   ├── services/       API client, session, incidents, safety, staff
│   │   ├── offline/        network monitor, datasets, refresh, PWA install/update
│   │   ├── database/       Dexie schema
│   │   ├── sync/           sync engine (shared with the service worker) + manager
│   │   ├── sw.ts           service worker
│   │   └── App.tsx
│   ├── e2e/                Playwright UAT scenarios
│   └── public/             icons, favicon, offline.html
├── prisma/                 schema.prisma + migrations
├── docs/                   ARCHITECTURE.md · DATABASE.md · API.md
├── scripts/                generate-icons.mjs
├── docker-compose.yml · .env.example · README.md
```

## Limitations

RESQNET is careful to distinguish three things:

| | Works without internet? |
|---|---|
| **Offline capability** — guides, contacts, cached shelters/alerts, saving requests, safety status, family info, GPS | ✅ Yes, on the device |
| **Online synchronisation** — delivering requests to responders, receiving new alerts, live shelter capacity | ❌ Needs *some* connection to the RESQNET server; data waits safely until then |
| **External emergency communication** — phone calls, SMS | Uses the mobile network (may work without data); RESQNET only opens the dialler/SMS app and **cannot contact emergency services by itself** |

Other limitations:
- A browser app cannot transmit without a network path. Mesh, LoRa, SMS gateways and satellite are future
  transports (see below), not implemented.
- If the service worker has never loaded (first visit while offline), only the browser's own offline page
  is available. Visit once while online, or install the app.
- Browsers may evict storage on low-space devices; installing the PWA and the persistent-storage request
  reduce but cannot eliminate this risk.
- Background Sync is Chromium-only; on Safari/Firefox queued data is sent the next time the app is open
  and online. When the service worker syncs with no tab open, reports are sent anonymously (linked to the
  device rather than the account).
- Map tiles are available offline only for areas viewed online; the list view is the reliable fallback.
  Distances are straight-line estimates, not routes.
- The suggested priority is a transparent rule-based score, not a validated clinical triage tool.
- Seed shelters and regional phone numbers are fictional sample data.
- Rate limiting and the user-state cache are in-memory (single API instance); multi-instance deployments
  should use a shared store such as Redis.

## Future improvements

- **Alternative transports** behind the existing `SyncTransport` interface: SMS gateway, LoRa/LoRaWAN,
  Bluetooth / Wi-Fi Direct mesh between phones, satellite messaging.
- **Data feeds**: government disaster APIs, weather APIs, IoT flood and river-level sensors → automatic alerts.
- **AI (always advisory, never overriding responders)**: ML prioritisation via the `PriorityAdvisor`
  interface, disaster-risk prediction, resource/shelter allocation suggestions, computer-vision damage
  assessment from photos, drone imagery.
- Push notifications for critical alerts, photo attachments on reports, multilingual UI (Tamil, Hindi…),
  offline vector maps, end-to-end encryption of on-device family data with a PIN.
