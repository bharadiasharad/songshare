# 05 — File Storage & Upload Security

## Strategy + Factory abstraction
```ts
// storage/storage.service.ts
export interface StorageService {
  put(input: { buffer: Buffer; mimeType: string; ext: string }): Promise<{ storageKey: string; sizeBytes: number }>;
  getStream(storageKey: string): Promise<NodeJS.ReadableStream>;
  remove(storageKey: string): Promise<void>;
}
```
- `LocalDiskStorage implements StorageService`, writing under `UPLOAD_DIR`.
- Provided via a factory token (`STORAGE_SERVICE`) so an `S3Storage` can be swapped in later
  with no service-layer changes.

## Storage key design (path-traversal safe)
- `storageKey = ${uuidv4()}${safeExt}` — the **client filename is never used** in the path.
- Files live under `UPLOAD_DIR` which is **outside any statically served directory**; clients
  only ever receive bytes via the streaming endpoint, never a filesystem path.

## Upload pipeline (`POST /songs`)
1. `FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } })` (multer).
2. `FileValidationPipe`:
   - **MIME whitelist**: `audio/mpeg`, `audio/wav`, `audio/mp4`, `audio/x-m4a`, `audio/aac`.
   - **Size cap** from env (e.g. 25 MB) — defense in depth beyond multer.
   - Best-effort **magic-byte** sniff to catch spoofed `Content-Type`.
3. Service runs `prisma.$transaction`: create `Song`, then `StorageService.put(...)`, then create
   `SongAsset` with returned `storageKey`/`sizeBytes`. If the DB write fails after the file is
   written, the catch block calls `StorageService.remove(storageKey)` to avoid orphans.

## Download/stream (`GET /songs/:id/file`)
- Authorize (member of song's org) → load asset → `getStream(storageKey)`.
- Set `Content-Type` from stored `mimeType` and `Content-Disposition: attachment; filename="..."`
  using a sanitized display name.
- Stream via Nest `StreamableFile`; never expose `storageKey` or disk path.

## Persistence in Docker
`UPLOAD_DIR` is backed by a named Docker volume so uploads survive container restarts
(see [07-docker-ops.md](07-docker-ops.md)).
