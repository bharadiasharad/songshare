# Build Progress

Living checklist for the Song-Sharing Platform backend. Updated as work completes.

## Phase 1 — Boilerplate scaffold ✅
- [x] Root config & tooling (package.json, tsconfig, eslint, prettier, .env.example)
- [x] Docker & CI (Dockerfile, docker-compose, entrypoint, GitHub Actions)
- [x] Prisma schema (domain + better-auth) & seed
- [x] App foundation (main, config, prisma, common)
- [x] Auth & authorization module (better-auth, guards, decorators)
- [x] Storage module (Strategy/Factory, file validation)
- [x] Feature modules (users, organizations, songs, pitches)
- [x] Tests (unit + e2e) — 9 unit tests passing
- [x] README & SOLUTION docs
- [x] Verified: `build` ✅, `lint:check` ✅, `test` ✅ (9/9)

## Phase 2 — Review & hardening ✅
- [x] Generate initial Prisma migration (`prisma/migrations/20260615000000_init`) so `migrate deploy` works
- [x] Fix env load order for better-auth (`dotenv/config` first import in main.ts)
- [x] Add `/health` (liveness) and `/health/ready` (DB readiness) endpoints (public)
- [x] Add Helmet security headers (CSP off so Swagger UI loads)
- [x] Cap upload size at the multer layer + map MulterError → 413 in the exception filter
- [x] Re-run build + lint + tests — all green (build ✅, lint 0 problems, 9/9 tests)

## Phase 3 — Run & verify in Docker ✅
- [x] Commit boilerplate + plan as structured commits (branch `feat/boilerplate`)
- [x] Build + run full stack via `docker-compose` (app + mysql, migrations applied)
- [x] End-to-end happy path verified: signup/signin, role, org, link-by-email, song
      upload (transactional), list/filter, file stream, atomic pitch create, get pitch
- [x] Negative tests verified: 403 (role), 401 (no session), 404 (unknown email),
      400 (bad mime + validation) — all return the uniform error envelope
- [x] Swagger `/docs` renders (14 route groups)

### Fixes found during the live run
- [x] Corrected compiled entrypoint path `dist/src/main.js` → `dist/main.js` (Dockerfile + start:prod)
- [x] Decoupled host port from container port in compose (`HOST_PORT`), published on 3000

## Phase 4 — Optional
- [ ] Add GitHub remote and push the branch
- [ ] Migrate `package.json#prisma` seed config to `prisma.config.ts` (Prisma 7 readiness)

## Known limitations / future work
- better-auth uses its own PrismaClient (separate pool from PrismaService) — acceptable for a
  prototype; could be unified later.
- better-auth API/field names vary by version — run `npx @better-auth/cli generate` after upgrades.
