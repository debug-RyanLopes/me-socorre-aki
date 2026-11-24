import { Controller, Get, Param, ParseIntPipe, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AttachmentsService } from './attachments.service';

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get(':id')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { attachment, stream } = await this.attachments.openForDownload(user, id);
    res.set({
      'Content-Type': attachment.mime,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(stream);
  }
}
