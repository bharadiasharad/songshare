# 04 — Authentication & Authorization

This is the highest-risk integration: better-auth is framework-agnostic, so wiring it into
NestJS requires care around the request body parser and session extraction.

## better-auth instance
```ts
// auth/auth.ts
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "mysql" }),
  emailAndPassword: { enabled: true },
  plugins: [ organization() ],
  user: { additionalFields: { role: { type: "string", required: false, defaultValue: "SONGWRITER" } } },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});
```

## Mounting the handler in NestJS
- Expose a catch-all route `ALL /api/auth/*` that delegates to better-auth's Node handler:
  `toNodeHandler(auth)(req, res)`.
- **Critical:** exclude `/api/auth/*` from NestJS's global JSON body parser
  (`NestFactory.create(AppModule, { bodyParser: false })` and apply `express.json()` only to
  non-auth routes, **or** mount the auth handler before the body parser). better-auth needs the
  raw request stream; double-parsing breaks sign-in.
- CORS/credentials configured so the session cookie round-trips.

## Session → request context
```ts
// auth/auth.guard.ts (AuthGuard)
const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
if (!session) throw new UnauthorizedException();
req.user = { id: session.user.id, role: session.user.role, ... };
```
- `@CurrentUser()` param decorator reads `req.user`.
- `@CurrentOrg()` resolves the org id from route param/body for org-scoped handlers.

## Sign-up & role
`role` is a better-auth `additionalField`. Clients may pass `role` in the sign-up body (or set
it later via `PATCH /users/me`). Self-assignment is acceptable for this prototype and documented
as an assumption; a production system would gate MANAGER assignment behind an admin flow.

## Organization & membership writes (via better-auth server API)
Organizations and memberships live in better-auth's tables and **must not be written directly**.
Our services call better-auth's server API so its invariants (owner membership, active-org
session state, hooks) stay intact:
- **Create org** → `auth.api.createOrganization({ body: { name, slug }, headers })`; the caller
  becomes the owner member automatically. Our `RolesGuard` still restricts this to MANAGER.
- **Link songwriter** → resolve `email` to a user via `UsersRepository` (404 if not found),
  then `auth.api.addMember({ body: { userId, organizationId, role: "member" }, headers })`.
- **Read** org/members → query through Prisma (read-only) for our response shapes.

These calls are atomic within better-auth itself, so they sit **outside** our `prisma.$transaction`
boundaries (see the atomicity ledger in [06](06-implementation-steps.md)).

## Guard chain (composable, single responsibility each)
1. **AuthGuard** — valid session or 401. Applied globally (with `@Public()` opt-out for `/api/auth/*` and `/docs`).
2. **RolesGuard** — reads `@Roles(MANAGER|SONGWRITER)` metadata; 403 if role mismatch.
3. **OrgMembershipGuard** — for org-scoped routes, checks the user is a `Member` of the target
   org (via `OrganizationsRepository`); 403 otherwise.

## Authorization matrix
| Action | Allowed |
|---|---|
| Create organization | MANAGER |
| Link songwriter to org | MANAGER who is a member of that org |
| List/get org, members | Any member of the org |
| Upload song | SONGWRITER who is a member of the target org |
| List/get songs, stream file | Any member of the song's org |
| Update/delete song | Song uploader **or** a MANAGER of the song's org |
| Create pitch | MANAGER of the song's org |
| List/get pitches | Any member of the song's org |
| Update pitch | Pitch creator **or** a MANAGER of the song's org |

Ownership/role checks that need DB lookups live in the **service** layer (after guards), keeping
guards cheap and services authoritative for resource-level authorization.
