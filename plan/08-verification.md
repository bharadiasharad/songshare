# 08 — Verification (end-to-end)

## Boot
1. `cp .env.example .env`
2. `docker-compose up --build` → MySQL becomes healthy, migrations apply, server listens on :3000.
3. Open `http://localhost:3000/docs` → Swagger renders every endpoint.

## Happy-path curl flow (cookie jar keeps the session)
```sh
# 1. Manager signs up + in
curl -c mgr.txt -X POST localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' \
  -d '{"name":"Mary Mgr","email":"mgr@x.com","password":"Passw0rd!"}'
curl -c mgr.txt -X POST localhost:3000/api/auth/sign-in/email \
  -H 'Content-Type: application/json' -d '{"email":"mgr@x.com","password":"Passw0rd!"}'
curl -b mgr.txt -X PATCH localhost:3000/users/me \
  -H 'Content-Type: application/json' -d '{"role":"MANAGER"}'

# 2. Create org
curl -b mgr.txt -X POST localhost:3000/organizations \
  -H 'Content-Type: application/json' -d '{"name":"Acme Music"}'   # -> {id: ORG_ID}

# 3. Songwriter signs up (role defaults to SONGWRITER); manager links them by email
curl -c sw.txt -X POST localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' \
  -d '{"name":"Sam Writer","email":"sw@x.com","password":"Passw0rd!"}'
curl -b mgr.txt -X POST localhost:3000/organizations/ORG_ID/songwriters \
  -H 'Content-Type: application/json' -d '{"email":"sw@x.com"}'

# 4. Songwriter uploads a song
curl -b sw.txt -X POST localhost:3000/songs \
  -F 'file=@demo.mp3' -F 'organizationId=ORG_ID' -F 'title=My Demo' -F 'genre=pop'
# -> {id: SONG_ID}; file present in uploads volume
curl -b sw.txt localhost:3000/songs/SONG_ID/file -o roundtrip.mp3   # streams back

# 5. List + filter
curl -b sw.txt "localhost:3000/songs?organizationId=ORG_ID&genre=pop&page=1&limit=20"

# 6. Manager creates a pitch (single transaction)
curl -b mgr.txt -X POST localhost:3000/songs/SONG_ID/pitches \
  -H 'Content-Type: application/json' \
  -d '{"description":"Great for a summer single","tags":["pop","summer"],
       "targetArtists":[{"name":"Dua Lipa"},{"name":"The Weeknd","note":"uptempo"}]}'
curl -b mgr.txt localhost:3000/pitches/PITCH_ID   # nested tags + targets+artist
```

## Negative tests (authorization & validation)
| Check | Expectation |
|---|---|
| Songwriter `POST /songs/:id/pitches` | 403 (manager only) |
| Non-member reads org's songs | 403 |
| Upload `.exe` or wrong MIME | 400 |
| Upload over `MAX_UPLOAD_BYTES` | 400/413 |
| Create pitch with malformed `targetArtists` | 400, **no** partial rows (atomicity) |
| Link songwriter by unknown email | 404, no membership created |
| Any endpoint without session cookie | 401 |
