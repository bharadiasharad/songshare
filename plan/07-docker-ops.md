# 07 — Docker & Operations

## docker-compose.yml (two services, one command)
```yaml
services:
  mysql:
    image: mysql:8
    environment:
      MYSQL_DATABASE: songshare
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
    volumes: [ db_data:/var/lib/mysql ]
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-p${MYSQL_ROOT_PASSWORD}"]
      interval: 5s
      timeout: 5s
      retries: 10

  app:
    build: .
    env_file: .env
    ports: [ "3000:3000" ]
    depends_on:
      mysql: { condition: service_healthy }
    volumes: [ uploads:/app/uploads ]

volumes:
  db_data:
  uploads:
```

## Dockerfile (multi-stage, non-root)
- Base image **`node:20-slim`** (or `node:22-slim`) pinned for reproducibility.
- **deps** stage: install all deps, `prisma generate`.
- **build** stage: `nest build`.
- **runtime** stage: slim node image, copy `dist/`, `node_modules`, `prisma/`; create non-root
  user; `UPLOAD_DIR=/app/uploads`; entrypoint script.

## Entrypoint
```sh
#!/bin/sh
npx prisma migrate deploy      # apply migrations against the healthy DB
node dist/main.js
```
(DB readiness handled by compose `depends_on: condition: service_healthy`.)

## .env.example
```
DATABASE_URL="mysql://root:rootpw@mysql:3306/songshare"
MYSQL_ROOT_PASSWORD="rootpw"
BETTER_AUTH_SECRET="change-me-32+chars"
BETTER_AUTH_URL="http://localhost:3000"
PORT=3000
UPLOAD_DIR="/app/uploads"
MAX_UPLOAD_BYTES=26214400
```

## Optional seed (`prisma/seed.ts`)
Creates a demo manager, organization, linked songwriter, one song (+asset), and one pitch
(tags + targets) so reviewers see data immediately. Run via `prisma db seed` (gated behind a
flag so production-style runs stay clean).

## .gitignore (to add)
`node_modules/`, `dist/`, `.env`, `uploads/`, `*.log`.
