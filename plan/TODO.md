# Project TODO

Single consolidated checklist. Ticked as completed.

## Build — boilerplate
- [x] Root config & tooling (package.json, tsconfig, eslint, prettier)
- [x] Docker & CI (Dockerfile, docker-compose, entrypoint, GitHub Actions)
- [x] Prisma schema (domain + better-auth) + baseline migration + seed
- [x] App foundation (main, config, prisma, common cross-cutting)
- [x] Auth & authorization (better-auth, guards, decorators)
- [x] Storage module (Strategy/Factory + file validation)
- [x] Feature modules: users, organizations, songs, pitches
- [x] Health endpoints (/health, /health/ready)
- [x] README + SOLUTION + plan docs
- [x] Static checks: `build` ✅, `lint:check` ✅ (0), unit `test` ✅ (9/9)

## Review & hardening
- [x] Generate baseline migration so `migrate deploy` works in Docker
- [x] `dotenv/config` first import (better-auth env at load time)
- [x] Helmet security headers
- [x] Multer upload cap + MulterError → 413 mapping

## Run & verify in Docker
- [x] Start Docker daemon
- [x] `docker-compose up --build` (app + mysql, migrations applied)
- [x] Fix: entrypoint path `dist/src/main.js` → `dist/main.js`
- [x] Fix: decouple host port via `HOST_PORT` (published on 3000 locally)
- [x] Live happy path: signup/signin, role, org, link-by-email, upload, list,
      stream, pitch create, get pitch
- [x] Live negatives: 403 role, 401 no-session, 404 unknown email, 400 mime/validation
- [x] Swagger `/docs` renders

## Local automated tests
- [x] Unit suite locally (9/9)
- [x] E2E jest suite locally (3/3) — added ESM auth mocks + jest mapper
      (reached container MySQL via IPv6 `[::1]` to bypass a native MariaDB on 3306)

## Continue testing
- [x] PATCH /songs/:id — owner updates status/bpm (200)
- [x] DELETE /songs/:id (204) → GET returns 404; cascade removes pitch
- [x] PATCH /pitches/:id — atomic tag/target replacement (indie / Lorde)
- [x] GET /organizations/:id/members — owner + linked member with names/emails
- [x] Non-member download → 403
- [x] Seed script (`db:seed`) — runs under ts-node, creates demo data

## Optional / follow-up
- [x] On GitHub remote — `origin/main` (github.com/bharadiasharad/songshare) in sync with all commits
- [ ] Migrate `package.json#prisma` seed config to `prisma.config.ts` — DEFERRED:
      cosmetic Prisma-7 deprecation warning only, and adding prisma.config.ts disables
      Prisma's automatic `.env` loading (would risk local `migrate dev`/`db seed`). Not worth it now.
