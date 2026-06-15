import { Injectable } from '@nestjs/common';
import { Member, Organization, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Read-only access to better-auth's organization/member tables for building API
 * responses. Writes go exclusively through the better-auth server API.
 */
@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({ where: { id } });
  }

  findForUser(userId: string): Promise<Organization[]> {
    return this.prisma.organization.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findMembers(organizationId: string): Promise<(Member & { user: User })[]> {
    return this.prisma.member.findMany({
      where: { organizationId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  findMembership(organizationId: string, userId: string): Promise<Member | null> {
    return this.prisma.member.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
  }
}
