import { test, expect, request, APIRequestContext } from '@playwright/test';
import { withReportLogging } from './api-logging';

/**
 * End-to-end API flows for the song-sharing platform, written as user journeys.
 *
 * Each `test` is a complete flow expressed in Given/When/Then steps; every HTTP call
 * is attached to the HTML report (request + response, sensitive headers masked) via the
 * logged request contexts — run `npm run test:api:report` to read them. Flows are
 * self-contained (each provisions its own actors and data, uniquely suffixed per run)
 * so they are independent and repeatable against a persistent database.
 */

const BASE = process.env.API_BASE_URL ?? 'http://localhost:3000';
const PASSWORD = 'Passw0rd!';
const RUN = Date.now();
// better-auth enforces trustedOrigins on auth mutations; present the base URL as Origin.
const CONTEXT_HEADERS = { Accept: 'application/json', Origin: BASE };

type Role = 'MANAGER' | 'SONGWRITER';
interface Actor {
  ctx: APIRequestContext;
  email: string;
  name: string;
}

let seq = 0;
const createdContexts: APIRequestContext[] = [];

function uniqueEmail(prefix: string): string {
  return `${prefix}-${RUN}-${seq++}@example.com`;
}

/** Create a fresh request context that logs every call to the report. */
async function newLoggedContext(): Promise<APIRequestContext> {
  const ctx = withReportLogging(
    await request.newContext({ baseURL: BASE, extraHTTPHeaders: CONTEXT_HEADERS }),
    CONTEXT_HEADERS,
  );
  createdContexts.push(ctx);
  return ctx;
}

/** Register and sign in an actor (a manager or, by default, a songwriter). */
async function register(name: string, role?: Role): Promise<Actor> {
  const email = uniqueEmail(role === 'MANAGER' ? 'mgr' : 'sw');
  const ctx = await newLoggedContext();
  const signUp = await ctx.post('/api/auth/sign-up/email', {
    data: { name, email, password: PASSWORD, ...(role ? { role } : {}) },
  });
  expect(signUp.ok(), `sign-up ${email} -> ${signUp.status()}`).toBeTruthy();
  const signIn = await ctx.post('/api/auth/sign-in/email', {
    data: { email, password: PASSWORD },
  });
  expect(signIn.ok(), `sign-in ${email} -> ${signIn.status()}`).toBeTruthy();
  return { ctx, email, name };
}

/** Manager creates an organization; returns its id. */
async function createOrganization(manager: APIRequestContext, name: string): Promise<string> {
  const res = await manager.post('/organizations', { data: { name } });
  expect(res.status(), 'create organization').toBe(201);
  return (await res.json()).id as string;
}

/** Manager links a songwriter to an organization by email. */
async function linkSongwriter(
  manager: APIRequestContext,
  orgId: string,
  email: string,
): Promise<void> {
  const res = await manager.post(`/organizations/${orgId}/songwriters`, { data: { email } });
  expect(res.status(), 'link songwriter').toBe(201);
}

/** Songwriter uploads a song (multipart) to an organization; returns its id. */
async function uploadSong(
  songwriter: APIRequestContext,
  orgId: string,
  title: string,
): Promise<string> {
  const res = await songwriter.post('/songs', {
    multipart: {
      file: {
        name: 'demo.mp3',
        mimeType: 'audio/mpeg',
        buffer: Buffer.from(`ID3 ${title} ${RUN}`),
      },
      organizationId: orgId,
      title,
      genre: 'pop',
      durationSec: '200',
    },
  });
  expect(res.status(), 'upload song').toBe(201);
  return (await res.json()).id as string;
}

/** Manager creates a pitch (tags + target artists) for a song; returns its id. */
async function createPitch(manager: APIRequestContext, songId: string): Promise<string> {
  const res = await manager.post(`/songs/${songId}/pitches`, {
    data: {
      description: 'Great for a summer single — uptempo pop with a strong hook.',
      status: 'SENT',
      tags: ['pop', 'summer'],
      targetArtists: [
        { name: `Dua ${RUN}-${seq}` },
        { name: `Weeknd ${RUN}-${seq}`, note: 'uptempo' },
      ],
    },
  });
  expect(res.status(), 'create pitch').toBe(201);
  return (await res.json()).id as string;
}

test.afterEach(async () => {
  await Promise.all(createdContexts.map((c) => c.dispose()));
  createdContexts.length = 0;
});

