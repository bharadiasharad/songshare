import { test, expect, request, APIRequestContext } from '@playwright/test';

/**
 * End-to-end API flow for the song-sharing platform.
 *
 * Covers the full journey across roles (manager, songwriter, outsider, anonymous)
 * plus authorization and validation negatives. Each authenticated role gets its own
 * APIRequestContext, which transparently persists the better-auth session cookie
 * across requests. Data is uniquely suffixed per run so the suite is repeatable
 * against a persistent database.
 */

const BASE = process.env.API_BASE_URL ?? 'http://localhost:3001';
const PASSWORD = 'Passw0rd!';
const RUN = Date.now();

const mgrEmail = `pw-mgr-${RUN}@example.com`;
const swEmail = `pw-sw-${RUN}@example.com`;
const outEmail = `pw-out-${RUN}@example.com`;

let manager: APIRequestContext;
let songwriter: APIRequestContext;
let outsider: APIRequestContext;
let anon: APIRequestContext;

let orgId: string;
let songId: string;
let pitchId: string;

async function signUpAndIn(
  email: string,
  name: string,
  role?: 'MANAGER' | 'SONGWRITER',
): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL: BASE });
  const signUp = await ctx.post('/api/auth/sign-up/email', {
    data: { name, email, password: PASSWORD, ...(role ? { role } : {}) },
  });
  expect(signUp.ok(), `sign-up ${email} -> ${signUp.status()}`).toBeTruthy();
  const signIn = await ctx.post('/api/auth/sign-in/email', {
    data: { email, password: PASSWORD },
  });
  expect(signIn.ok(), `sign-in ${email} -> ${signIn.status()}`).toBeTruthy();
  return ctx;
}

