import { Module } from '@nestjs/common';
import { AdminFilesController } from './admin-files.controller';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  controllers: [FilesController, AdminFilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
