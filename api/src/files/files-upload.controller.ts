import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ok } from '../common/api-response';
import { FilesService } from './files.service';

@Controller('files')
export class FilesUploadController {
  constructor(private readonly files: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  upload(
    @UploadedFile()
    file?: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({ success: false, error: 'Missing file' });
    }
    const data = this.files.saveUpload(file.originalname, file.mimetype, file.buffer);
    return ok(data);
  }
}
