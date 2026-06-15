import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { OrgMembershipGuard } from './guards/org-membership.guard';

/**
 * Exposes the better-auth handler and shares the auth guards/utilities app-wide.
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthGuard, RolesGuard, OrgMembershipGuard],
  exports: [AuthGuard, RolesGuard, OrgMembershipGuard],
})
export class AuthModule {}
