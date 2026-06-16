# SOLUTION.md

## Approach

I treated the brief as a small but real product slice rather than a throwaway demo. I started
by modeling the **complete domain** (the part the brief explicitly grades), then built a thin
vertical slice of API over it, prioritizing the five Must-Haves plus Swagger and song
listing/filtering. The detailed design lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
(layering, data model, auth/authorization, storage, trade-offs).

Architecture is a NestJS modular monolith with strict layering:

```
Controller (HTTP) → Service (rules + transactions) → Repository (Prisma) → PrismaService
```

Guards (`AuthGuard → RolesGuard → OrgMembershipGuard`), a global validation pipe, a uniform
error-envelope exception filter, and a logging interceptor handle cross-cutting concerns.

## AI usage

I used an AI coding assistant (Claude) to: pressure-test the data model, scaffold the repetitive
controller/service/repository/mapper layers consistently, and draft the Docker/CI/test setup.
What worked well: generating consistent boilerplate fast and catching an early design flaw
(writing better-auth's organization tables directly). What needed human judgement: the
better-auth ↔ NestJS integration (raw-body handling, session extraction) and deciding exactly
which writes need transactions — those are version- and domain-specific.

## Database design

- **better-auth owns identity/org tables** (`User`, `Session`, `Account`, `Verification`,
  `Organization`, `Member`, `Invitation`). The domain extends `User` with a `role` enum and
  foreign-keys into `User`/`Organization`. App code never writes the auth/org tables directly —
  only via better-auth's server API — to preserve its invariants.
- **Domain depth beyond MVP**: `SongAsset` (versioned files, DEMO/STEM/MIX), `SongCollaborator`
  (publishing splits via `Decimal`), a reusable `Artist` catalog, and `PitchTarget` with a
  per-artist status lifecycle. Tags are a normalized many-to-many.
- **Indexes** back the real query paths: `(organizationId, status)`, `genre`, `uploadedById`
  on songs; `songId`, `status` on pitches. Unique constraints prevent duplicate memberships,
  collaborators, tag links and pitch targets.
- **Cascades** keep the graph consistent (deleting a song removes its assets/collaborators/
  pitches; deleting a pitch removes its tag/target join rows).

## Trade-offs (what I prioritized and why)

- **Atomicity over micro-optimization**: composite writes (song + asset, pitch + tags +
  targets) use a single nested create or `prisma.$transaction`, so they're all-or-nothing. The
  song upload also removes the stored file if the DB write fails, preventing orphans.
- **better-auth server API over direct table writes**: slightly less control, far more
  correctness and forward-compatibility.
- **Offset pagination** (simple, predictable) over cursor pagination (better at scale) for a
  prototype.
- **Local-disk storage behind an interface** instead of cloud storage — the brief says local
  filesystem, and the `STORAGE_SERVICE` token makes S3/GCS a one-line swap later.
- **Role at user level** (self-selected at sign-up) over per-org roles — matches the brief's
  framing; the `Member` table already supports per-org roles when needed.

## Improvements with more time

- Replace the single user role with per-organization roles (the schema already supports it).
- Cursor-based pagination and full-text search on songs.
- S3 storage strategy + signed URLs + background audio metadata extraction.
- Pitch sharing/notifications and an audit log; richer `PitchTarget` workflow endpoints.
- Request rate limiting, and remaining test coverage (transaction-rollback paths) on top of the
  current Jest unit tests and the 14 Playwright BDD flows — which already cover the authorization
  matrix, multi-org isolation and pagination at scale.

## Challenges

- **The same `DATABASE_URL` doesn't work everywhere.** Inside `docker-compose` the database host
  is the `mysql` service name; for local development it's `127.0.0.1`. Making "clone → copy
  `.env` → run" smooth in both modes meant calling this out explicitly in `.env.example` and the
  README so the first run doesn't fail on a connection error.
- **Cookie-based auth is fiddly to wire.** The session cookie only round-trips when CORS is set up
  with `credentials` and the request's `Origin` is allow-listed, and better-auth needs the *raw*
  request body — so the global JSON parser is disabled and re-applied to every route except
  `/api/auth/*`. Getting sign-in to reliably set and return the session was the trickiest part.
- **Keeping multi-step writes consistent.** Deciding which operations need a transaction: wrapping
  the composite domain writes (song + asset, pitch + tags + targets) in `prisma.$transaction`,
  leaving org/member operations to better-auth's own atomic API, and deleting an uploaded file if
  the DB write fails so no orphans are left behind.
