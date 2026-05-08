import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Get(':fileId')
  download(@Param('fileId') fileId: string, @Res() res: Response) {
    const entry = this.files.get(fileId);
    if (!entry) {
      throw new NotFoundException({ success: false, error: 'File not found' });
    }
    res.setHeader('Content-Type', entry.mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(entry.filename)}"`,
    );
    res.send(entry.buffer);
  }
}
