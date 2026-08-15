import { Module } from '@nestjs/common';
import { FilesUploadController } from './files-upload.controller';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  controllers: [FilesController, FilesUploadController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
