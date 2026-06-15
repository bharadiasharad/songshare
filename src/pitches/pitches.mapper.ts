import { ApiProperty } from '@nestjs/swagger';
import { Artist, Pitch, PitchStatus, PitchTag, PitchTarget, Tag } from '@prisma/client';

export class PitchTargetResponse {
  @ApiProperty() artistId: string;
  @ApiProperty() artistName: string;
  @ApiProperty() status: string;
  @ApiProperty({ nullable: true }) note: string | null;
}

export class PitchResponse {
  @ApiProperty() id: string;
  @ApiProperty() songId: string;
  @ApiProperty() createdById: string;
  @ApiProperty() description: string;
  @ApiProperty({ enum: PitchStatus }) status: PitchStatus;
  @ApiProperty({ type: [String] }) tags: string[];
  @ApiProperty({ type: [PitchTargetResponse] }) targets: PitchTargetResponse[];
  @ApiProperty() createdAt: Date;
}

export type PitchWithRelations = Pitch & {
  tags: (PitchTag & { tag: Tag })[];
  targets: (PitchTarget & { artist: Artist })[];
};

export function toPitchResponse(pitch: PitchWithRelations): PitchResponse {
  return {
    id: pitch.id,
    songId: pitch.songId,
    createdById: pitch.createdById,
    description: pitch.description,
    status: pitch.status,
    tags: pitch.tags.map((pt) => pt.tag.name),
    targets: pitch.targets.map((t) => ({
      artistId: t.artistId,
      artistName: t.artist.name,
      status: t.status,
      note: t.note,
    })),
    createdAt: pitch.createdAt,
  };
}
