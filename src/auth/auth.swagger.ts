import { OpenAPIObject } from '@nestjs/swagger';

/**
 * OpenAPI documentation for the better-auth endpoints.
 *
 * These routes are served by better-auth's catch-all handler (see auth.controller.ts),
 * so `@nestjs/swagger` cannot introspect them automatically. We instead describe their
 * real request/response contract here and merge it into the generated document in
 * main.ts. Keep this in sync with the configured better-auth plugins/fields.
 */

const AUTH_TAG = 'auth';

/** Shape of the user object better-auth returns and persists (mirrors the `user` table). */
const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
    emailVerified: { type: 'boolean' },
    image: { type: 'string', nullable: true },
    role: { type: 'string', enum: ['MANAGER', 'SONGWRITER'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

/** `{ token, user }` envelope returned by sign-up / sign-in (and a Set-Cookie session). */
const authResultSchema = {
  type: 'object',
  properties: {
    token: { type: 'string', description: 'Session token (also set as an httpOnly cookie).' },
    user: userSchema,
  },
};

/** better-auth's error body shape, e.g. `{ message, code }`. */
const authErrorSchema = {
  type: 'object',
  properties: {
    message: { type: 'string', example: 'User already exists. Use another email.' },
    code: { type: 'string', example: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' },
  },
};

/** A JSON error response documented with the shared better-auth error schema. */
function errorResponse(description: string) {
  return { description, content: { 'application/json': { schema: authErrorSchema } } };
}

/**
 * Build the OpenAPI path items for the auth endpoints. Merge the result into
 * `document.paths` before `SwaggerModule.setup()`.
 */
export function buildAuthApiPaths(): OpenAPIObject['paths'] {
  return {
    '/api/auth/sign-up/email': {
      post: {
        tags: [AUTH_TAG],
        summary: 'Register with email + password',
        description:
          'Creates a user and starts a session (sets an httpOnly session cookie). ' +
          'Pass `role` to self-assign MANAGER or SONGWRITER (defaults to SONGWRITER). ' +
          'Send an `Origin` header matching CORS_ORIGIN — better-auth rejects untrusted origins.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', example: 'Mary Manager' },
                  email: { type: 'string', format: 'email', example: 'manager@example.com' },
                  password: { type: 'string', format: 'password', example: 'Passw0rd!' },
                  role: {
                    type: 'string',
                    enum: ['MANAGER', 'SONGWRITER'],
                    default: 'SONGWRITER',
                    example: 'MANAGER',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Account created; session cookie set.',
            content: { 'application/json': { schema: authResultSchema } },
          },
          '400': errorResponse('Validation error (e.g. malformed email or weak password).'),
          '422': errorResponse('Email already in use (USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL).'),
        },
      },
    },

    '/api/auth/sign-in/email': {
      post: {
        tags: [AUTH_TAG],
        summary: 'Sign in with email + password',
        description:
          'Authenticates and sets an httpOnly session cookie. Send an `Origin` header ' +
          'matching CORS_ORIGIN.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'manager@example.com' },
                  password: { type: 'string', format: 'password', example: 'Passw0rd!' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Signed in; session cookie set.',
            content: { 'application/json': { schema: authResultSchema } },
          },
          '400': errorResponse('Validation error (malformed request body).'),
          '401': errorResponse('Invalid email or password.'),
        },
      },
    },

    '/api/auth/sign-out': {
      post: {
        tags: [AUTH_TAG],
        summary: 'Sign out (clears the session cookie)',
        responses: {
          '200': {
            description: 'Signed out.',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { success: { type: 'boolean' } } },
              },
            },
          },
        },
      },
    },

    '/api/auth/get-session': {
      get: {
        tags: [AUTH_TAG],
        summary: 'Get the current session and user',
        description: 'Returns the active session + user, or `null` when unauthenticated.',
        responses: {
          '200': {
            description: 'Current session, or null.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  nullable: true,
                  properties: { session: { type: 'object' }, user: userSchema },
                },
              },
            },
          },
        },
      },
    },
  };
}
