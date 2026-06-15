import { UserRole } from '@prisma/client';

/**
 * Shape of the authenticated principal attached to the request by AuthGuard.
 */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

/** Express request augmented with the authenticated user. */
export interface AuthenticatedRequest {
  user?: AuthUser;
}
