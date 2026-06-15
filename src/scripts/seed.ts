/**
 * Database seed — creates a small, realistic demo dataset.
 *
 * Users are created through better-auth's server API so password hashing matches
 * the runtime exactly (you can sign in with the credentials below). Organization,
 * membership and domain rows are written via Prisma. The script is idempotent:
 * re-running it will not duplicate data.
 *
 * It lives under `src/` so the Nest build compiles it to `dist/scripts/seed.js`,
 * letting the production container seed with plain `node` (no `ts-node`/dev deps).
 * Locally it runs via `npm run db:seed` (ts-node).
 *
 * Demo credentials (password for both): `Passw0rd!`
 *   manager@example.com    (MANAGER)
 *   songwriter@example.com (SONGWRITER)
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient, UserRole } from '@prisma/client';
import { auth } from '../auth/auth';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Passw0rd!';

async function ensureUser(name: string, email: string, role: UserRole) {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await auth.api.signUpEmail({ body: { name, email, password: DEMO_PASSWORD } });
    user = await prisma.user.findUnique({ where: { email } });
  }
  if (!user) throw new Error(`Failed to create user ${email}`);
  return prisma.user.update({ where: { id: user.id }, data: { role } });
}

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Users (via better-auth so credentials actually work)
  const manager = await ensureUser('Demo Manager', 'manager@example.com', UserRole.MANAGER);
  const songwriter = await ensureUser(
    'Demo Songwriter',
    'songwriter@example.com',
    UserRole.SONGWRITER,
  );

  // 2. Organization + memberships
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-music' },
    update: {},
    create: { id: randomUUID(), name: 'Demo Music', slug: 'demo-music' },
  });

  await prisma.member.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: manager.id } },
    update: { role: 'owner' },
    create: { id: randomUUID(), organizationId: org.id, userId: manager.id, role: 'owner' },
  });
  await prisma.member.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: songwriter.id } },
    update: {},
    create: { id: randomUUID(), organizationId: org.id, userId: songwriter.id, role: 'member' },
  });

  // 3. Reference data: tags + target artists
  const tagNames = ['pop', 'summer', 'uptempo'];
  const tags = await Promise.all(
    tagNames.map((name) => prisma.tag.upsert({ where: { name }, update: {}, create: { name } })),
  );

  const artistNames = ['Dua Lipa', 'The Weeknd'];
  const artists = await Promise.all(
    artistNames.map((name) =>
      prisma.artist.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );

  // 4. A song uploaded by the songwriter
  let song = await prisma.song.findFirst({
    where: { title: 'Summer Demo', organizationId: org.id },
  });
  if (!song) {
    song = await prisma.song.create({
      data: {
        title: 'Summer Demo',
        primaryArtist: 'Demo Songwriter',
        genre: 'pop',
        durationSec: 187,
        bpm: 120,
        musicalKey: 'C',
        status: 'READY',
        organizationId: org.id,
        uploadedById: songwriter.id,
        assets: {
          create: {
            storageKey: `${randomUUID()}.mp3`,
            mimeType: 'audio/mpeg',
            sizeBytes: 4_200_000,
            kind: 'DEMO',
            version: 1,
          },
        },
        collaborators: {
          create: { userId: songwriter.id, splitPercent: 100, roleOnSong: 'WRITER' },
        },
      },
    });
  }

  // 5. A pitch created by the manager
  const existingPitch = await prisma.pitch.findFirst({ where: { songId: song.id } });
  if (!existingPitch) {
    await prisma.pitch.create({
      data: {
        songId: song.id,
        createdById: manager.id,
        description: 'Great for a summer single — uptempo pop with a strong hook.',
        status: 'SENT',
        tags: { create: tags.map((t) => ({ tagId: t.id })) },
        targets: {
          create: artists.map((a, i) => ({
            artistId: a.id,
            status: i === 0 ? 'INTERESTED' : 'PENDING',
          })),
        },
      },
    });
  }

  console.log('✅ Seed complete.');
  console.log('   Manager:    manager@example.com / Passw0rd!');
  console.log('   Songwriter: songwriter@example.com / Passw0rd!');
}

void main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
