import { Module } from '@nestjs/common';
import { FilesUploadController } from './files-upload.controller.js';
import { FilesController } from './files.controller.js';
import { FilesService } from './files.service.js';

@Module({
  controllers: [FilesController, FilesUploadController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
