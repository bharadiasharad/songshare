# 06 — Implementation Steps (dependency-ordered)

1. **Scaffold** — `nest new`; install `@nestjs/config @nestjs/swagger class-validator
   class-transformer prisma @prisma/client better-auth multer @types/multer uuid`; configure
   eslint/prettier; create folder skeleton from [01](01-architecture-patterns.md).
2. **Config module** — `@nestjs/config` global, with env validation (joi/zod). Vars:
   `DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, PORT, UPLOAD_DIR, MAX_UPLOAD_BYTES`.
   Create `.env.example`.
3. **Prisma** — author full `schema.prisma` ([02](02-data-model.md)); `prisma migrate dev`
   initial migration; `PrismaModule` + `PrismaService` (connect on `onModuleInit`).
4. **better-auth** — `auth/auth.ts` instance (Prisma adapter, organization plugin, `role`
   field); generate/merge auth models; mount `ALL /api/auth/*` handler with body-parser
   exclusion; `AuthGuard` + `@CurrentUser`.
5. **AuthZ primitives** — `@Roles` + `RolesGuard`, `OrgMembershipGuard`, `@CurrentOrg`,
   `@Public` decorator.
6. **Common layer** — global `ValidationPipe`, `AllExceptionsFilter` (error envelope),
   `LoggingInterceptor`, `PaginationQueryDto` + paginated-response helper, `BaseMapper`.
7. **Storage module** — `StorageService` interface + `LocalDiskStorage` + factory provider +
   `FileValidationPipe`.
8. **Users module** — repository/service/controller/mapper (`/users/me`, profile, role).
9. **Organizations module** — create org via `auth.api.createOrganization`; link songwriter by
   **email** (resolve email→user, 404 if absent, then `auth.api.addMember`); list/get/members
   read-only via Prisma. No direct writes to better-auth tables.
10. **Songs module** — multipart upload → `$transaction`(Song + storage.put + SongAsset
    [+ collaborators]); list/filter with pagination; get/patch/delete (delete removes files);
    streaming endpoint.
11. **Pitches module** — create in `$transaction`(Pitch + `connectOrCreate` Tags via PitchTag +
    PitchTargets with `connectOrCreate` Artists); list/get/patch.
12. **Swagger** — `SwaggerModule` at `/docs`; DTO/`@ApiProperty` decorators; cookie auth scheme;
    document multipart upload.
13. **Docker** — Dockerfile + compose + entrypoint (see [07](07-docker-ops.md)).
14. **Docs** — `README.md` (setup + endpoints + curl examples) and `SOLUTION.md` (approach, AI
    usage, DB design, trade-offs, improvements, challenges).

## Atomicity ledger
Our domain writes use `prisma.$transaction`. Org/member operations are atomic **inside
better-auth's own API** (not our transactions), so they're listed separately.

| Operation | Mechanism | Rollback behavior |
|---|---|---|
| Create org | `auth.api.createOrganization` (org + owner member) | atomic within better-auth |
| Link songwriter | resolve email → `auth.api.addMember` | single atomic add; 404 before any write if email unknown |
| Upload song | `$transaction`: `Song` (+ `SongAsset`, + collaborators) | DB rollback; written file removed in catch |
| Create pitch | `$transaction`: `Pitch` + `connectOrCreate` Tags + `PitchTag` + `PitchTarget`(+`connectOrCreate` Artist) | bad target ⇒ **zero** rows persisted |
| Update pitch (tags/targets) | `$transaction`: diff + delete/create join rows | all-or-nothing |
