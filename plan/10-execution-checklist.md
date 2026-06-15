# 10 — Execution Checklist & Readiness

## Readiness verdict: ✅ Ready to execute
The plan is internally consistent and maps every Must-Have in `requirement.md` to a module and
endpoints. The previously-open risk (writing better-auth's org tables directly) is resolved:
org/member operations now go through `auth.api.*`. Remaining unknowns are normal
implementation-time lookups (exact better-auth API signatures), not design gaps.

**One thing to confirm during step 4 (not a blocker):** the exact shape of
`auth.api.addMember` / `createOrganization` in the installed better-auth version — verify
against the version's docs/types and adjust the call sites if the API differs.

---

## Prerequisites (one-time)
- [ ] Docker + Docker Compose installed and running.
- [ ] Node 20+ and npm locally (for scaffolding/generators outside the container).
- [ ] Confirm the three locked decisions: link **by email**, org writes via **better-auth API**,
      scope = **MVP + Swagger + listing**.

---

## Phase A — Project foundation
- [ ] `nest new` scaffold; set up eslint/prettier; create folder skeleton ([01](01-architecture-patterns.md)).
- [ ] Install deps: `@nestjs/config @nestjs/swagger class-validator class-transformer prisma
      @prisma/client better-auth multer @types/multer uuid` (+ env validator joi/zod).
- [ ] `ConfigModule` + env validation schema; write `.env.example` ([07](07-docker-ops.md)).
- [ ] `.gitignore` (`node_modules`, `dist`, `.env`, `uploads/`, `*.log`).
- **Done when:** `npm run start:dev` boots an empty app and reads validated env.

## Phase B — Data layer
- [ ] Author full `prisma/schema.prisma` ([02](02-data-model.md)) incl. enums, indexes, cascades.
- [ ] `npx @better-auth/cli generate` to produce auth/org models; merge into schema.
- [ ] `prisma migrate dev --name init`; `PrismaModule` + `PrismaService` (connect on init).
- **Done when:** migration applies to a local MySQL and `prisma studio` shows all tables.

## Phase C — Auth & authorization
- [ ] `auth/auth.ts` better-auth instance (Prisma adapter MySQL, organization plugin, `role`).
- [ ] Mount `ALL /api/auth/*` via `toNodeHandler`; **exclude from JSON body parser** ([04](04-authn-authz.md)).
- [ ] `AuthGuard` (+ global registration with `@Public` opt-out), `@CurrentUser`, `@CurrentOrg`.
- [ ] `@Roles` + `RolesGuard`; `OrgMembershipGuard`.
- **Done when:** sign-up/sign-in via curl returns a session cookie and `GET /api/auth/get-session` works.

## Phase D — Cross-cutting common layer
- [ ] Global `ValidationPipe` (whitelist + transform); `AllExceptionsFilter` (error envelope).
- [ ] `LoggingInterceptor`; `PaginationQueryDto` + paginated-response helper; `BaseMapper`.
- **Done when:** a thrown domain error returns the uniform envelope; bad DTO returns 400.

## Phase E — Storage
- [ ] `StorageService` interface + `LocalDiskStorage` + factory provider token.
- [ ] `FileValidationPipe` (mime whitelist + size cap + magic-byte sniff) ([05](05-file-storage.md)).
- **Done when:** a unit-level call writes a file under `UPLOAD_DIR` and streams it back.

## Phase F — Domain modules (controller → service → repository → mapper each)
- [ ] **Users**: `GET/PATCH /users/me`, `GET /users/:id`.
- [ ] **Organizations**: create (`auth.api.createOrganization`), link by email
      (`auth.api.addMember`), list/get/members.
- [ ] **Songs**: upload (`$transaction` Song+Asset[+collaborators]; remove file on rollback),
      list+filter+paginate, get/patch/delete, stream `/songs/:id/file`.
- [ ] **Pitches**: create (`$transaction` Pitch + connectOrCreate Tags/Artists + targets),
      list/get/patch.
- **Done when:** the full happy-path curl flow in [08](08-verification.md) passes.

## Phase G — Docs & API surface
- [ ] Swagger at `/docs` with DTO `@ApiProperty`, cookie auth scheme, multipart documented.
- **Done when:** `/docs` lists and can exercise every endpoint.

## Phase H — Containerization
- [ ] Multi-stage `Dockerfile` (node:20-slim, non-root) + entrypoint (`prisma migrate deploy`).
- [ ] `docker-compose.yml` (mysql healthcheck + app + named volumes).
- **Done when:** `cp .env.example .env && docker-compose up --build` yields a working API.

## Phase I — Deliverable docs
- [ ] `README.md`: setup (clone → copy .env → `docker-compose up`), endpoint table, curl examples, assumptions.
- [ ] `SOLUTION.md`: approach, AI usage, DB design rationale, trade-offs, improvements, challenges.
- [ ] (Optional) `prisma/seed.ts` demo data.

---

## Final submission checklist
- [ ] `docker-compose up` works from a clean clone with only `.env` copied.
- [ ] All Must-Haves demonstrable via README curl examples.
- [ ] Swagger renders at `/docs`.
- [ ] Negative tests in [08](08-verification.md) behave as specified (403/404/400/401, atomic rollback).
- [ ] `.env.example`, migrations, README, SOLUTION.md committed; secrets not committed.
- [ ] Repo pushed to GitHub (add remote: `git remote add origin <url>` then `git push -u origin master`).

## Suggested commit checkpoints
After each phase (A–I), commit with a focused message so history reads as a clean build log.
