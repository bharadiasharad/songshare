import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthUser } from '../auth/auth-user.interface';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';
import { ErrorResponse } from '../common/dto/error-response.dto';
import { PaginatedResult } from '../common/dto/paginated';
import { FileValidationPipe } from '../storage/pipes/file-validation.pipe';
import { SongsService } from './songs.service';
import { CreateSongDto } from './dto/create-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import { QuerySongsDto } from './dto/query-songs.dto';
import { SongResponse, toSongResponse } from './songs.mapper';

@ApiTags('songs')
@ApiAuth()
@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @Post()
  @Roles(UserRole.SONGWRITER)
  @UseGuards(RolesGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES ?? 26_214_400) },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a song with its audio file (songwriters only)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'organizationId', 'title'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Audio file (mp3/wav/m4a/aac/ogg)' },
        organizationId: { type: 'string' },
        title: { type: 'string' },
        primaryArtist: { type: 'string' },
        durationSec: { type: 'number' },
        bpm: { type: 'number' },
        musicalKey: { type: 'string' },
        genre: { type: 'string' },
        lyrics: { type: 'string' },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Song created with its asset', type: SongResponse })
  @ApiBadRequestResponse({ description: 'Missing/invalid file or fields', type: ErrorResponse })
  @ApiForbiddenResponse({
    description: 'Caller is not a SONGWRITER, or not a member of the org',
    type: ErrorResponse,
  })
  @ApiPayloadTooLargeResponse({ description: 'File exceeds MAX_UPLOAD_BYTES', type: ErrorResponse })
  async upload(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSongDto,
    @UploadedFile(FileValidationPipe) file: Express.Multer.File,
  ): Promise<SongResponse> {
    return toSongResponse(await this.songsService.upload(user, dto, file));
  }

  @Get()
  @ApiOperation({ summary: 'List/filter songs within the user’s organizations' })
  @ApiPaginatedResponse(SongResponse)
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: QuerySongsDto,
  ): Promise<PaginatedResult<SongResponse>> {
    const result = await this.songsService.list(user, query);
    return { data: result.data.map(toSongResponse), meta: result.meta };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a song by id (org members only)' })
  @ApiParam({ name: 'id', description: 'Song id' })
  @ApiOkResponse({ description: 'The requested song', type: SongResponse })
  @ApiForbiddenResponse({
    description: 'Caller is not a member of the song’s org',
    type: ErrorResponse,
  })
  @ApiNotFoundResponse({ description: 'Song not found', type: ErrorResponse })
  async getById(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<SongResponse> {
    return toSongResponse(await this.songsService.getAuthorized(user, id));
  }

  @Get(':id/file')
  @ApiOperation({ summary: 'Stream/download the song audio (org members only)' })
  @ApiParam({ name: 'id', description: 'Song id' })
  @ApiProduces('audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/ogg')
  @ApiOkResponse({
    description: 'Binary audio stream (Content-Disposition: attachment)',
    content: { 'audio/*': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiForbiddenResponse({
    description: 'Caller is not a member of the song’s org',
    type: ErrorResponse,
  })
  @ApiNotFoundResponse({ description: 'Song or audio file not found', type: ErrorResponse })
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, mimeType, filename } = await this.songsService.getFileStream(user, id);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    return new StreamableFile(stream);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update song metadata/status (uploader or org manager)' })
  @ApiParam({ name: 'id', description: 'Song id' })
  @ApiOkResponse({ description: 'The updated song', type: SongResponse })
  @ApiBadRequestResponse({ description: 'Validation failed', type: ErrorResponse })
  @ApiForbiddenResponse({ description: 'Caller may not modify this song', type: ErrorResponse })
  @ApiNotFoundResponse({ description: 'Song not found', type: ErrorResponse })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSongDto,
  ): Promise<SongResponse> {
    return toSongResponse(await this.songsService.update(user, id, dto));
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a song and its files (uploader or org manager)' })
  @ApiParam({ name: 'id', description: 'Song id' })
  @ApiNoContentResponse({ description: 'Song deleted (cascades to assets/pitches)' })
  @ApiForbiddenResponse({ description: 'Caller may not delete this song', type: ErrorResponse })
  @ApiNotFoundResponse({ description: 'Song not found', type: ErrorResponse })
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.songsService.remove(user, id);
  }
}
