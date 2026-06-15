import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Readable } from 'node:stream';
import { Prisma, Song, UserRole } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.interface';
import { PaginatedResult, paginate } from '../common/dto/paginated';
import { OrganizationsRepository } from '../organizations/organizations.repository';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.service';
import { SongsRepository, SongWithAssets } from './songs.repository';
import { CreateSongDto } from './dto/create-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import { QuerySongsDto } from './dto/query-songs.dto';

@Injectable()
export class SongsService {
  constructor(
    private readonly songsRepository: SongsRepository,
    private readonly orgRepository: OrganizationsRepository,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  /**
   * Persist an uploaded song. The file is written first, then Song + SongAsset are
   * created atomically (single nested Prisma write). If the DB write fails, the
   * orphaned file is removed.
   */
  async upload(
    user: AuthUser,
    dto: CreateSongDto,
    file: Express.Multer.File,
  ): Promise<SongWithAssets> {
    await this.assertMember(user.id, dto.organizationId);

    const stored = await this.storage.put({
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
    });

    try {
      return await this.songsRepository.create({
        title: dto.title,
        primaryArtist: dto.primaryArtist,
        durationSec: dto.durationSec,
        bpm: dto.bpm,
        musicalKey: dto.musicalKey,
        genre: dto.genre,
        lyrics: dto.lyrics,
        organization: { connect: { id: dto.organizationId } },
        uploadedBy: { connect: { id: user.id } },
        assets: {
          create: {
            storageKey: stored.storageKey,
            mimeType: file.mimetype,
            sizeBytes: stored.sizeBytes,
            kind: 'DEMO',
          },
        },
        collaborators: {
          create: { user: { connect: { id: user.id } }, splitPercent: 100, roleOnSong: 'WRITER' },
        },
      });
    } catch (err) {
      await this.storage.remove(stored.storageKey);
      throw err;
    }
  }

  async list(user: AuthUser, query: QuerySongsDto): Promise<PaginatedResult<SongWithAssets>> {
    const memberships = await this.orgRepository.findForUser(user.id);
    const allowedOrgIds = memberships.map((o) => o.id);

    // A user only ever sees songs in organizations they belong to.
    if (query.organizationId && !allowedOrgIds.includes(query.organizationId)) {
      return paginate<SongWithAssets>([], 0, query.page, query.limit);
    }
    if (allowedOrgIds.length === 0) {
      return paginate<SongWithAssets>([], 0, query.page, query.limit);
    }

    const where: Prisma.SongWhereInput = {
      organizationId: query.organizationId ?? { in: allowedOrgIds },
      ...(query.genre ? { genre: query.genre } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.songwriterId ? { uploadedById: query.songwriterId } : {}),
      ...(query.q
        ? {
            OR: [{ title: { contains: query.q } }, { primaryArtist: { contains: query.q } }],
          }
        : {}),
    };

    const [data, total] = await this.songsRepository.findManyAndCount(
      where,
      query.skip,
      query.limit,
    );
    return paginate(data as SongWithAssets[], total, query.page, query.limit);
  }

  async getAuthorized(user: AuthUser, id: string): Promise<SongWithAssets> {
    const song = await this.getOrThrow(id);
    await this.assertMember(user.id, song.organizationId);
    return song;
  }

  async getFileStream(
    user: AuthUser,
    id: string,
  ): Promise<{ stream: Readable; mimeType: string; filename: string }> {
    const song = await this.getAuthorized(user, id);
    const asset = song.assets[0];
    if (!asset) {
      throw new NotFoundException('Song has no audio file');
    }
    const stream = await this.storage.getStream(asset.storageKey);
    return { stream, mimeType: asset.mimeType, filename: `${song.title}` };
  }

  async update(user: AuthUser, id: string, dto: UpdateSongDto): Promise<SongWithAssets> {
    const song = await this.getOrThrow(id);
    await this.assertCanModify(user, song);
    return this.songsRepository.update(id, dto);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const song = await this.getOrThrow(id);
    await this.assertCanModify(user, song);
    await this.songsRepository.delete(id);
    await Promise.all(song.assets.map((a) => this.storage.remove(a.storageKey)));
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private async getOrThrow(id: string): Promise<SongWithAssets> {
    const song = await this.songsRepository.findById(id);
    if (!song) {
      throw new NotFoundException(`Song ${id} not found`);
    }
    return song;
  }

  private async assertMember(userId: string, organizationId: string): Promise<void> {
    const membership = await this.orgRepository.findMembership(organizationId, userId);
    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }
  }

  private async assertCanModify(user: AuthUser, song: Song): Promise<void> {
    if (song.uploadedById === user.id) {
      return;
    }
    if (user.role === UserRole.MANAGER) {
      const membership = await this.orgRepository.findMembership(song.organizationId, user.id);
      if (membership) {
        return;
      }
    }
    throw new ForbiddenException('You do not have permission to modify this song');
  }
}
