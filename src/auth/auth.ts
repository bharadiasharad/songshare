import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { organization } from 'better-auth/plugins';
import { PrismaClient } from '@prisma/client';

/**
 * better-auth instance — the single source of truth for identity, sessions and
 * organization management. It uses its own PrismaClient against the same database.
 *
 * IMPORTANT: organization/member rows are only ever written through this API
 * (auth.api.createOrganization / addMember), never directly via Prisma in app code.
 *
 * NOTE: exact field/option names can vary by better-auth version. If you upgrade,
 * run `npx @better-auth/cli generate` and reconcile schema.prisma + this config.
 */
const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'mysql' }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  basePath: '/api/auth',
  emailAndPassword: {
    enabled: true,
    // Disabled for the prototype — no email infrastructure required.
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'SONGWRITER',
        input: true, // allow clients to set role at sign-up
      },
    },
  },
  plugins: [organization()],
  trustedOrigins: (process.env.CORS_ORIGIN ?? '*').split(',').map((o) => o.trim()),
});

export type Auth = typeof auth;
