# Implementation Plan — Song-Sharing Platform Backend

This folder is the full implementation plan for the prototype backend API described in
[`../requirement.md`](../requirement.md). It is written **before any application code** so the
approach can be reviewed and iterated on.

## How to read these docs

| Doc | Purpose |
|---|---|
| [00-context-assumptions.md](00-context-assumptions.md) | Problem, requirement→coverage traceability, assumptions |
| [01-architecture-patterns.md](01-architecture-patterns.md) | Layering, modules, design patterns + rationale |
| [02-data-model.md](02-data-model.md) | Full Prisma schema, enums, indexes, ERD |
| [03-api-spec.md](03-api-spec.md) | Every endpoint: method, DTO, response, errors |
| [04-authn-authz.md](04-authn-authz.md) | better-auth wiring + authorization matrix |
| [05-file-storage.md](05-file-storage.md) | Storage strategy, upload security, streaming |
| [06-implementation-steps.md](06-implementation-steps.md) | Ordered, dependency-aware build sequence |
| [07-docker-ops.md](07-docker-ops.md) | Dockerfile, compose, env, migrations, seed |
| [08-verification.md](08-verification.md) | End-to-end curl script + negative tests |
| [09-risks-future-work.md](09-risks-future-work.md) | Risks, trade-offs, modeled-but-not-built |
| [10-execution-checklist.md](10-execution-checklist.md) | **Readiness verdict + phase-by-phase build checklist** |

## Decisions locked in
- **Scaffold from scratch** (no template present in repo).
- **ATOMIC = both**: every multi-step write wrapped in `prisma.$transaction` (atomicity) **and**
  strict single-responsibility layering (thin controllers → services → repositories).
- **Scope**: 5 Must-Haves + full domain schema + Swagger/OpenAPI + song listing/filtering.

## Tech stack
Node.js · TypeScript · NestJS · MySQL · Prisma ORM · better-auth · Docker Compose · Swagger.
