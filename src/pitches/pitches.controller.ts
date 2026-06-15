import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';
import { PaginatedResult } from '../common/dto/paginated';
import { PitchesService } from './pitches.service';
import { CreatePitchDto } from './dto/create-pitch.dto';
import { UpdatePitchDto } from './dto/update-pitch.dto';
import { QueryPitchesDto } from './dto/query-pitches.dto';
import { PitchResponse, toPitchResponse } from './pitches.mapper';

@ApiTags('pitches')
@Controller()
export class PitchesController {
  constructor(private readonly pitchesService: PitchesService) {}

  @Post('songs/:songId/pitches')
  @ApiOperation({ summary: 'Create a pitch for a song (managers of the song’s org)' })
  async create(
    @CurrentUser() user: AuthUser,
    @Param('songId') songId: string,
    @Body() dto: CreatePitchDto,
  ): Promise<PitchResponse> {
    return toPitchResponse(await this.pitchesService.create(user, songId, dto));
  }

  @Get('pitches')
  @ApiOperation({ summary: 'List/filter pitches within the user’s organizations' })
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryPitchesDto,
  ): Promise<PaginatedResult<PitchResponse>> {
    const result = await this.pitchesService.list(user, query);
    return { data: result.data.map(toPitchResponse), meta: result.meta };
  }

  @Get('pitches/:id')
  @ApiOperation({ summary: 'Get a pitch by id (org members only)' })
  async getById(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<PitchResponse> {
    return toPitchResponse(await this.pitchesService.getAuthorized(user, id));
  }

  @Patch('pitches/:id')
  @ApiOperation({ summary: 'Update a pitch (creator or org manager)' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePitchDto,
  ): Promise<PitchResponse> {
    return toPitchResponse(await this.pitchesService.update(user, id, dto));
  }
}
