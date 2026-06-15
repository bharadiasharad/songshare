import { PartialType } from '@nestjs/swagger';
import { CreatePitchDto } from './create-pitch.dto';

/**
 * Partial update. If `tags` or `targetArtists` are provided, they fully replace
 * the existing sets (handled atomically in the repository).
 */
export class UpdatePitchDto extends PartialType(CreatePitchDto) {}