test.describe('Song-sharing platform — end-to-end flows', () => {
  // ── Flow 1 ────────────────────────────────────────────────────────────────
  test('A manager registers, confirms their session, and sets up an organization', async () => {
    let manager: Actor;
    let orgId: string;

    await test.step('Given a person signs up as a MANAGER', async () => {
      manager = await register('Mary Manager', 'MANAGER');
    });

    await test.step('Then their session is active and their profile shows the MANAGER role', async () => {
      const session = await manager.ctx.get('/api/auth/get-session');
      expect(session.status()).toBe(200);
      expect((await session.json()).user.email).toBe(manager.email);

      const me = await manager.ctx.get('/users/me');
      expect(me.status()).toBe(200);
      expect(await me.json()).toMatchObject({ email: manager.email, role: 'MANAGER' });
    });

    await test.step('When the manager creates an organization', async () => {
      const res = await manager.ctx.post('/organizations', { data: { name: `Acme Music ${RUN}` } });
      expect(res.status()).toBe(201);
      const org = await res.json();
      orgId = org.id;
      expect(org.name).toBe(`Acme Music ${RUN}`);
      expect(org.slug, 'a slug is derived from the name').toBeTruthy();
    });

    await test.step('Then it appears in their organizations and is fetchable by id', async () => {
      const mine = await (await manager.ctx.get('/organizations')).json();
      expect(mine.some((o: { id: string }) => o.id === orgId)).toBeTruthy();

      const one = await manager.ctx.get(`/organizations/${orgId}`);
      expect(one.status()).toBe(200);
      expect((await one.json()).id).toBe(orgId);
    });

    await test.step('And the manager is the owner in the members list', async () => {
      const members = await (await manager.ctx.get(`/organizations/${orgId}/members`)).json();
      const owner = members.find((m: { email: string }) => m.email === manager.email);
      expect(owner?.role).toBe('owner');
    });

    await test.step('And the manager can update their own profile', async () => {
      const res = await manager.ctx.patch('/users/me', { data: { name: 'Mary M. Manager' } });
      expect(res.status()).toBe(200);
      expect((await res.json()).name).toBe('Mary M. Manager');
    });
  });

  // ── Flow 2 ────────────────────────────────────────────────────────────────
  test('A manager onboards a songwriter who uploads a song to the organization', async () => {
    let manager: Actor;
    let songwriter: Actor;
    let orgId: string;
    let songId: string;

    await test.step('Given a manager with an organization and a registered songwriter', async () => {
      manager = await register('Olivia Owner', 'MANAGER');
      songwriter = await register('Sam Writer');
      orgId = await createOrganization(manager.ctx, `Label ${RUN}-2`);
    });

    await test.step('And the songwriter defaults to the SONGWRITER role', async () => {
      expect((await (await songwriter.ctx.get('/users/me')).json()).role).toBe('SONGWRITER');
    });

    await test.step('When the manager links the songwriter to the organization by email', async () => {
      const res = await manager.ctx.post(`/organizations/${orgId}/songwriters`, {
        data: { email: songwriter.email },
      });
      expect(res.status()).toBe(201);
      expect((await res.json()).email).toBe(songwriter.email);
    });

    await test.step('Then the songwriter appears as a member of the organization', async () => {
      const members = await (await manager.ctx.get(`/organizations/${orgId}/members`)).json();
      const linked = members.find((m: { email: string }) => m.email === songwriter.email);
      expect(linked?.role).toBe('member');

      // the manager can also look the songwriter up by id
      const profile = await manager.ctx.get(`/users/${linked.userId}`);
      expect(profile.status()).toBe(200);
      expect((await profile.json()).email).toBe(songwriter.email);
    });

    await test.step('When the songwriter uploads a song (song + asset + collaborator, atomically)', async () => {
      const res = await songwriter.ctx.post('/songs', {
        multipart: {
          file: { name: 'demo.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from(`ID3 ${RUN}`) },
          organizationId: orgId,
          title: 'Summer Demo',
          genre: 'pop',
          durationSec: '200',
        },
      });
      expect(res.status()).toBe(201);
      const song = await res.json();
      songId = song.id;
      expect(song.title).toBe('Summer Demo');
      expect(song.assets[0].mimeType).toBe('audio/mpeg');
      expect(song.collaborators[0].splitPercent).toBe('100');
    });

    await test.step('Then the song is retrievable and appears in the filtered listing', async () => {
      expect((await manager.ctx.get(`/songs/${songId}`)).status()).toBe(200);

      const body = await (
        await manager.ctx.get(`/songs?organizationId=${orgId}&genre=pop&page=1&limit=10`)
      ).json();
      expect(body.meta).toMatchObject({ page: 1, limit: 10 });
      expect(body.data.some((s: { id: string }) => s.id === songId)).toBeTruthy();
    });

    await test.step('And the audio file can be streamed with the correct headers', async () => {
      const res = await songwriter.ctx.get(`/songs/${songId}/file`);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toContain('audio/mpeg');
      expect(res.headers()['content-disposition']).toContain('attachment');
      expect((await res.body()).length).toBeGreaterThan(0);
    });
  });

  // ── Flow 3 ────────────────────────────────────────────────────────────────
  test('A manager pitches a song to target artists, then revises the pitch', async () => {
    let manager: Actor;
    let songwriter: Actor;
    let orgId: string;
    let songId: string;
    let pitchId: string;

    await test.step('Given an organization with a song uploaded by a linked songwriter', async () => {
      manager = await register('Paul Pitcher', 'MANAGER');
      songwriter = await register('Wendy Writer');
      orgId = await createOrganization(manager.ctx, `Pitch Co ${RUN}`);
      await linkSongwriter(manager.ctx, orgId, songwriter.email);
      songId = await uploadSong(songwriter.ctx, orgId, 'Pitch Track');
    });

    await test.step('When the manager creates a pitch with tags and target artists', async () => {
      const res = await manager.ctx.post(`/songs/${songId}/pitches`, {
        data: {
          description: 'Great summer single',
          status: 'SENT',
          tags: ['pop', 'summer'],
          targetArtists: [{ name: `Dua ${RUN}` }, { name: `Weeknd ${RUN}`, note: 'uptempo' }],
        },
      });
      expect(res.status()).toBe(201);
      const pitch = await res.json();
      pitchId = pitch.id;
      expect([...pitch.tags].sort()).toEqual(['pop', 'summer']);
      expect(pitch.targets).toHaveLength(2);
      expect(pitch.targets[0]).toHaveProperty('artistName');
    });

    await test.step('Then the pitch is retrievable and listed for its song', async () => {
      const one = await manager.ctx.get(`/pitches/${pitchId}`);
      expect(one.status()).toBe(200);
      expect((await one.json()).id).toBe(pitchId);

      const list = await (await manager.ctx.get(`/pitches?songId=${songId}`)).json();
      expect(list.data.some((p: { id: string }) => p.id === pitchId)).toBeTruthy();
    });

    await test.step('When the manager updates the pitch, atomically replacing tags and targets', async () => {
      const res = await manager.ctx.patch(`/pitches/${pitchId}`, {
        data: {
          status: 'ACCEPTED',
          tags: ['indie'],
          targetArtists: [{ name: `Lorde ${RUN}`, status: 'INTERESTED' }],
        },
      });
      expect(res.status()).toBe(200);
      const pitch = await res.json();
      expect(pitch).toMatchObject({ status: 'ACCEPTED', tags: ['indie'] });
      expect(pitch.targets).toHaveLength(1);
      expect(pitch.targets[0]).toMatchObject({ status: 'INTERESTED' });
    });
  });

  // ── Flow 4 ────────────────────────────────────────────────────────────────
  test('A song is updated and then deleted, cascading to its pitch', async () => {
    let manager: Actor;
    let songwriter: Actor;
    let songId: string;
    let pitchId: string;

    await test.step('Given a song that has a pitch', async () => {
      manager = await register('Dana Deleter', 'MANAGER');
      songwriter = await register('Carl Cowriter');
      const orgId = await createOrganization(manager.ctx, `Lifecycle ${RUN}`);
      await linkSongwriter(manager.ctx, orgId, songwriter.email);
      songId = await uploadSong(songwriter.ctx, orgId, 'Throwaway');
      pitchId = await createPitch(manager.ctx, songId);
    });

    await test.step('When the uploader updates the song status', async () => {
      const res = await songwriter.ctx.patch(`/songs/${songId}`, {
        data: { status: 'READY', bpm: 128 },
      });
      expect(res.status()).toBe(200);
      expect(await res.json()).toMatchObject({ status: 'READY', bpm: 128 });
    });

    await test.step('And a manager deletes the song', async () => {
      expect((await manager.ctx.delete(`/songs/${songId}`)).status()).toBe(204);
    });

    await test.step('Then the song and its pitch are gone (cascade delete)', async () => {
      expect((await manager.ctx.get(`/songs/${songId}`)).status()).toBe(404);
      expect((await manager.ctx.get(`/pitches/${pitchId}`)).status()).toBe(404);
    });
  });

  // ── Flow 5 ────────────────────────────────────────────────────────────────
  test('Unauthenticated requests to protected resources are rejected with 401', async () => {
    let anon: APIRequestContext;

    await test.step('Given an anonymous client (no session)', async () => {
      anon = await newLoggedContext();
    });

    await test.step('When it requests protected resources, Then each is 401 with the error envelope', async () => {
      for (const path of ['/users/me', '/songs', '/pitches']) {
        const res = await anon.get(path);
        expect(res.status(), `${path} should be 401`).toBe(401);
        const body = await res.json();
        expect(body).toMatchObject({ statusCode: 401, path });
        expect(typeof body.timestamp).toBe('string');
      }
    });
  });

  // ── Flow 6 ────────────────────────────────────────────────────────────────
  test('Role-based permissions are enforced for songwriters (403)', async () => {
    let manager: Actor;
    let songwriter: Actor;
    let songId: string;

    await test.step('Given a songwriter who has uploaded a song to a manager’s org', async () => {
      manager = await register('Gina Gate', 'MANAGER');
      songwriter = await register('Ned Notallowed');
      const orgId = await createOrganization(manager.ctx, `Roles ${RUN}`);
      await linkSongwriter(manager.ctx, orgId, songwriter.email);
      songId = await uploadSong(songwriter.ctx, orgId, 'Writer Track');
    });

    await test.step('When the songwriter tries to create an organization, Then it is forbidden (403)', async () => {
      expect(
        (await songwriter.ctx.post('/organizations', { data: { name: 'Sneaky' } })).status(),
      ).toBe(403);
    });

    await test.step('When the songwriter tries to pitch their own song, Then it is forbidden (403)', async () => {
      const res = await songwriter.ctx.post(`/songs/${songId}/pitches`, {
        data: { description: 'not allowed' },
      });
      expect(res.status()).toBe(403);
    });
  });

  // ── Flow 7 ────────────────────────────────────────────────────────────────
  test('Organization data is isolated from non-members (403)', async () => {
    let outsider: Actor;
    let songId: string;

    await test.step('Given a song in one manager’s org and an unrelated outsider', async () => {
      const manager = await register('Iris Inside', 'MANAGER');
      const songwriter = await register('Tom Trusted');
      outsider = await register('Eve External', 'MANAGER');
      const orgId = await createOrganization(manager.ctx, `Private ${RUN}`);
      await linkSongwriter(manager.ctx, orgId, songwriter.email);
      songId = await uploadSong(songwriter.ctx, orgId, 'Secret Demo');
    });

    await test.step('When the outsider tries to view the song, Then it is forbidden (403)', async () => {
      expect((await outsider.ctx.get(`/songs/${songId}`)).status()).toBe(403);
    });

    await test.step('When the outsider tries to download the file, Then it is forbidden (403)', async () => {
      expect((await outsider.ctx.get(`/songs/${songId}/file`)).status()).toBe(403);
    });
  });

  // ── Flow 8 ────────────────────────────────────────────────────────────────
  test('Invalid input and unknown references are handled (400 / 404)', async () => {
    let manager: Actor;
    let songwriter: Actor;
    let orgId: string;

    await test.step('Given a manager with an organization and a linked songwriter', async () => {
      manager = await register('Val Validator', 'MANAGER');
      songwriter = await register('Phil Filechecker');
      orgId = await createOrganization(manager.ctx, `Validate ${RUN}`);
      await linkSongwriter(manager.ctx, orgId, songwriter.email);
    });

    await test.step('When creating an organization with an empty body, Then it is a 400 with validation messages', async () => {
      const res = await manager.ctx.post('/organizations', { data: {} });
      expect(res.status()).toBe(400);
      expect(Array.isArray((await res.json()).message)).toBeTruthy();
    });

    await test.step('When linking an unknown email, Then it is a 404', async () => {
      const res = await manager.ctx.post(`/organizations/${orgId}/songwriters`, {
        data: { email: `ghost-${RUN}@example.com` },
      });
      expect(res.status()).toBe(404);
    });

    await test.step('When the songwriter uploads a non-audio file, Then it is a 400', async () => {
      const res = await songwriter.ctx.post('/songs', {
        multipart: {
          file: { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('nope') },
          organizationId: orgId,
          title: 'Bad',
        },
      });
      expect(res.status()).toBe(400);
    });
  });

  // ── Flow 9 ────────────────────────────────────────────────────────────────
  test('Signing out ends the session', async () => {
    let manager: Actor;

    await test.step('Given an authenticated manager', async () => {
      manager = await register('Sid Signout', 'MANAGER');
      expect((await manager.ctx.get('/users/me')).status()).toBe(200);
    });

    await test.step('When the manager signs out', async () => {
      expect((await manager.ctx.post('/api/auth/sign-out')).ok()).toBeTruthy();
    });

    await test.step('Then a subsequent protected request is rejected with 401', async () => {
      expect((await manager.ctx.get('/users/me')).status()).toBe(401);
    });
  });

  // ── Flow 10 ───────────────────────────────────────────────────────────────
  test('Health and readiness probes report service status', async () => {
    let anon: APIRequestContext;

    await test.step('Given any client', async () => {
      anon = await newLoggedContext();
    });

    await test.step('Then the liveness probe is 200', async () => {
      const res = await anon.get('/health');
      expect(res.status()).toBe(200);
      expect((await res.json()).status).toBe('ok');
    });

    await test.step('And the readiness probe reports the database is up', async () => {
      const res = await anon.get('/health/ready');
      expect(res.status()).toBe(200);
      expect((await res.json()).database).toBe('up');
    });
  });
});
