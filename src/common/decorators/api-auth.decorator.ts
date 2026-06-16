import { applyDecorators } from '@nestjs/common';
import { ApiCookieAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ErrorResponse } from '../dto/error-response.dto';

/**
 * Controller-level decorator for routes guarded by the global `AuthGuard`: advertises
 * the session-cookie security scheme and documents the shared `401` error envelope.
 * Applied once per protected controller (it cascades to every route inside it).
 */
export const ApiAuth = () =>
  applyDecorators(
    ApiCookieAuth(),
    ApiUnauthorizedResponse({ description: 'Authentication required', type: ErrorResponse }),
  );