test.describe.serial('Song-sharing API — full flow', () => {
  test.beforeAll(async () => {
    manager = await signUpAndIn(mgrEmail, 'PW Manager', 'MANAGER');
    songwriter = await signUpAndIn(swEmail, 'PW Songwriter');
    outsider = await signUpAndIn(outEmail, 'PW Outsider');
    anon = await request.newContext({ baseURL: BASE });
  });

  test.afterAll(async () => {
    await Promise.all([
      manager?.dispose(),
      songwriter?.dispose(),
      outsider?.dispose(),
      anon?.dispose(),
    ]);
  });

  // ── Health ────────────────────────────────────────────────────────────────
  test('health and readiness probes', async () => {
    expect((await anon.get('/health')).status()).toBe(200);
    const ready = await anon.get('/health/ready');
    expect(ready.status()).toBe(200);
    expect((await ready.json()).database).toBe('up');
  });

  // ── Users & roles ───────────────────────────────────────────────────────
  test('manager profile carries the MANAGER role', async () => {
    const res = await manager.get('/users/me');
    expect(res.status()).toBe(200);
    const me = await res.json();
    expect(me).toMatchObject({ email: mgrEmail, role: 'MANAGER' });
  });

  test('songwriter defaults to the SONGWRITER role', async () => {
    const me = await (await songwriter.get('/users/me')).json();
    expect(me.role).toBe('SONGWRITER');
  });

  test('anonymous access to /users/me is 401 with the error envelope', async () => {
    const res = await anon.get('/users/me');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ statusCode: 401, path: '/users/me' });
    expect(typeof body.timestamp).toBe('string');
  });

  // ── Organizations & membership ────────────────────────────────────────────
  test('manager creates an organization', async () => {
    const res = await manager.post('/organizations', { data: { name: `PW Org ${RUN}` } });
    expect(res.status()).toBe(201);
    const org = await res.json();
    orgId = org.id;
    expect(org.name).toBe(`PW Org ${RUN}`);
    expect(org.slug).toBeTruthy();
  });

  test('songwriter cannot create an organization (403)', async () => {
    const res = await songwriter.post('/organizations', { data: { name: 'Sneaky' } });
    expect(res.status()).toBe(403);
  });

  test('creating an org with an empty body fails validation (400)', async () => {
    const res = await manager.post('/organizations', { data: {} });
    expect(res.status()).toBe(400);
    expect(Array.isArray((await res.json()).message)).toBeTruthy();
  });

  test('manager links the songwriter by email', async () => {
    const res = await manager.post(`/organizations/${orgId}/songwriters`, {
      data: { email: swEmail },
    });
    expect(res.status()).toBe(201);
    expect((await res.json()).email).toBe(swEmail);
  });

  test('linking an unknown email returns 404', async () => {
    const res = await manager.post(`/organizations/${orgId}/songwriters`, {
      data: { email: `ghost-${RUN}@example.com` },
    });
    expect(res.status()).toBe(404);
  });

  test('members list includes the owner and the linked member', async () => {
    const res = await manager.get(`/organizations/${orgId}/members`);
    expect(res.status()).toBe(200);
    const roles = (await res.json()).map((m: { role: string }) => m.role);
    expect(roles).toContain('owner');
    expect(roles).toContain('member');
  });

  test('organizations I belong to lists the new org', async () => {
    const orgs = await (await manager.get('/organizations')).json();
    expect(orgs.some((o: { id: string }) => o.id === orgId)).toBeTruthy();
  });

  // ── Songs ─────────────────────────────────────────────────────────────────
  test('songwriter uploads a song (transactional song + asset + collaborator)', async () => {
    const res = await songwriter.post('/songs', {
      multipart: {
        file: {
          name: 'demo.mp3',
          mimeType: 'audio/mpeg',
          buffer: Buffer.from(`ID3 fake-mp3 ${RUN}`),
        },
        organizationId: orgId,
        title: 'PW Summer Demo',
        genre: 'pop',
        durationSec: '200',
      },
    });
    expect(res.status()).toBe(201);
    const song = await res.json();
    songId = song.id;
    expect(song.title).toBe('PW Summer Demo');
    expect(song.assets[0].mimeType).toBe('audio/mpeg');
    expect(song.collaborators[0].splitPercent).toBe('100');
  });

  test('uploading a non-audio file is rejected (400)', async () => {
    const res = await songwriter.post('/songs', {
      multipart: {
        file: { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('nope') },
        organizationId: orgId,
        title: 'Bad',
      },
    });
    expect(res.status()).toBe(400);
  });

  test('list + filter songs returns the upload with pagination meta', async () => {
    const res = await manager.get(`/songs?organizationId=${orgId}&genre=pop&page=1&limit=10`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.meta).toMatchObject({ page: 1, limit: 10 });
    expect(body.data.some((s: { id: string }) => s.id === songId)).toBeTruthy();
  });

  test('streaming the song file returns audio bytes with correct headers', async () => {
    const res = await songwriter.get(`/songs/${songId}/file`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('audio/mpeg');
    expect(res.headers()['content-disposition']).toContain('attachment');
    expect((await res.body()).length).toBeGreaterThan(0);
  });

  test('an outsider (non-member) cannot download the file (403)', async () => {
    expect((await outsider.get(`/songs/${songId}/file`)).status()).toBe(403);
  });

  test('the uploader updates song metadata and status', async () => {
    const res = await songwriter.patch(`/songs/${songId}`, {
      data: { status: 'READY', bpm: 128 },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'READY', bpm: 128 });
  });

  // ── Pitches ─────────────────────────────────────────────────────────────
  test('manager creates a pitch with tags and target artists (atomic)', async () => {
    const res = await manager.post(`/songs/${songId}/pitches`, {
      data: {
        description: 'PW great summer single',
        status: 'SENT',
        tags: ['pop', 'summer'],
        targetArtists: [{ name: `PW Dua ${RUN}` }, { name: `PW Weeknd ${RUN}`, note: 'uptempo' }],
      },
    });
    expect(res.status()).toBe(201);
    const pitch = await res.json();
    pitchId = pitch.id;
    expect([...pitch.tags].sort()).toEqual(['pop', 'summer']);
    expect(pitch.targets).toHaveLength(2);
    expect(pitch.targets[0]).toHaveProperty('artistName');
  });

  test('a songwriter cannot create a pitch (403)', async () => {
    const res = await songwriter.post(`/songs/${songId}/pitches`, {
      data: { description: 'not allowed' },
    });
    expect(res.status()).toBe(403);
  });

  test('get pitch returns nested tags and targets', async () => {
    const pitch = await (await manager.get(`/pitches/${pitchId}`)).json();
    expect(pitch.id).toBe(pitchId);
    expect(pitch.tags.length).toBeGreaterThan(0);
  });

  test('list pitches filtered by song', async () => {
    const body = await (await manager.get(`/pitches?songId=${songId}`)).json();
    expect(body.data.some((p: { id: string }) => p.id === pitchId)).toBeTruthy();
  });

  test('manager updates the pitch, atomically replacing tags and targets', async () => {
    const res = await manager.patch(`/pitches/${pitchId}`, {
      data: {
        status: 'ACCEPTED',
        tags: ['indie'],
        targetArtists: [{ name: `PW Lorde ${RUN}`, status: 'INTERESTED' }],
      },
    });
    expect(res.status()).toBe(200);
    const pitch = await res.json();
    expect(pitch).toMatchObject({ status: 'ACCEPTED', tags: ['indie'] });
    expect(pitch.targets).toHaveLength(1);
    expect(pitch.targets[0]).toMatchObject({ status: 'INTERESTED' });
  });

  // ── Cascade delete ────────────────────────────────────────────────────────
  test('deleting the song cascades to its pitch', async () => {
    expect((await manager.delete(`/songs/${songId}`)).status()).toBe(204);
    expect((await manager.get(`/songs/${songId}`)).status()).toBe(404);
    expect((await manager.get(`/pitches/${pitchId}`)).status()).toBe(404);
  });
});
