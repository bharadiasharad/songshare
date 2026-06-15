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
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthUser } from '../auth/auth-user.interface';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginatedResult } from '../common/dto/paginated';
import { FileValidationPipe } from '../storage/pipes/file-validation.pipe';
import { SongsService } from './songs.service';
import { CreateSongDto } from './dto/create-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import { QuerySongsDto } from './dto/query-songs.dto';
import { SongResponse, toSongResponse } from './songs.mapper';

@ApiTags('songs')
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
        file: { type: 'string', format: 'binary' },
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
  async upload(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSongDto,
    @UploadedFile(FileValidationPipe) file: Express.Multer.File,
  ): Promise<SongResponse> {
    return toSongResponse(await this.songsService.upload(user, dto, file));
  }

  @Get()
  @ApiOperation({ summary: 'List/filter songs within the user’s organizations' })
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: QuerySongsDto,
  ): Promise<PaginatedResult<SongResponse>> {
    const result = await this.songsService.list(user, query);
    return { data: result.data.map(toSongResponse), meta: result.meta };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a song by id (org members only)' })
  async getById(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<SongResponse> {
    return toSongResponse(await this.songsService.getAuthorized(user, id));
  }

  @Get(':id/file')
  @ApiOperation({ summary: 'Stream/download the song audio (org members only)' })
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
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.songsService.remove(user, id);
  }
}
