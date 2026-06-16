# Song-Sharing Platform API

A production-ready NestJS backend that connects **songwriter managers** with their
**songwriters** inside **organizations**. Managers create organizations and link songwriters;
songwriters upload songs; managers review songs and create **pitches** (tags, description,
target artists).

Built with **NestJS · TypeScript · MySQL · Prisma · better-auth · Docker**, following clean
architecture (controller → service → repository → mapper), SOLID principles, and atomic
(transactional) writes.

> The full design rationale lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Schema
> decisions and trade-offs are documented in [`SOLUTION.md`](SOLUTION.md).

---

## Quick start (Docker — one command)

```bash
git clone <your-repo-url> && cd Myron
cp .env.example .env          # adjust BETTER_AUTH_SECRET for anything non-local
docker-compose up --build     # starts MySQL + API, applies migrations
```

- API: <http://localhost:3000>
- Swagger UI: <http://localhost:3000/docs>

To seed demo data on startup, set `SEED_ON_START=true` in `.env` (creates a manager,
songwriter, organization, song and pitch — see credentials printed in the logs).

---

## Local development (without Docker)

Requires Node 20+ and a reachable MySQL 8 instance.

```bash
npm install
cp .env.example .env          # set DATABASE_URL to 127.0.0.1, not `mysql`
npm run prisma:generate
npm run prisma:migrate        # create + apply the dev migration
npm run db:seed               # optional demo data
npm run start:dev             # watch mode
```

---

## Architecture

```
Controller   HTTP only — validation, Swagger, delegation
   → Service    business rules + authorization + prisma.$transaction boundaries
      → Repository   the only layer that touches PrismaClient
         → PrismaService (singleton)
Cross-cutting: AuthGuard/RolesGuard/OrgMembershipGuard · global ValidationPipe ·
               AllExceptionsFilter (uniform error envelope) · LoggingInterceptor
```

Modules: `auth`, `users`, `organizations`, `songs`, `pitches`, plus infra `prisma`,
`storage`, `config`, `common`. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Configuration (`.env`)

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` \| `test` \| `production` |
| `PORT` | API port (default 3000) |
| `BETTER_AUTH_URL` | Public base URL (cookies/redirects) |
| `BETTER_AUTH_SECRET` | 16+ char secret for signing sessions |
| `CORS_ORIGIN` | Comma-separated allowed origins |
| `DATABASE_URL` | MySQL connection string |
| `UPLOAD_DIR` | Directory for stored audio files |
| `MAX_UPLOAD_BYTES` | Max upload size (default 25 MB) |

Env is validated at boot (Joi) — the app fails fast on missing/invalid values.

---

## API overview

Auth is cookie-based (better-auth). All non-auth routes require a session; roles are enforced
per endpoint. Full interactive docs at `/docs` — every endpoint documents its request body,
response and error schemas (the uniform error envelope), query/path params, and cookie-auth
requirement, including the better-auth routes.

| Area | Endpoint | Notes |
|---|---|---|
| Health | `GET /health` · `GET /health/ready` | liveness + DB readiness (public) |
| Auth | `POST /api/auth/sign-up/email` · `POST /api/auth/sign-in/email` · `POST /api/auth/sign-out` · `GET /api/auth/get-session` | handled by better-auth |
| Users | `GET /users/me` · `PATCH /users/me` · `GET /users/:id` | profile + role |
| Orgs | `POST /organizations` (manager) · `GET /organizations` · `GET /organizations/:id` · `GET /organizations/:id/members` | |
| Orgs | `POST /organizations/:id/songwriters` (manager) | link **by email** |
| Songs | `POST /songs` (songwriter, multipart) · `GET /songs` (filters) · `GET /songs/:id` · `GET /songs/:id/file` · `PATCH /songs/:id` · `DELETE /songs/:id` | |
| Pitches | `POST /songs/:songId/pitches` (manager) · `GET /pitches` · `GET /pitches/:id` · `PATCH /pitches/:id` | |

### Example requests (curl)

```bash
# Sign up + sign in a manager (cookie jar keeps the session)
curl -c mgr.txt -X POST localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' \
  -d '{"name":"Mary Mgr","email":"mgr@x.com","password":"Passw0rd!","role":"MANAGER"}'
curl -c mgr.txt -X POST localhost:3000/api/auth/sign-in/email \
  -H 'Content-Type: application/json' -d '{"email":"mgr@x.com","password":"Passw0rd!"}'

