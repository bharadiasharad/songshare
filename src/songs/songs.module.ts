import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';
import { SongsRepository } from './songs.repository';

@Module({
  imports: [OrganizationsModule],
  controllers: [SongsController],
  providers: [SongsService, SongsRepository],
  exports: [SongsService, SongsRepository],
})
export class SongsModule {}
