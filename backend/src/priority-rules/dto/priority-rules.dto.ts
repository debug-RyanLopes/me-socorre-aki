import { Priority, PriorityQuestion } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsString, Max, Min, ValidateNested } from 'class-validator';
import { MAX_SCORE } from '../priority.util';

export class WeightDto {
  @IsEnum(PriorityQuestion)
  question: PriorityQuestion;

  @IsString()
  option: string;

  @IsInt({ message: 'Os pontos devem ser um número inteiro.' })
  @Min(0, { message: 'Os pontos não podem ser negativos.' })
  @Max(MAX_SCORE, { message: `Cada resposta vale no máximo ${MAX_SCORE} pontos.` })
  points: number;
}

export class ThresholdDto {
  @IsEnum(Priority)
  priority: Priority;

  @IsInt({ message: 'A pontuação mínima deve ser um número inteiro.' })
  @Min(0, { message: 'A pontuação mínima não pode ser negativa.' })
  @Max(MAX_SCORE, { message: `A pontuação mínima vai até ${MAX_SCORE}, a pontuação máxima de um chamado.` })
  minScore: number;
}

export class UpdatePriorityRulesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WeightDto)
  weights: WeightDto[];

  @IsArray()
  @ArrayMinSize(4)
  @ValidateNested({ each: true })
  @Type(() => ThresholdDto)
  thresholds: ThresholdDto[];
}
