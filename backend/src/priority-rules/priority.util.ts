import { Priority, PriorityQuestion } from '@prisma/client';

export interface Threshold {
  priority: Priority;
  minScore: number;
}

export interface Weight {
  question: PriorityQuestion;
  option: string;
  points: number;
}

export interface ImpactAnswers {
  affected: string;
  blocking: string;
  alternative: string;
}

export const IMPACT_OPTIONS: Record<PriorityQuestion, string[]> = {
  AFFECTED: ['SELF', 'FEW', 'SECTOR', 'COMPANY'],
  BLOCKING: ['NONE', 'LIMITED', 'BLOCKED'],
  ALTERNATIVE: ['YES', 'UNKNOWN', 'NO'],
};

export const DEFAULT_WEIGHTS: Weight[] = [
  { question: 'AFFECTED', option: 'SELF', points: 0 },
  { question: 'AFFECTED', option: 'FEW', points: 1 },
  { question: 'AFFECTED', option: 'SECTOR', points: 2 },
  { question: 'AFFECTED', option: 'COMPANY', points: 3 },
  { question: 'BLOCKING', option: 'NONE', points: 0 },
  { question: 'BLOCKING', option: 'LIMITED', points: 1 },
  { question: 'BLOCKING', option: 'BLOCKED', points: 2 },
  { question: 'ALTERNATIVE', option: 'YES', points: 0 },
  { question: 'ALTERNATIVE', option: 'UNKNOWN', points: 1 },
  { question: 'ALTERNATIVE', option: 'NO', points: 1 },
];

export const DEFAULT_THRESHOLDS: Threshold[] = [
  { priority: 'LOW', minScore: 0 },
  { priority: 'MEDIUM', minScore: 1 },
  { priority: 'HIGH', minScore: 3 },
  { priority: 'CRITICAL', minScore: 5 },
];

export function scoreAnswers(weights: Weight[], answers: ImpactAnswers): number {
  const lookup = (question: PriorityQuestion, option: string): number =>
    weights.find((w) => w.question === question && w.option === option)?.points ?? 0;
  return (
    lookup('AFFECTED', answers.affected) +
    lookup('BLOCKING', answers.blocking) +
    lookup('ALTERNATIVE', answers.alternative)
  );
}

export function suggestPriority(score: number, thresholds: Threshold[]): Priority {
  const ordered = [...thresholds].sort((a, b) => b.minScore - a.minScore);
  const hit = ordered.find((t) => score >= t.minScore) ?? ordered[ordered.length - 1];
  return hit.priority;
}
