import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth-user.interface';

/**
 * Ensures the authenticated user is a member of the organization referenced by the
 * route. Resolves the org id from (in order) `params.organizationId`, `params.id`,
 * or `body.organizationId`. Resource-scoped checks (song/pitch ownership) live in
 * the services where the org must be derived from the resource.
 */
@Injectable()
export class OrgMembershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const params = request.params as Record<string, string | undefined>;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const organizationId =
      params.organizationId ??
      params.id ??
      (typeof body.organizationId === 'string' ? body.organizationId : undefined);

    if (!organizationId) {
      throw new ForbiddenException('Organization context could not be resolved');
    }

    const membership = await this.prisma.member.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }
    return true;
  }
}
