import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthUser } from '../auth/auth-user.interface';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { ErrorResponse } from '../common/dto/error-response.dto';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { LinkSongwriterDto } from './dto/link-songwriter.dto';
import {
  MemberResponse,
  OrganizationResponse,
  toMemberResponse,
  toOrganizationResponse,
} from './organizations.mapper';

@ApiTags('organizations')
@ApiAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @Roles(UserRole.MANAGER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create an organization (managers only)' })
  @ApiCreatedResponse({ description: 'Organization created', type: OrganizationResponse })
  @ApiBadRequestResponse({ description: 'Validation failed', type: ErrorResponse })
  @ApiForbiddenResponse({ description: 'Caller is not a MANAGER', type: ErrorResponse })
  async create(
    @Body() dto: CreateOrganizationDto,
    @Req() req: Request,
  ): Promise<OrganizationResponse> {
    return toOrganizationResponse(await this.organizationsService.create(dto, req.headers));
  }

  @Get()
  @ApiOperation({ summary: 'List organizations the current user belongs to' })
  @ApiOkResponse({
    description: 'Organizations the caller belongs to',
    type: [OrganizationResponse],
  })
  async list(@CurrentUser() user: AuthUser): Promise<OrganizationResponse[]> {
    const orgs = await this.organizationsService.listForUser(user.id);
    return orgs.map(toOrganizationResponse);
  }

  @Get(':id')
  @UseGuards(OrgMembershipGuard)
  @ApiOperation({ summary: 'Get an organization by id (members only)' })
  @ApiParam({ name: 'id', description: 'Organization id' })
  @ApiOkResponse({ description: 'The requested organization', type: OrganizationResponse })
  @ApiForbiddenResponse({ description: 'Caller is not a member', type: ErrorResponse })
  @ApiNotFoundResponse({ description: 'Organization not found', type: ErrorResponse })
  async getById(@Param('id') id: string): Promise<OrganizationResponse> {
    return toOrganizationResponse(await this.organizationsService.getByIdOrThrow(id));
  }

  @Get(':id/members')
  @UseGuards(OrgMembershipGuard)
  @ApiOperation({ summary: 'List members of an organization (members only)' })
  @ApiParam({ name: 'id', description: 'Organization id' })
  @ApiOkResponse({ description: 'Members of the organization', type: [MemberResponse] })
  @ApiForbiddenResponse({ description: 'Caller is not a member', type: ErrorResponse })
  async members(@Param('id') id: string): Promise<MemberResponse[]> {
    const members = await this.organizationsService.listMembers(id);
    return members.map(toMemberResponse);
  }

  @Post(':id/songwriters')
  @Roles(UserRole.MANAGER)
  @UseGuards(RolesGuard, OrgMembershipGuard)
  @ApiOperation({ summary: 'Link a songwriter to the organization by email (managers only)' })
  @ApiParam({ name: 'id', description: 'Organization id' })
  @ApiCreatedResponse({ description: 'Songwriter linked as a member', type: MemberResponse })
  @ApiBadRequestResponse({ description: 'Validation failed', type: ErrorResponse })
  @ApiForbiddenResponse({ description: 'Caller is not a MANAGER of this org', type: ErrorResponse })
  @ApiNotFoundResponse({ description: 'Organization or user email not found', type: ErrorResponse })
  @ApiConflictResponse({ description: 'User is already a member', type: ErrorResponse })
  async linkSongwriter(
    @Param('id') id: string,
    @Body() dto: LinkSongwriterDto,
    @Req() req: Request,
  ): Promise<MemberResponse> {
    return toMemberResponse(
      await this.organizationsService.linkSongwriter(id, dto.email, req.headers),
    );
  }
}
