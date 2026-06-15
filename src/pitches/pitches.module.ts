import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SongsModule } from '../songs/songs.module';
import { PitchesController } from './pitches.controller';
import { PitchesService } from './pitches.service';
import { PitchesRepository } from './pitches.repository';

@Module({
  imports: [OrganizationsModule, SongsModule],
  controllers: [PitchesController],
  providers: [PitchesService, PitchesRepository],
  exports: [PitchesService],
})
export class PitchesModule {}
