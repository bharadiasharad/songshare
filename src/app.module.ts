import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/guards/auth.guard';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { SongsModule } from './songs/songs.module';
import { PitchesModule } from './pitches/pitches.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    StorageModule,
    UsersModule,
    OrganizationsModule,
    SongsModule,
    PitchesModule,
  ],
  providers: [
    // Authentication is enforced globally; opt out with @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
