# 03 — API Specification

All non-auth routes require a valid better-auth session (cookie). Roles enforced by guards.
Errors use the envelope `{ statusCode, error, message, path, timestamp }`.

## Auth (handled by better-auth at `/api/auth/*`)
| Method | Path | Body |
|---|---|---|
| POST | `/api/auth/sign-up/email` | `{ name, email, password }` |
| POST | `/api/auth/sign-in/email` | `{ email, password }` → sets session cookie |
| POST | `/api/auth/sign-out` | — |
| GET | `/api/auth/get-session` | — → current session/user |

## Users
| Method | Path | Role | Request | Response |
|---|---|---|---|---|
| GET | `/users/me` | any | — | current user profile (`id,name,email,role`) |
| PATCH | `/users/me` | any | `UpdateUserDto { name?, role? }` | updated profile |
| GET | `/users/:id` | any | — | public profile |

## Organizations
| Method | Path | Role | Request | Response |
|---|---|---|---|---|
| POST | `/organizations` | MANAGER | `CreateOrgDto { name, slug? }` | org (via `auth.api.createOrganization`; creator becomes owner member) |
| GET | `/organizations` | any | — | orgs the user belongs to |
| GET | `/organizations/:id` | member | — | org detail |
| POST | `/organizations/:id/songwriters` | MANAGER (of org) | `LinkSongwriterDto { email }` | created membership (resolve email→user, then `auth.api.addMember`) |
| GET | `/organizations/:id/members` | member | — | members list |

## Songs
| Method | Path | Role | Request | Response |
|---|---|---|---|---|
| POST | `/songs` | SONGWRITER (member) | multipart: `file` + `CreateSongDto { organizationId, title, primaryArtist?, durationSec?, bpm?, musicalKey?, genre?, lyrics? }` | created song + asset |
| GET | `/songs` | member | query: `organizationId?, genre?, status?, songwriterId?, q?, page?, limit?` | paginated songs |
| GET | `/songs/:id` | member | — | song detail (assets, collaborators) |
| GET | `/songs/:id/file` | member | — | streamed audio (`Content-Type`, `Content-Disposition`) |
| PATCH | `/songs/:id` | uploader / org manager | `UpdateSongDto` (partial metadata, status) | updated song |
| DELETE | `/songs/:id` | uploader / org manager | — | 204; removes asset files |

## Pitches
| Method | Path | Role | Request | Response |
|---|---|---|---|---|
| POST | `/songs/:songId/pitches` | MANAGER (of song's org) | `CreatePitchDto { description, status?, tags?: string[], targetArtists?: { name, note? }[] }` | created pitch with tags + targets |
| GET | `/pitches` | member | query: `songId?, status?, page?, limit?` | paginated pitches |
| GET | `/pitches/:id` | member | — | pitch detail (nested tags + targets+artist) |
| PATCH | `/pitches/:id` | creator / org manager | `UpdatePitchDto { description?, status?, tags?, targetArtists? }` | updated pitch |

## DTO validation highlights (`class-validator`)
- `CreateSongDto.title` `@IsString @IsNotEmpty @MaxLength(200)`; `organizationId` `@IsString`;
  numeric fields `@IsInt @Min(...)`; `genre` `@IsOptional`.
- `CreatePitchDto.description` `@IsString @IsNotEmpty`; `tags` `@IsArray @IsString({each})`;
  `targetArtists` `@ValidateNested({each}) @Type(...)`.
- `PaginationQueryDto.page/limit` `@IsInt @Min(1)`, `limit` `@Max(100)` with sane defaults.
- File: validated by `FileInterceptor` limits + a custom `FileValidationPipe` (mime + size).

## Response mapping
Every response goes through a mapper (`*.mapper.ts`) that converts Prisma entities to plain
response shapes — excluding `storageKey`, internal FKs not needed by clients, and any auth columns.
