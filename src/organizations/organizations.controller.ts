import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthUser } from '../auth/auth-user.interface';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
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
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @Roles(UserRole.MANAGER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create an organization (managers only)' })
  async create(
    @Body() dto: CreateOrganizationDto,
    @Req() req: Request,
  ): Promise<OrganizationResponse> {
    return toOrganizationResponse(await this.organizationsService.create(dto, req.headers));
  }

  @Get()
  @ApiOperation({ summary: 'List organizations the current user belongs to' })
  async list(@CurrentUser() user: AuthUser): Promise<OrganizationResponse[]> {
    const orgs = await this.organizationsService.listForUser(user.id);
    return orgs.map(toOrganizationResponse);
  }

  @Get(':id')
  @UseGuards(OrgMembershipGuard)
  @ApiOperation({ summary: 'Get an organization by id (members only)' })
  async getById(@Param('id') id: string): Promise<OrganizationResponse> {
    return toOrganizationResponse(await this.organizationsService.getByIdOrThrow(id));
  }

  @Get(':id/members')
  @UseGuards(OrgMembershipGuard)
  @ApiOperation({ summary: 'List members of an organization (members only)' })
  async members(@Param('id') id: string): Promise<MemberResponse[]> {
    const members = await this.organizationsService.listMembers(id);
    return members.map(toMemberResponse);
  }

  @Post(':id/songwriters')
  @Roles(UserRole.MANAGER)
  @UseGuards(RolesGuard, OrgMembershipGuard)
  @ApiOperation({ summary: 'Link a songwriter to the organization by email (managers only)' })
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
