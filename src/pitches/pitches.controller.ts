import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';
import { ErrorResponse } from '../common/dto/error-response.dto';
import { PaginatedResult } from '../common/dto/paginated';
import { PitchesService } from './pitches.service';
import { CreatePitchDto } from './dto/create-pitch.dto';
import { UpdatePitchDto } from './dto/update-pitch.dto';
import { QueryPitchesDto } from './dto/query-pitches.dto';
import { PitchResponse, toPitchResponse } from './pitches.mapper';

@ApiTags('pitches')
@ApiAuth()
@Controller()
export class PitchesController {
  constructor(private readonly pitchesService: PitchesService) {}

  @Post('songs/:songId/pitches')
  @ApiOperation({ summary: 'Create a pitch for a song (managers of the song’s org)' })
  @ApiParam({ name: 'songId', description: 'Song the pitch is for' })
  @ApiCreatedResponse({ description: 'Pitch created with tags + targets', type: PitchResponse })
  @ApiBadRequestResponse({ description: 'Validation failed', type: ErrorResponse })
  @ApiForbiddenResponse({
    description: 'Caller is not a MANAGER of the song’s org',
    type: ErrorResponse,
  })
  @ApiNotFoundResponse({ description: 'Song not found', type: ErrorResponse })
  async create(
    @CurrentUser() user: AuthUser,
    @Param('songId') songId: string,
    @Body() dto: CreatePitchDto,
  ): Promise<PitchResponse> {
    return toPitchResponse(await this.pitchesService.create(user, songId, dto));
  }

  @Get('pitches')
  @ApiOperation({ summary: 'List/filter pitches within the user’s organizations' })
  @ApiPaginatedResponse(PitchResponse)
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryPitchesDto,
  ): Promise<PaginatedResult<PitchResponse>> {
    const result = await this.pitchesService.list(user, query);
    return { data: result.data.map(toPitchResponse), meta: result.meta };
  }

  @Get('pitches/:id')
  @ApiOperation({ summary: 'Get a pitch by id (org members only)' })
  @ApiParam({ name: 'id', description: 'Pitch id' })
  @ApiOkResponse({ description: 'The requested pitch', type: PitchResponse })
  @ApiForbiddenResponse({ description: 'Caller is not a member of the org', type: ErrorResponse })
  @ApiNotFoundResponse({ description: 'Pitch not found', type: ErrorResponse })
  async getById(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<PitchResponse> {
    return toPitchResponse(await this.pitchesService.getAuthorized(user, id));
  }

  @Patch('pitches/:id')
  @ApiOperation({ summary: 'Update a pitch (creator or org manager)' })
  @ApiParam({ name: 'id', description: 'Pitch id' })
  @ApiOkResponse({ description: 'The updated pitch', type: PitchResponse })
  @ApiBadRequestResponse({ description: 'Validation failed', type: ErrorResponse })
  @ApiForbiddenResponse({ description: 'Caller may not modify this pitch', type: ErrorResponse })
  @ApiNotFoundResponse({ description: 'Pitch not found', type: ErrorResponse })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePitchDto,
  ): Promise<PitchResponse> {
    return toPitchResponse(await this.pitchesService.update(user, id, dto));
  }
}
