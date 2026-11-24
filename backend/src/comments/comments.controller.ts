import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { uploadLimits } from '../attachments/file-validation';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

const limits = uploadLimits();

@Controller('tickets/:ticketId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('ticketId', ParseIntPipe) ticketId: number) {
    return this.comments.list(user, ticketId);
  }

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', limits.maxFiles, { storage: memoryStorage(), limits: { fileSize: limits.maxBytes } }),
  )
  create(
    @CurrentUser() user: AuthUser,
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Body() dto: CreateCommentDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ) {
    return this.comments.create(user, ticketId, dto, files);
  }
}
