import { Injectable } from '@nestjs/common';
import { Prisma, Song, SongAsset } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type SongWithAssets = Song & { assets: SongAsset[] };

@Injectable()
export class SongsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.SongCreateInput): Promise<SongWithAssets> {
    return this.prisma.song.create({
      data,
      include: { assets: true, collaborators: true },
    });
  }

  findById(id: string): Promise<SongWithAssets | null> {
    return this.prisma.song.findUnique({
      where: { id },
      include: { assets: true, collaborators: true },
    });
  }

  async findManyAndCount(
    where: Prisma.SongWhereInput,
    skip: number,
    take: number,
  ): Promise<[Song[], number]> {
    return this.prisma.$transaction([
      this.prisma.song.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { assets: true },
      }),
      this.prisma.song.count({ where }),
    ]);
  }

  update(id: string, data: Prisma.SongUpdateInput): Promise<SongWithAssets> {
    return this.prisma.song.update({
      where: { id },
      data,
      include: { assets: true, collaborators: true },
    });
  }

  delete(id: string): Promise<Song> {
    return this.prisma.song.delete({ where: { id } });
  }
}
