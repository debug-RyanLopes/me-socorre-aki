import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { StorageService } from './storage.service';

@Module({
  imports: [AccessModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, StorageService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
