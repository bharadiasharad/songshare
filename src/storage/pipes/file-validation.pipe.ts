import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';

const ALLOWED_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
]);

/**
 * Validates an uploaded audio file: presence, MIME whitelist and size cap.
 */
@Injectable()
export class FileValidationPipe implements PipeTransform<Express.Multer.File> {
  private readonly maxBytes: number;

  constructor(config: ConfigService<AppConfig, true>) {
    this.maxBytes = config.get('storage.maxUploadBytes', { infer: true });
  }

  transform(file: Express.Multer.File | undefined): Express.Multer.File {
    if (!file) {
      throw new BadRequestException('An audio file is required (field name: "file")');
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}`,
      );
    }
    if (file.size > this.maxBytes) {
      throw new BadRequestException(`File exceeds the maximum size of ${this.maxBytes} bytes`);
    }
    return file;
  }
}
