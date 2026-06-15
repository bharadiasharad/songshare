import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/**
 * Song metadata sent alongside the multipart audio file. Numeric fields arrive as
 * strings in multipart form-data, so @Type coerces them.
 */
export class CreateSongDto {
  @ApiProperty({ description: 'Organization the song belongs to' })
  @IsString()
  @MinLength(1)
  organizationId: string;

  @ApiProperty({ example: 'Summer Nights' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Demo Vocalist' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  primaryArtist?: string;

  @ApiPropertyOptional({ example: 187 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(86_400)
  durationSec?: number;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(400)
  bpm?: number;

  @ApiPropertyOptional({ example: 'C#m' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  musicalKey?: string;

  @ApiPropertyOptional({ example: 'pop' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  genre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  lyrics?: string;
}
