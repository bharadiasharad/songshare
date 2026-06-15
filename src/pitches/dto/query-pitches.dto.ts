import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PitchStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryPitchesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by song' })
  @IsOptional()
  @IsString()
  songId?: string;

  @ApiPropertyOptional({ enum: PitchStatus })
  @IsOptional()
  @IsEnum(PitchStatus)
  status?: PitchStatus;
}
