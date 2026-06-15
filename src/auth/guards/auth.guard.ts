import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { fromNodeHeaders } from 'better-auth/node';
import { Request } from 'express';
import { auth } from '../auth';
import { AuthUser } from '../auth-user.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Validates the better-auth session on every request and attaches the principal
 * to `request.user`. Routes decorated with @Public() are skipped.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session?.user) {
      throw new UnauthorizedException('Authentication required');
    }

    const user = session.user as { id: string; name: string; email: string; role?: string };
    request.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: (user.role as UserRole) ?? UserRole.SONGWRITER,
    };

    return true;
  }
}
