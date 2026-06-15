# 00 — Context & Assumptions

## Problem
Prototype backend for a song-sharing platform connecting **songwriter managers** with
**songwriters** inside **organizations**:
- Managers create organizations and **direct-link** songwriters.
- Songwriters **upload songs** (audio file + metadata) into their org.
- Managers **review songs** and create **pitches** (tags, description, target artists).

Evaluation emphasizes API design, data modeling, and effective use of modern tooling. Graders'
explicit notes: *"Working code > perfect code"*, *"Document your decisions"*, and *"schema
should model the complete domain — beyond just the MVP."*

## Requirement → coverage traceability

| Must-Have | Module | Endpoints |
|---|---|---|
| 1. Auth & user management | `auth`, `users` | better-auth `/api/auth/*`, `GET/PATCH /users/me`, `GET /users/:id` |
| 2. Organization management | `organizations` | `POST /organizations`, `POST /organizations/:id/songwriters` |
| 3. Song management | `songs`, `storage` | `POST /songs`, `GET /songs`, `GET /songs/:id/file` |
| 4. Pitch creation | `pitches` | `POST /songs/:songId/pitches` |
| 5. Complete DB schema | `prisma/schema.prisma` | see [02-data-model.md](02-data-model.md) |
| Nice: Swagger | global | `/docs` |
| Nice: listing/filtering | `songs` | `GET /songs?organizationId&genre&status&q&page&limit` |

## Assumptions (to be restated in SOLUTION.md)
1. **Single user-level role** (`MANAGER` | `SONGWRITER`) stored on the user, not per-org.
   Requirement phrases roles as a user attribute; easily extended to per-org membership roles.
   Role is **self-selected at sign-up** (passed as a better-auth `additionalField`); for a
   prototype, self-assignment is acceptable and documented.
2. **Direct linking** of songwriters to orgs — no email invite system. The manager links a
   songwriter **by email**; the service resolves the email to a user and adds the membership.
3. **docker-compose with two services** (`app` + `mysql`) instead of one literal container —
   the deliverable is `docker-compose.yml` with one-command startup; cleaner and standard.
4. **better-auth owns** identity & org tables (`user`, `session`, `account`, `verification`,
   `organization`, `member`, `invitation`); domain tables foreign-key into `user`/`organization`.
   We **never write these tables directly** — org/member changes go through better-auth's
   server API (`auth.api.createOrganization`, `auth.api.addMember`) to preserve its invariants.
5. **Local filesystem** storage behind a swappable interface (Strategy/Factory).
6. Authenticated session via **cookie** (better-auth default); curl examples use a cookie jar.
