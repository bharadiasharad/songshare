/**
 * Test stub for the ESM-only `better-auth` package so the Jest (CommonJS) e2e
 * runner can load the app. `getSession` returns null → protected routes return 401,
 * which is what the e2e smoke tests assert.
 */
export function betterAuth() {
  return {
    api: {
      getSession: async () => null,
      createOrganization: async () => ({}),
      addMember: async () => ({}),
      signUpEmail: async () => ({}),
    },
    handler: async () => new Response(null, { status: 404 }),
  };
}
