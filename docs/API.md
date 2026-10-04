# RESQNET REST API

Base URL: `/api` (proxied by Vite in development and nginx in production). JSON in, JSON out.

## Conventions

| Header | Purpose |
|---|---|
| `Authorization: Bearer <accessToken>` | Optional on public endpoints, required on protected ones |
| `X-Device-Id: <uuid>` | Random per-install ID. Lets an anonymous device follow/cancel its own reports |
| `X-Requested-With: resqnet` | Required on cookie-authenticated endpoints (`/auth/refresh`, `/auth/logout`) — CSRF guard |

**Errors** always have this shape, and `message` is safe to show to users:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Some information is missing or invalid.",
             "details": [{ "path": "location.text", "message": "Share your GPS location or describe where you are" }] } }
```

| Status | When |
|---|---|
| 200 / 201 / 204 | OK / created / no content |
| 400 | Malformed body or invalid state change (e.g. resolved → verified) |
| 401 | Missing/expired/invalid token (`TOKEN_EXPIRED`, `INVALID_TOKEN`, `ACCOUNT_DISABLED`, `INVALID_CREDENTIALS`) |
| 403 | Authenticated but role not allowed, or CSRF check failed |
| 404 | Not found — also used instead of 403 for other people's reports, so IDs can't be probed |
| 409 | Conflict (duplicate email, task already accepted by someone else) |
| 413 | Body over 100 kB |
| 422 | Validation failed (`details[]` lists each field) |
| 429 | Rate limited (`RateLimit` / `Retry-After` headers) |
| 500 / 503 | Server problem — generic message only |

Roles: **C** civilian · **V** volunteer · **R** responder · **A** admin · **anon** no account.

## Health

| Method | Path | Access | Notes |
|---|---|---|---|
| GET/HEAD | `/health` | anon | `{status, database, serverTime, demoMode, version}`; 503 if DB down. Used by the PWA's connectivity monitor. Never cached. |

## Authentication

| Method | Path | Access | Body / notes |
|---|---|---|---|
| POST | `/auth/register` | anon | `{name, email, password(≥10), phone?, role?: CIVILIAN\|VOLUNTEER}` → 201 `{accessToken, expiresIn, user}` + refresh cookie |
| POST | `/auth/login` | anon | `{email, password}` → 200 same shape |
| POST | `/auth/refresh` | cookie + CSRF header | Rotates the refresh cookie, returns a new access token. Reuse of an old token revokes the session family. |
| POST | `/auth/logout` | cookie + CSRF header | 204; revokes the refresh token |
| GET | `/auth/me` | any signed-in | `{user}` |

## Incidents

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/incidents` | anon, C, V, R, A | **Idempotent** on `clientId`: 201 `{incident, created:true}` first time, 200 `{created:false}` on replay |
| GET | `/incidents/mine?clientIds=a,b` | owner (user or `X-Device-Id`) | Status of your own reports only |
| POST | `/incidents/client/:clientId/cancel` | owner | `{reason?}` — reporter withdraws a request |
| GET | `/incidents?status=&severity=&type=&assigned=me\|unassigned\|any&includeDemo=` | V, R, A | Sorted critical → low, then suggested priority, then oldest. Volunteers only see open tasks + their own, with ~1 km location and no phone until accepted |
| GET | `/incidents/:id` | V, R, A | Includes `updates[]` timeline |
| PATCH | `/incidents/:id` | R, A (V: own task, status IN_PROGRESS/RESOLVED only) | `{status?, severity?, assignedResponderId?, assignedVolunteerId?, note?}` — transitions validated |
| POST | `/incidents/:id/accept` | V, R, A | Atomic claim; 409 if someone else got it first |
| POST | `/incidents/:id/notes` | R, A, assigned V | `{note}` |

Create body (shared Zod schema `incidentCreateSchema`):

```json
{
  "clientId": "7b0c6a1e-8d1f-4a52-9f3b-1c2d3e4f5a6b",
  "type": "TRAPPED",
  "severity": "CRITICAL",
  "peopleCount": "TWO_TO_FIVE",
  "specialRequirements": ["ELDERLY", "CHILD"],
  "location": { "latitude": 10.989, "longitude": 76.961, "accuracyMeters": 15, "text": "Rooftop, blue house", "source": "GPS" },
  "description": "Water at first-floor level",
  "contactPhone": "+91 98765 43210",
  "clientCreatedAt": "2026-10-04T08:20:00.000+05:30"
}
```

`type` ∈ MEDICAL, TRAPPED, FLOOD, FIRE, BUILDING_COLLAPSE, MISSING_PERSON, FOOD_WATER, EVACUATION, OTHER ·
`severity` ∈ CRITICAL, HIGH, MEDIUM, LOW · `peopleCount` ∈ ONE, TWO_TO_FIVE, SIX_TO_TEN, MORE_THAN_TEN ·
`location` needs coordinates **or** text ≥ 3 chars.

