import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PriorityRulesModule } from '../priority-rules/priority-rules.module';
import { TicketEventsService } from './ticket-events.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [AccessModule, AttachmentsModule, NotificationsModule, PriorityRulesModule],
  controllers: [TicketsController],
  providers: [TicketsService, TicketEventsService],
  exports: [TicketsService],
})
export class TicketsModule {}
