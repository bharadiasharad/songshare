import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IncomingHttpHeaders } from 'node:http';
import { Member, Organization, User } from '@prisma/client';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth';
import { UsersService } from '../users/users.service';
import { OrganizationsRepository } from './organizations.repository';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly orgRepository: OrganizationsRepository,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Create an organization via better-auth (caller becomes the owner member).
   * `headers` carry the acting user's session so better-auth attributes ownership.
   */
  async create(dto: CreateOrganizationDto, headers: IncomingHttpHeaders): Promise<Organization> {
    const slug = dto.slug ?? this.slugify(dto.name);
    const result = await auth.api.createOrganization({
      body: { name: dto.name, slug },
      headers: fromNodeHeaders(headers),
    });
    if (!result) {
      throw new BadRequestException('Could not create organization');
    }
    return result as unknown as Organization;
  }

  async getByIdOrThrow(id: string): Promise<Organization> {
    const org = await this.orgRepository.findById(id);
    if (!org) {
      throw new NotFoundException(`Organization ${id} not found`);
    }
    return org;
  }

  listForUser(userId: string): Promise<Organization[]> {
    return this.orgRepository.findForUser(userId);
  }

  listMembers(organizationId: string): Promise<(Member & { user: User })[]> {
    return this.orgRepository.findMembers(organizationId);
  }

  /**
   * Link an existing user (by email) to the org as a member via better-auth.
   */
  async linkSongwriter(
    organizationId: string,
    email: string,
    headers: IncomingHttpHeaders,
  ): Promise<Member> {
    await this.getByIdOrThrow(organizationId);
    const user = await this.usersService.getByEmailOrThrow(email);

    const existing = await this.orgRepository.findMembership(organizationId, user.id);
    if (existing) {
      throw new ConflictException('User is already a member of this organization');
    }

    const result = await auth.api.addMember({
      body: { userId: user.id, organizationId, role: 'member' },
      headers: fromNodeHeaders(headers),
    });
    if (!result) {
      throw new BadRequestException('Could not add member');
    }
    return result;
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
