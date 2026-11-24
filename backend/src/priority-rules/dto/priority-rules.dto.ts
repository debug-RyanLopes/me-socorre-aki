import { Priority, PriorityQuestion } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsString, Max, Min, ValidateNested } from 'class-validator';

export class WeightDto {
  @IsEnum(PriorityQuestion)
  question: PriorityQuestion;

  @IsString()
  option: string;

  @IsInt()
  @Min(0)
  @Max(10)
  points: number;
}

export class ThresholdDto {
  @IsEnum(Priority)
  priority: Priority;

  @IsInt()
  @Min(0)
  @Max(100)
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
