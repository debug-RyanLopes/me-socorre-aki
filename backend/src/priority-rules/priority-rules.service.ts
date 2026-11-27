import { BadRequestException, Injectable } from '@nestjs/common';
import { Priority } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePriorityRulesDto } from './dto/priority-rules.dto';
import {
  IMPACT_OPTIONS,
  ImpactAnswers,
  MAX_SCORE,
  Threshold,
  Weight,
  scoreAnswers,
  suggestPriority,
} from './priority.util';

export interface PriorityRules {
  weights: Weight[];
  thresholds: Threshold[];
  maxScore: number;
}

const PRIORITY_ORDER: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

@Injectable()
export class PriorityRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async getRules(): Promise<PriorityRules> {
    const [weights, thresholds] = await Promise.all([
      this.prisma.priorityWeight.findMany({ orderBy: [{ question: 'asc' }, { id: 'asc' }] }),
      this.prisma.priorityThreshold.findMany({ orderBy: { minScore: 'asc' } }),
    ]);
    return {
      weights: weights.map(({ question, option, points }) => ({ question, option, points })),
      thresholds: thresholds.map(({ priority, minScore }) => ({ priority, minScore })),
      maxScore: MAX_SCORE,
    };
  }

  async replaceRules(dto: UpdatePriorityRulesDto): Promise<PriorityRules> {
    this.validateRules(dto);
    await this.prisma.$transaction([
      this.prisma.priorityWeight.deleteMany(),
      this.prisma.priorityThreshold.deleteMany(),
      this.prisma.priorityWeight.createMany({ data: dto.weights }),
      this.prisma.priorityThreshold.createMany({ data: dto.thresholds }),
    ]);
    return this.getRules();
  }

  async suggest(answers: ImpactAnswers): Promise<Priority> {
    const { weights, thresholds } = await this.getRules();
    return suggestPriority(scoreAnswers(weights, answers), thresholds);
  }

  private validateRules(dto: UpdatePriorityRulesDto): void {
    for (const [question, options] of Object.entries(IMPACT_OPTIONS)) {
      for (const option of options) {
        const count = dto.weights.filter((w) => w.question === question && w.option === option).length;
        if (count !== 1) throw new BadRequestException(`Defina exatamente um valor para ${question}/${option}.`);
      }
    }
    if (dto.weights.length !== Object.values(IMPACT_OPTIONS).flat().length) {
      throw new BadRequestException('Há respostas desconhecidas nas regras de prioridade.');
    }
    const ordered = PRIORITY_ORDER.map((priority) => dto.thresholds.find((t) => t.priority === priority));
    if (ordered.some((t) => !t) || dto.thresholds.length !== PRIORITY_ORDER.length) {
      throw new BadRequestException('Informe um limiar para cada prioridade.');
    }
    const scores = ordered.map((t) => t!.minScore);
    if (scores[0] !== 0) throw new BadRequestException('O limiar da prioridade Baixa deve ser 0.');
    for (let i = 1; i < scores.length; i += 1) {
      if (scores[i] <= scores[i - 1]) {
        throw new BadRequestException('Os limiares devem crescer de Baixa até Crítica.');
      }
    }
  }
}