Status workflow: `RECEIVED → VERIFIED → ASSIGNED → IN_PROGRESS → RESOLVED`, `CANCELLED` from any active
state, `RESOLVED → IN_PROGRESS` (reopen), `CANCELLED → RECEIVED`. (`PENDING` exists only on devices.)

## Offline synchronisation

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/sync` | anon or signed-in | Batch replay of queued operations (1–50). Always 200 with per-operation results |
| GET | `/sync/status` | `X-Device-Id` | `{serverTime, lastSyncAt, operationsReceived}` |

```json
// request
{ "deviceId": "1b0c…", "operations": [
  { "operationId": "e1f2…", "entityType": "INCIDENT", "entityId": "<clientId>", "operationType": "CREATE",
    "payload": { /* incidentCreateSchema */ }, "createdAt": "2026-10-04T08:20:00Z", "retryCount": 3 },
  { "operationId": "a9b8…", "entityType": "SAFETY_STATUS", "entityId": "<clientId>", "operationType": "CREATE",
    "payload": { "clientId": "…", "status": "NEED_ASSISTANCE", "clientCreatedAt": "…" }, "createdAt": "…" } ] }

// response
{ "serverTime": "2026-10-04T09:02:11Z", "results": [
  { "operationId": "e1f2…", "entityType": "INCIDENT", "entityId": "…", "status": "APPLIED", "serverId": "…", "referenceCode": "RQ-7K3M9P" },
  { "operationId": "a9b8…", "entityType": "SAFETY_STATUS", "entityId": "…", "status": "DUPLICATE", "serverId": "…" } ] }
```

Supported operations: `INCIDENT/CREATE`, `INCIDENT/CANCEL` (`{clientId, reason?}`), `SAFETY_STATUS/CREATE`.
Result `REJECTED` carries `error` and `retryable` — clients retry only when `retryable` is true.

## Public reference data (no account needed)

| Method | Path | Notes |
|---|---|---|
| GET | `/alerts` · `/alerts/active?region=` | Active, unexpired alerts for the region + "All regions", critical first |
| GET | `/alerts/:id` | |
| GET | `/shelters?region=` · `/shelters/:id` | `availableCapacity` derived; soft-deleted shelters hidden |
| GET | `/shelters/regions` | `[{region, shelters}]` |
| GET | `/emergency-contacts?region=` | National (region = null) + regional |
| GET | `/safety-guides` · `/safety-guides/:idOrSlug` | |
| GET | `/disaster-types` | |
| GET | `/offline-pack?region=` | Everything above for one region in one response with `generatedAt` — what "Download for offline use" stores. `Cache-Control: no-store` |
| POST | `/safety-status` | `{clientId, status, note?, latitude?, longitude?, clientCreatedAt}` — idempotent |
| GET | `/safety-status` | Latest status for the caller (user or device) |

Reference GETs send `Cache-Control: no-cache` with ETags, so revalidation is a cheap 304.

## Management

| Method | Path | Access |
|---|---|---|
| GET | `/admin/users?q=&role=` | A |
| POST | `/admin/users` — `{name, email, password, role, phone?}` | A |
| PATCH | `/admin/users/:id` — `{role?, isActive?}` (cannot change own role/disable self; last admin protected) | A |
| GET | `/users/assignable?role=RESPONDER\|VOLUNTEER` | R, A |
| GET | `/admin/analytics?includeDemo=&days=` | A |
| GET | `/admin/audit-logs` | A |
| GET | `/admin/alerts` (incl. expired) · POST `/alerts` · PATCH `/alerts/:id` · DELETE `/alerts/:id` (deactivate) | A |
| POST `/shelters` · DELETE `/shelters/:id` | | A |
| PATCH `/shelters/:id` (e.g. occupancy; status auto FULL at capacity) | | R, A |
| POST/PATCH/DELETE `/emergency-contacts[/:id]` | | A |
| POST/PATCH/DELETE `/safety-guides[/:id]` · POST/PATCH `/disaster-types[/:id]` | | A |

## Simulation (demo) — only when `DEMO_MODE_ENABLED=true`, admin only; otherwise 404

| Method | Path | Body |
|---|---|---|
| POST | `/demo/flood-alert` | `{region}` → CRITICAL `[DEMO]` flood alert, 6 h |
| POST | `/demo/rescue-requests` | `{region, count ≤ 25}` → random flagged incidents near the region |
| POST | `/demo/shelter-capacity` | `{region}` → randomises occupancy |
| POST | `/demo/reset` | Deletes every `is_demo` incident and alert |
