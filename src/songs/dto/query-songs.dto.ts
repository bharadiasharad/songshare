import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SongStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/** Filters for GET /songs. */
export class QuerySongsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Restrict to a single organization' })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  genre?: string;

  @ApiPropertyOptional({ enum: SongStatus })
  @IsOptional()
  @IsEnum(SongStatus)
  status?: SongStatus;

  @ApiPropertyOptional({ description: 'Filter by uploader (songwriter) user id' })
  @IsOptional()
  @IsString()
  songwriterId?: string;

  @ApiPropertyOptional({ description: 'Free-text search over title and primary artist' })
  @IsOptional()
  @IsString()
  q?: string;
}
