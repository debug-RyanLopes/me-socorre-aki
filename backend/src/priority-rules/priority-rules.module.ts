import { Module } from '@nestjs/common';
import { PriorityRulesController } from './priority-rules.controller';
import { PriorityRulesService } from './priority-rules.service';

@Module({
  controllers: [PriorityRulesController],
  providers: [PriorityRulesService],
  exports: [PriorityRulesService],
})
export class PriorityRulesModule {}
