import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { SongStatus } from '@prisma/client';
import { CreateSongDto } from './create-song.dto';

/**
 * All metadata fields optional; organizationId cannot be changed after upload.
 * Status can be updated (e.g. DRAFT -> READY).
 */
export class UpdateSongDto extends PartialType(
  OmitType(CreateSongDto, ['organizationId'] as const),
) {
  @ApiPropertyOptional({ enum: SongStatus })
  @IsOptional()
  @IsEnum(SongStatus)
  status?: SongStatus;
}
