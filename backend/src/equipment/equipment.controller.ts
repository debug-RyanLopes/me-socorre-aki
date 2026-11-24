import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateEquipmentDto, ListEquipmentQuery, UpdateEquipmentDto } from './dto/equipment.dto';
import { EquipmentService } from './equipment.service';

@Roles('TECHNICIAN', 'ADMIN')
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}

  @Get()
  list(@Query() query: ListEquipmentQuery) {
    return this.equipment.list(query);
  }

  @Get('pending')
  pending() {
    return this.equipment.pending();
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateEquipmentDto) {
    return this.equipment.create(actor, dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEquipmentDto) {
    return this.equipment.update(id, dto);
  }
}
