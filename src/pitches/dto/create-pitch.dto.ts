import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PitchStatus, PitchTargetStatus } from '@prisma/client';

export class TargetArtistInput {
  @ApiProperty({ example: 'Dua Lipa' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ enum: PitchTargetStatus })
  @IsOptional()
  @IsEnum(PitchTargetStatus)
  status?: PitchTargetStatus;
}

export class CreatePitchDto {
  @ApiProperty({ example: 'Great for a summer single — uptempo pop with a strong hook.' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description: string;

  @ApiPropertyOptional({ enum: PitchStatus })
  @IsOptional()
  @IsEnum(PitchStatus)
  status?: PitchStatus;

  @ApiPropertyOptional({ type: [String], example: ['pop', 'summer'] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ type: [TargetArtistInput] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TargetArtistInput)
  targetArtists?: TargetArtistInput[];
}
