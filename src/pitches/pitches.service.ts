import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.interface';
import { PaginatedResult, paginate } from '../common/dto/paginated';
import { OrganizationsRepository } from '../organizations/organizations.repository';
import { SongsRepository } from '../songs/songs.repository';
import { PitchesRepository } from './pitches.repository';
import { PitchWithRelations } from './pitches.mapper';
import { CreatePitchDto } from './dto/create-pitch.dto';
import { UpdatePitchDto } from './dto/update-pitch.dto';
import { QueryPitchesDto } from './dto/query-pitches.dto';

@Injectable()
export class PitchesService {
  constructor(
    private readonly pitchesRepository: PitchesRepository,
    private readonly songsRepository: SongsRepository,
    private readonly orgRepository: OrganizationsRepository,
  ) {}

  /** Create a pitch for a song. Caller must be a MANAGER in the song's org. */
  async create(user: AuthUser, songId: string, dto: CreatePitchDto): Promise<PitchWithRelations> {
    const song = await this.songsRepository.findById(songId);
    if (!song) {
      throw new NotFoundException(`Song ${songId} not found`);
    }
    await this.assertManagerOfOrg(user, song.organizationId);

    return this.pitchesRepository.create({
      songId,
      createdById: user.id,
      description: dto.description,
      status: dto.status,
      tags: dto.tags,
      targetArtists: dto.targetArtists,
    });
  }

  async list(user: AuthUser, query: QueryPitchesDto): Promise<PaginatedResult<PitchWithRelations>> {
    const memberships = await this.orgRepository.findForUser(user.id);
    const allowedOrgIds = memberships.map((o) => o.id);
    if (allowedOrgIds.length === 0) {
      return paginate<PitchWithRelations>([], 0, query.page, query.limit);
    }

    const where: Prisma.PitchWhereInput = {
      song: { organizationId: { in: allowedOrgIds } },
      ...(query.songId ? { songId: query.songId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [data, total] = await this.pitchesRepository.findManyAndCount(
      where,
      query.skip,
      query.limit,
    );
    return paginate(data, total, query.page, query.limit);
  }

  async getAuthorized(user: AuthUser, id: string): Promise<PitchWithRelations> {
    const pitch = await this.getOrThrow(id);
    const song = await this.songsRepository.findById(pitch.songId);
    if (!song) {
      throw new NotFoundException('Associated song not found');
    }
    await this.assertMember(user.id, song.organizationId);
    return pitch;
  }

  async update(user: AuthUser, id: string, dto: UpdatePitchDto): Promise<PitchWithRelations> {
    const pitch = await this.getOrThrow(id);
    const song = await this.songsRepository.findById(pitch.songId);
    if (!song) {
      throw new NotFoundException('Associated song not found');
    }
    if (pitch.createdById !== user.id) {
      await this.assertManagerOfOrg(user, song.organizationId);
    }
    return this.pitchesRepository.update(id, dto);
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private async getOrThrow(id: string): Promise<PitchWithRelations> {
    const pitch = await this.pitchesRepository.findById(id);
    if (!pitch) {
      throw new NotFoundException(`Pitch ${id} not found`);
    }
    return pitch;
  }

  private async assertMember(userId: string, organizationId: string): Promise<void> {
    const membership = await this.orgRepository.findMembership(organizationId, userId);
    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }
  }

  private async assertManagerOfOrg(user: AuthUser, organizationId: string): Promise<void> {
    if (user.role !== UserRole.MANAGER) {
      throw new ForbiddenException('Only managers can perform this action');
    }
    await this.assertMember(user.id, organizationId);
  }
}
