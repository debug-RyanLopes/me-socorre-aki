import { Body, Controller, Get, Put } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdatePriorityRulesDto } from './dto/priority-rules.dto';
import { PriorityRulesService } from './priority-rules.service';

@Roles('ADMIN')
@Controller('priority-rules')
export class PriorityRulesController {
  constructor(private readonly rules: PriorityRulesService) {}

  @Get()
  get() {
    return this.rules.getRules();
  }

  @Put()
  put(@Body() dto: UpdatePriorityRulesDto) {
    return this.rules.replaceRules(dto);
  }
}
