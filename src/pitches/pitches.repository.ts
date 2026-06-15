import { Injectable } from '@nestjs/common';
import { Prisma, PitchStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TargetArtistInput } from './dto/create-pitch.dto';
import { PitchWithRelations } from './pitches.mapper';

interface CreatePitchData {
  songId: string;
  createdById: string;
  description: string;
  status?: PitchStatus;
  tags?: string[];
  targetArtists?: TargetArtistInput[];
}

interface UpdatePitchData {
  description?: string;
  status?: PitchStatus;
  tags?: string[];
  targetArtists?: TargetArtistInput[];
}

const INCLUDE = {
  tags: { include: { tag: true } },
  targets: { include: { artist: true } },
} satisfies Prisma.PitchInclude;

@Injectable()
export class PitchesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Single nested create — pitch + tags + targets persist atomically. */
  create(data: CreatePitchData): Promise<PitchWithRelations> {
    return this.prisma.pitch.create({
      data: {
        song: { connect: { id: data.songId } },
        createdBy: { connect: { id: data.createdById } },
        description: data.description,
        status: data.status,
        tags: { create: this.buildTagCreate(data.tags) },
        targets: { create: this.buildTargetCreate(data.targetArtists) },
      },
      include: INCLUDE,
    });
  }

  findById(id: string): Promise<PitchWithRelations | null> {
    return this.prisma.pitch.findUnique({ where: { id }, include: INCLUDE });
  }

  async findManyAndCount(
    where: Prisma.PitchWhereInput,
    skip: number,
    take: number,
  ): Promise<[PitchWithRelations[], number]> {
    return this.prisma.$transaction([
      this.prisma.pitch.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: INCLUDE,
      }),
      this.prisma.pitch.count({ where }),
    ]);
  }

  /** Update scalars and (optionally) fully replace tags/targets in one transaction. */
  update(id: string, data: UpdatePitchData): Promise<PitchWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      await tx.pitch.update({
        where: { id },
        data: { description: data.description, status: data.status },
      });

      if (data.tags) {
        await tx.pitchTag.deleteMany({ where: { pitchId: id } });
        await tx.pitch.update({
          where: { id },
          data: { tags: { create: this.buildTagCreate(data.tags) } },
        });
      }

      if (data.targetArtists) {
        await tx.pitchTarget.deleteMany({ where: { pitchId: id } });
        await tx.pitch.update({
          where: { id },
          data: { targets: { create: this.buildTargetCreate(data.targetArtists) } },
        });
      }

      return tx.pitch.findUniqueOrThrow({ where: { id }, include: INCLUDE });
    });
  }

  private buildTagCreate(tags?: string[]): Prisma.PitchTagCreateWithoutPitchInput[] {
    return (tags ?? []).map((name) => ({
      tag: { connectOrCreate: { where: { name }, create: { name } } },
    }));
  }

  private buildTargetCreate(
    targets?: TargetArtistInput[],
  ): Prisma.PitchTargetCreateWithoutPitchInput[] {
    return (targets ?? []).map((t) => ({
      status: t.status,
      note: t.note,
      artist: { connectOrCreate: { where: { name: t.name }, create: { name: t.name } } },
    }));
  }
}
