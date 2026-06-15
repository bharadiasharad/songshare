# Contributing

Thanks for taking the time to contribute. This guide covers local setup, the conventions the
codebase follows, and what CI expects before a change can merge.

## Prerequisites

- **Node.js 20+** (the version CI and the Docker image use)
- **npm** (the repo ships a `package-lock.json`; use `npm ci` for reproducible installs)
- **Docker** + Docker Compose, or a reachable **MySQL 8** instance for local development

## Local setup

```bash
git clone <repo-url> && cd Myron
npm ci
cp .env.example .env          # for non-Docker dev, point DATABASE_URL at 127.0.0.1
npm run prisma:generate
npm run prisma:migrate        # create/apply the dev migration against your DB
npm run db:seed               # optional demo data
npm run start:dev             # watch mode
```

If you prefer the full stack in containers, `docker-compose up --build` starts MySQL + the API
with migrations applied. See [`README.md`](README.md) for details, and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the design rationale.

## Project layout

```
src/
├── main.ts            # bootstrap: body-parser split, helmet, CORS, ValidationPipe, Swagger
├── app.module.ts
├── config/            # typed config + Joi env validation (fails fast at boot)
├── prisma/            # PrismaModule + PrismaService (the shared client)
├── common/            # exception filter, logging interceptor, pagination DTO/helper
├── auth/              # better-auth instance, handler, guards, decorators
├── storage/           # StorageService interface + LocalDiskStorage + file-validation pipe
├── users/ organizations/ songs/ pitches/   # feature modules
└── scripts/seed.ts    # database seed (compiled to dist/scripts/seed.js for containers)
e2e/                   # Playwright API suite
prisma/                # schema.prisma + migrations
```

Each feature module follows the same shape:
`*.module.ts · *.controller.ts · *.service.ts · *.repository.ts · dto/ · *.mapper.ts`.

## Conventions

Follow the patterns already in the tree (see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)):

- **Respect the layers.** Controllers do HTTP only; services hold business rules,
  authorization, and `prisma.$transaction` boundaries; **repositories are the only place that
  touch `PrismaClient`**.
- **Never leak persistence shapes.** Map entities to response DTOs in `*.mapper.ts`; never return
  raw Prisma rows, internal FKs, `storageKey`, or auth columns.
- **Validate all input** with `class-validator` DTOs; the global `ValidationPipe` whitelists and
  rejects unknown fields.
- **Make composite writes atomic** with a nested create or `prisma.$transaction`.
- **Document endpoints** with `@ApiOperation` / `@ApiProperty` so `/docs` stays accurate.
- **Never write better-auth's tables directly** (`user`, `organization`, `member`, …) — go through
  `auth.api.*`.

## Database changes

1. Edit [`prisma/schema.prisma`](prisma/schema.prisma).
2. `npm run prisma:migrate` to generate a migration and update the client.
3. Commit the generated migration under `prisma/migrations/`.
4. If you changed better-auth config/plugins, run `npx @better-auth/cli generate` and reconcile
   the schema before migrating.

## Tests

```bash
npm run test            # Jest unit tests (fast, mocked, no DB)
npm run test:api        # Playwright end-to-end suite (needs a running, migrated API)
```

- Add **unit tests** for new service logic (authorization branches, error paths) — mock the
  repository and storage layers as the existing specs do.
- Extend the **Playwright suite** ([`e2e/api.spec.ts`](e2e/api.spec.ts)) for new endpoints,
  including the relevant negative cases (401/403/404/400).

## Before you open a PR

Run the same gates CI runs, in order — all must be green:

```bash
npm run lint:check      # eslint (type-checked) + prettier
npm run build           # nest build
npm run test            # unit tests
npm run test:api        # end-to-end (against a running, migrated instance)
```

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) — the existing history follows
them (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`). Keep each commit focused and the
working tree clean (no build artifacts, no `.env`, no uploads — these are git-ignored).

## Reporting issues

When filing a bug, include reproduction steps, the expected vs. actual behavior, and the relevant
log output (the API logs each request and returns a structured error envelope:
`{ statusCode, error, message, path, timestamp }`).
