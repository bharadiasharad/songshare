# Architecture

This document is the durable design reference for the Song-Sharing Platform API. It explains
the layering, the domain model, the authorization model, and the deliberate trade-offs. For
setup and endpoint usage see [`../README.md`](../README.md); for the reflective write-up
(approach, AI usage, what I'd do next) see [`../SOLUTION.md`](../SOLUTION.md).

---

## 1. Context

A prototype backend where **managers** of songwriters run **organizations**, **songwriters**
upload songs into an organization, and managers create **pitches** (tags, description, target
artists) for those songs.

| Must-have requirement | Module(s) | Key endpoints |
|---|---|---|
| Authentication & user management | `auth`, `users` | `/api/auth/*`, `GET/PATCH /users/me`, `GET /users/:id` |
| Organization management | `organizations` | `POST /organizations`, `POST /organizations/:id/songwriters` |
| Song management (upload + files) | `songs`, `storage` | `POST /songs`, `GET /songs`, `GET /songs/:id/file` |
| Pitch creation | `pitches` | `POST /songs/:songId/pitches` |
| Complete domain schema | `prisma/schema.prisma` | see [§3](#3-data-model) |
| Nice-to-have: API docs | global | Swagger at `/docs` |
| Nice-to-have: listing/filtering | `songs`, `pitches` | `GET /songs?organizationId&genre&status&q&page&limit` |

---

## 2. Layering & design patterns

Strict single-responsibility layering; a request flows downward only:

```
Controller   HTTP only — route, validate DTO, Swagger, delegate. No business logic.
   │
Service      Business rules + authorization decisions + prisma.$transaction boundaries.
   │
Repository   The ONLY layer that touches PrismaClient. Encapsulates queries.
   │
PrismaService  One shared client (connects on module init, disconnects on shutdown).
```

Cross-cutting concerns live in `common/` and `auth/`.

| Pattern | Where | Why |
|---|---|---|
| Module / bounded context | one module per domain | decoupled domains, clear ownership |
| Repository | `*.repository.ts` | isolates Prisma so services depend on an abstraction and stay unit-testable |
| Dependency Injection | NestJS providers | inversion of control, trivial test substitution |
| DTO + Data Mapper | `dto/`, `*.mapper.ts` | validate input; never leak Prisma rows, FKs, `storageKey`, or auth columns |
| Strategy + Factory | `storage/` | `StorageService` interface + `LocalDiskStorage`, bound via the `STORAGE_SERVICE` token → S3/GCS is a one-provider swap |
| Decorator | `@CurrentUser`, `@Roles`, `@Public` | declarative access to request context |
| Guard chain | `AuthGuard → RolesGuard → OrgMembershipGuard` | composable, single-responsibility authorization |
| Unit of Work (atomicity) | `prisma.$transaction` in repositories/services | composite writes succeed or fail as one |
| Global exception filter | `common/filters` | one consistent JSON error envelope |

### Global contracts

- **Error envelope:** `{ statusCode, error, message, path, timestamp }` for every failure.
- **Pagination:** request `?page=1&limit=20`; response `{ data: [...], meta: { page, limit, total, totalPages } }`.
- **Validation:** global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.

---

## 3. Data model

> The brief stresses: *"your schema should model the complete domain, including entities and
> relationships you may not have time to fully implement."* The schema therefore goes beyond the
> MVP: versioned assets, publishing splits, a reusable artist catalog, and per-artist pitch
> outcomes. The full schema is in [`../prisma/schema.prisma`](../prisma/schema.prisma).

```
User ─< Member >─ Organization
User ─1:N─ Song (uploadedBy)
Organization ─1:N─ Song
Song ─1:N─ SongAsset                  (multiple files / versions: DEMO/STEM/MIX)
Song ─1:N─ SongCollaborator ─N:1─ User  (publishing splits / co-writers)
Song ─1:N─ Pitch ─N:1─ User (createdBy / manager)
Pitch ─N:M─ Tag (via PitchTag)
Pitch ─1:N─ PitchTarget ─N:1─ Artist    (per-artist pitch status lifecycle)
```

### Ownership of identity tables

`User` (extended with a `role` enum), `Session`, `Account`, `Verification`, `Organization`,
`Member`, and `Invitation` are **owned by better-auth**. The app's repositories *read* them but
never insert/update/delete them directly — all writes go through better-auth's server API so its
invariants (owner membership, active-org session state, hooks) stay intact. Domain tables
foreign-key into `user`/`organization`.

### Design notes

- **Cascade deletes** keep the graph consistent: deleting a `Song` removes its assets,
  collaborators and pitches; deleting a `Pitch` removes its tag/target join rows.
- **Indexes** back the real query paths: `(organizationId, status)`, `genre`, `uploadedById` on
  songs; `songId`, `status` on pitches.
- **Unique constraints** prevent duplicate memberships, collaborators, tag links and pitch
  targets.
- **`@db.Text`** for free-form long fields (`lyrics`, `description`, `note`).
- **`Decimal(5,2)`** for publishing split percentages — no floating-point drift.

---

## 4. Authentication & authorization

better-auth is framework-agnostic, so wiring it into NestJS needs care in two places.

**Mounting the handler.** A catch-all `ALL /api/auth/*` controller delegates to better-auth's
Node handler. better-auth must read the *raw* request stream, so the global JSON body parser is
disabled in `main.ts` and re-applied to every route **except** `/api/auth/*`.

**Session → request context.** A global `AuthGuard` validates the session
(`auth.api.getSession(fromNodeHeaders(req.headers))`) and attaches the principal to
`request.user`; `@Public()` opts a route out (health, auth, docs). `@CurrentUser()` reads it back.

**Roles.** `role` is a better-auth `additionalField`, self-selected at sign-up. Self-assignment
is acceptable for a prototype and documented as an assumption; production would gate `MANAGER`
behind an admin flow.

**Organization writes** go exclusively through better-auth's atomic server API
(`createOrganization`, `addMember`), so they sit *outside* the app's `prisma.$transaction`
boundaries.

### Authorization matrix

| Action | Allowed |
|---|---|
| Create organization | `MANAGER` |
| Link songwriter to org | `MANAGER` who is a member of that org |
| List/get org & members | any member of the org |
| Upload song | `SONGWRITER` who is a member of the target org |
| List/get songs, stream file | any member of the song's org |
| Update/delete song | song uploader **or** a `MANAGER` of the song's org |
| Create pitch | `MANAGER` of the song's org |
| List/get pitches | any member of the song's org |
| Update pitch | pitch creator **or** a `MANAGER` of the song's org |

Guards stay cheap (session, role, membership); resource-level checks that need a DB lookup
(ownership, deriving the org from a song/pitch) live in the **service** layer, which is
authoritative.

---

## 5. File storage & upload security

`StorageService` is an interface with one implementation, `LocalDiskStorage`, bound through the
`STORAGE_SERVICE` token. Swapping in S3/GCS touches only that provider mapping.

- **Path-traversal safe keys:** `storageKey = ${uuid}${safeExtension}`. The client filename never
  influences the path, and a resolved key is asserted to stay within `UPLOAD_DIR`.
- **Files are never statically served** — bytes are only returned via the authorized streaming
  endpoint (`GET /songs/:id/file`), which sets `Content-Type`/`Content-Disposition` and never
  exposes the disk path or `storageKey`.
- **Upload pipeline:** multer size cap → `FileValidationPipe` (audio MIME whitelist + size) →
  write file → create `Song` + `SongAsset` atomically. If the DB write fails after the file is
  written, the orphan is removed.
- **Durability in Docker:** `UPLOAD_DIR` is a named volume so uploads survive restarts.

---

## 6. Testing

Two layers, both run in CI:

- **Unit tests (Jest)** isolate business logic by mocking the repository and storage layers —
  e.g. the song-upload storage-cleanup-on-failure path and the pitch/song authorization branches.
- **End-to-end (Playwright)** drives the real HTTP API (and the real better-auth stack) as **BDD
  flows** — each `test` is a complete user journey expressed in `Given/When/Then` steps, covering
  onboarding, upload, pitching, the cascade lifecycle, multi-org isolation, the authorization
  matrix, co-manager pitching, and pagination/filtering at scale, plus the 401/403/404/400
  negatives. Flows are self-contained (each provisions its own uniquely-suffixed actors/data), so
  they are independent and repeatable against a persistent database.

Every API call is attached to the HTML report (request + response, with `Cookie`/`Set-Cookie`/
`Authorization` masked) via a small `APIRequestContext` proxy, making the report a living,
shareable record of the API's behaviour. CI boots the compiled app against a MySQL service and
runs the suite on every push/PR.

---

## 7. Trade-offs & future work

**Prioritized:** a complete, well-indexed schema; clean layering; transactional integrity; a
working one-command startup; Swagger + filtering; and an end-to-end test suite — the things this
design is graded on.

**Modeled but intentionally not exposed via endpoints** (demonstrating domain depth):
`SongAsset` versioning/kinds, `SongCollaborator` splits, the reusable `Artist` catalog, the
`PitchTarget` `PENDING→INTERESTED→PASSED→CUT` lifecycle, and better-auth `Invitation` (ready for
an email-invite flow).

**What I'd add next:**

- Per-organization roles (the `Member` table already supports them) instead of a single user role.
- Cursor-based pagination and full-text search on songs.
- An S3 storage strategy with signed URLs and background audio-metadata extraction.
- Pitch sharing/notifications and an activity audit log.
- Request rate limiting, and a unified PrismaClient between the app and better-auth.

### Known limitations

- better-auth uses its **own** PrismaClient (a separate connection pool from `PrismaService`) —
  acceptable for a prototype; could be unified later.
- better-auth's API/field names can vary by version. After upgrading, run
  `npx @better-auth/cli generate` and reconcile `schema.prisma` + `src/auth/auth.ts`, then create
  a migration.
