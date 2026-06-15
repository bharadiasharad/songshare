# 09 — Risks, Trade-offs & Future Work

## Risks & mitigations
| Risk | Mitigation |
|---|---|
| better-auth ↔ NestJS body-parser conflict (breaks sign-in) | Mount auth handler before/excluded from JSON body parser; verify in step 4 |
| MySQL enum migrations are rigid | Keep enums stable; widen with explicit migrations; consider lookup tables later |
| Multipart + Swagger documentation quirks | Use `@ApiConsumes('multipart/form-data')` + explicit body schema |
| Orphaned files if DB write fails post-upload | `try/catch` removes `storageKey` on rollback (see [05](05-file-storage.md)) |
| Role stored at user level limits multi-org nuance | Documented assumption; `Member` table already supports per-org roles for later |
| Container DB data loss | Named volumes for `db_data` and `uploads` |

## Trade-offs (prioritization)
- **Prioritized:** a complete, well-indexed schema; clean layering; transactional integrity;
  working `docker-compose up`; Swagger + filtering — these are what the assignment grades.
- **Deferred:** automated tests (explicitly out of scope), email invites (out of scope),
  audio metadata extraction, advanced pitch workflow UI.

## Modeled-but-not-fully-built (demonstrates domain depth)
Present in the schema, exposed minimally or left as future endpoints:
- **`SongAsset` versioning / kinds** (DEMO/STEM/MIX, `version`) — multiple files per song.
- **`SongCollaborator` splits** — publishing percentages across co-writers.
- **`Artist` catalog** — reusable target artists rather than free-text per pitch.
- **`PitchTarget` lifecycle** — per-artist `PENDING→INTERESTED→PASSED→CUT`.
- **`Invitation`** (better-auth) — ready for an email-invite flow beyond direct linking.

## What I'd add with more time
- Cursor-based pagination + full-text search on songs.
- Role-scoped per-org permissions (replace single user role).
- S3 storage strategy + signed URLs + background audio metadata extraction.
- Pitch sharing/notifications and an activity audit log.
- Automated e2e tests around the authorization matrix and transaction rollbacks.
