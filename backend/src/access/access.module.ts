import { Module } from '@nestjs/common';
import { TicketAccessPolicy } from './ticket-access.policy';

@Module({ providers: [TicketAccessPolicy], exports: [TicketAccessPolicy] })
export class AccessModule {}
