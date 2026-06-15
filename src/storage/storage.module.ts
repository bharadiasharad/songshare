import { Global, Module } from '@nestjs/common';
import { STORAGE_SERVICE } from './storage.service';
import { LocalDiskStorage } from './local-disk.storage';
import { FileValidationPipe } from './pipes/file-validation.pipe';

/**
 * Binds the STORAGE_SERVICE token to the local-disk implementation. To switch
 * backends, change only this provider mapping.
 */
@Global()
@Module({
  providers: [{ provide: STORAGE_SERVICE, useClass: LocalDiskStorage }, FileValidationPipe],
  exports: [STORAGE_SERVICE, FileValidationPipe],
})
export class StorageModule {}
