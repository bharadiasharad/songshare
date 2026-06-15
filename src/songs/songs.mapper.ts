import { ApiProperty } from '@nestjs/swagger';
import { Song, SongAsset, SongCollaborator, SongStatus } from '@prisma/client';

export class SongAssetResponse {
  @ApiProperty() id: string;
  @ApiProperty() kind: string;
  @ApiProperty() mimeType: string;
  @ApiProperty() sizeBytes: number;
  @ApiProperty() version: number;
}

export class CollaboratorResponse {
  @ApiProperty() userId: string;
  @ApiProperty() roleOnSong: string;
  @ApiProperty() splitPercent: string;
}

export class SongResponse {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty({ nullable: true }) primaryArtist: string | null;
  @ApiProperty({ nullable: true }) durationSec: number | null;
  @ApiProperty({ nullable: true }) bpm: number | null;
  @ApiProperty({ nullable: true }) musicalKey: string | null;
  @ApiProperty({ nullable: true }) genre: string | null;
  @ApiProperty({ enum: SongStatus }) status: SongStatus;
  @ApiProperty() organizationId: string;
  @ApiProperty() uploadedById: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ type: [SongAssetResponse], required: false }) assets?: SongAssetResponse[];
  @ApiProperty({ type: [CollaboratorResponse], required: false })
  collaborators?: CollaboratorResponse[];
}

type SongWithRelations = Song & {
  assets?: SongAsset[];
  collaborators?: SongCollaborator[];
};

export function toSongResponse(song: SongWithRelations): SongResponse {
  return {
    id: song.id,
    title: song.title,
    primaryArtist: song.primaryArtist,
    durationSec: song.durationSec,
    bpm: song.bpm,
    musicalKey: song.musicalKey,
    genre: song.genre,
    status: song.status,
    organizationId: song.organizationId,
    uploadedById: song.uploadedById,
    createdAt: song.createdAt,
    assets: song.assets?.map((a) => ({
      id: a.id,
      kind: a.kind,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      version: a.version,
    })),
    collaborators: song.collaborators?.map((c) => ({
      userId: c.userId,
      roleOnSong: c.roleOnSong,
      splitPercent: c.splitPercent.toString(),
    })),
  };
}
