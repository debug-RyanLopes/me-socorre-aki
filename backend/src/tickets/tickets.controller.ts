import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { uploadLimits } from '../attachments/file-validation';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsQuery } from './dto/list-tickets.query';
import {
  AssignDto,
  ChangePriorityDto,
  CorrectSerialDto,
  ReasonDto,
  RequestInfoDto,
  ResolveDto,
  TriageDto,
} from './dto/ticket-actions.dto';
import { TicketsService } from './tickets.service';

const limits = uploadLimits();

@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Roles('EMPLOYEE')
  @Post()
  @UseInterceptors(
    FilesInterceptor('files', limits.maxFiles, { storage: memoryStorage(), limits: { fileSize: limits.maxBytes } }),
  )
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTicketDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ) {
    return this.tickets.create(user, dto, files);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListTicketsQuery) {
    return this.tickets.list(user, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.tickets.getDetail(user, id);
  }

  @Roles('TECHNICIAN', 'ADMIN')
  @Post(':id/assume')
  @HttpCode(200)
  assume(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.tickets.perform(user, id, 'ASSIGN', { assigneeId: user.id });
  }

  @Roles('ADMIN')
  @Post(':id/assign')
  @HttpCode(200)
  assign(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: AssignDto) {
    return this.tickets.perform(user, id, 'ASSIGN', { assigneeId: dto.assigneeId });
  }

  @Roles('TECHNICIAN', 'ADMIN')
  @Post(':id/triage')
  @HttpCode(200)
  triage(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: TriageDto) {
    return this.tickets.perform(user, id, 'TRIAGE', dto);
  }

  @Roles('TECHNICIAN', 'ADMIN')
  @Post(':id/priority')
  @HttpCode(200)
  priority(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ChangePriorityDto) {
    return this.tickets.changePriority(user, id, dto.priority, dto.justification);
  }

  @Roles('TECHNICIAN', 'ADMIN')
  @Post(':id/serial')
  @HttpCode(200)
  serial(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: CorrectSerialDto) {
    return this.tickets.correctSerial(user, id, dto.serial);
  }

  @Roles('TECHNICIAN', 'ADMIN')
  @Post(':id/request-info')
  @HttpCode(200)
  requestInfo(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: RequestInfoDto) {
    return this.tickets.perform(user, id, 'REQUEST_INFO', dto);
  }

  @Roles('TECHNICIAN', 'ADMIN')
  @Post(':id/resolve')
  @HttpCode(200)
  resolve(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ResolveDto) {
    return this.tickets.perform(user, id, 'RESOLVE', dto);
  }

  @Roles('EMPLOYEE')
  @Post(':id/confirm')
  @HttpCode(200)
  confirm(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.tickets.perform(user, id, 'CONFIRM');
  }

  @Roles('EMPLOYEE')
  @Post(':id/reject-resolution')
  @HttpCode(200)
  rejectResolution(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ReasonDto) {
    return this.tickets.perform(user, id, 'REJECT_RESOLUTION', dto);
  }

  @Roles('EMPLOYEE')
  @Post(':id/reopen')
  @HttpCode(200)
  reopen(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ReasonDto) {
    return this.tickets.perform(user, id, 'REOPEN', dto);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ReasonDto) {
    return this.tickets.perform(user, id, 'CANCEL', dto);
  }
}
