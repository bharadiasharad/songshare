# 01 — Architecture & Design Patterns

## Layering (single responsibility per layer)
```
Controller   HTTP only: route, validate DTO, Swagger docs, delegate. No business logic.
   │
Service      Business rules + authorization decisions + prisma.$transaction boundaries.
   │
Repository   The ONLY layer that touches PrismaClient. Encapsulates queries.
   │
PrismaService  Singleton client (connect on module init).
```
Cross-cutting concerns live in `common/` and `auth/`: Guards, Decorators, Interceptors,
Exception Filter, Config.

## Folder structure
```
src/
├── main.ts                 # bootstrap: global ValidationPipe, exception filter, interceptors, Swagger
├── app.module.ts
├── config/                 # ConfigModule + env validation schema (joi/zod)
├── prisma/                 # PrismaModule, PrismaService
├── common/
│   ├── filters/            # AllExceptionsFilter → uniform error envelope
│   ├── interceptors/       # LoggingInterceptor, (optional) TransformInterceptor
│   ├── dto/                # PaginationQueryDto, paginated response helper
│   └── mappers/            # BaseMapper contract
├── auth/                   # better-auth instance, handler controller, AuthGuard, guards, decorators
├── storage/                # StorageService interface + LocalDiskStorage + factory provider
├── users/                  # users.module/controller/service/repository, dto/, users.mapper
├── organizations/
├── songs/
└── pitches/
```
Each domain module follows the same shape: `*.module.ts`, `*.controller.ts`, `*.service.ts`,
`*.repository.ts`, `dto/`, `*.mapper.ts`.

## Design patterns and why each is used

| Pattern | Where | Why |
|---|---|---|
| **Module / bounded context** | one module per domain | decouples domains, clear ownership |
| **Repository** | `*.repository.ts` | isolates Prisma; services depend on abstractions → testable |
| **Dependency Injection** | NestJS providers | inversion of control, easy substitution |
| **DTO + Data Mapper** | `dto/`, `*.mapper.ts` | validate input; never leak Prisma rows/file paths/auth cols |
| **Strategy + Factory** | `storage/` | `StorageService` interface, `LocalDiskStorage` impl, factory token → S3 drop-in |
| **Decorator** | `@CurrentUser`, `@CurrentOrg`, `@Roles` | clean, declarative access to request context |
| **Guard chain (Chain of Responsibility)** | `AuthGuard → RolesGuard → OrgMembershipGuard` | composable authorization |
| **Global Exception Filter** | `common/filters` | one consistent JSON error envelope |
| **Atomicity (Unit of Work)** | `prisma.$transaction` in services | composite writes succeed/fail as one |

## Global contracts
- **Error envelope:** `{ statusCode, error, message, path, timestamp }`.
- **Pagination:** request `?page=1&limit=20`; response `{ data:[...], meta:{ page, limit, total, totalPages } }`.
- **Validation:** global `ValidationPipe({ whitelist:true, forbidNonWhitelisted:true, transform:true })`.