# Create an organization
curl -b mgr.txt -X POST localhost:3000/organizations \
  -H 'Content-Type: application/json' -d '{"name":"Acme Music"}'   # -> { id: ORG_ID }

# Sign up a songwriter, then link them by email
curl -c sw.txt -X POST localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' \
  -d '{"name":"Sam Writer","email":"sw@x.com","password":"Passw0rd!"}'
curl -b mgr.txt -X POST localhost:3000/organizations/ORG_ID/songwriters \
  -H 'Content-Type: application/json' -d '{"email":"sw@x.com"}'

# Songwriter uploads a song (multipart)
curl -b sw.txt -X POST localhost:3000/songs \
  -F 'file=@demo.mp3' -F 'organizationId=ORG_ID' -F 'title=My Demo' -F 'genre=pop'

# List + filter
curl -b sw.txt "localhost:3000/songs?organizationId=ORG_ID&genre=pop&page=1&limit=20"

# Manager creates a pitch (tags + target artists, persisted atomically)
curl -b mgr.txt -X POST localhost:3000/songs/SONG_ID/pitches \
  -H 'Content-Type: application/json' \
  -d '{"description":"Great summer single","tags":["pop","summer"],
       "targetArtists":[{"name":"Dua Lipa"},{"name":"The Weeknd","note":"uptempo"}]}'
```

---

## Testing

```bash
npm run test        # unit tests (mocked, no DB needed)
npm run test:cov    # unit tests with coverage

# Playwright API suite — the full flow across every endpoint + auth/validation negatives.
# Against a local target it auto-starts the compiled app (a built dist/ + reachable, migrated
# DB are required) and reuses an already-running instance such as `docker compose up`.
npm run test:api                                   # defaults to http://localhost:3000
API_BASE_URL=http://localhost:3000 npm run test:api
npm run test:api:report                            # open the last HTML report
```

- **Unit** tests (Jest) cover service authorization logic and the storage-cleanup-on-failure path.
- **End-to-end** ([`e2e/api.spec.ts`](e2e/api.spec.ts)) is **14 BDD flows** against the **real**
  better-auth stack — each a self-contained user journey written as `Given/When/Then` steps:
  manager onboarding, link-by-email + song upload/list/stream, pitch create/get/list/update,
  song update + cascade delete, **multi-org data isolation**, the **song-edit authorization
  matrix**, **co-manager pitching**, and **pagination/filtering at scale** — plus negatives
  (401/403/404/400). Each actor gets its own request context that persists the session cookie.
- **Request/response in the report:** every call is attached to the HTML report (method, URL,
  headers, body ↔ status, headers, body) with `Cookie`/`Set-Cookie`/`Authorization` masked and
  binary bodies summarised. Open it with `npm run test:api:report`.

---

## Code quality

```bash
npm run lint        # eslint (type-checked) + prettier, autofix
npm run lint:check  # CI mode (no fixes)
npm run format      # prettier only
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs install → generate → lint →
build → migrate → unit tests → **Playwright API suite** on every push/PR against a MySQL service
container, so the real end-to-end flow is exercised on every change.

---

## Deployment

The provided multi-stage `Dockerfile` produces a slim, non-root runtime image. On container
start, `docker-entrypoint.sh` runs `prisma migrate deploy` before launching the server.
`docker-compose.yml` provisions MySQL (with healthcheck) and the app, with named volumes for
database data and uploads. For a real deployment, point `DATABASE_URL` at a managed MySQL,
set a strong `BETTER_AUTH_SECRET`, restrict `CORS_ORIGIN`, and swap `LocalDiskStorage` for an
object-storage implementation (the `STORAGE_SERVICE` token makes this a one-line change).

To seed demo data into a container, set `SEED_ON_START=true` (the entrypoint runs the compiled
seed — no extra tooling needed inside the image).

---

## Contributing

Setup, conventions, and the pre-PR checklist are in [`CONTRIBUTING.md`](CONTRIBUTING.md); the
design rationale is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Assumptions

- **Single user-level role** (`MANAGER` / `SONGWRITER`), self-selected at sign-up.
- **Direct linking** of songwriters by email — no email-invite flow.
- **Two-service docker-compose** (app + MySQL) rather than one literal container.
- better-auth owns identity/organization tables; the app writes them only via better-auth's
  server API.
- better-auth API/field names can vary by version — run `npx @better-auth/cli generate` after
  upgrades to reconcile the schema.
