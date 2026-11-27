import { describe, expect, it } from 'vitest';
import type { PriorityRules } from '../lib/types';
import { highestScore, validateRules } from './PriorityRulesPage';

function rules(thresholds: [number, number, number, number], weights: number[] = [1, 3, 7, 10, 1, 2, 6, 0, 1, 2]): PriorityRules {
  const options: [PriorityRules['weights'][number]['question'], string][] = [
    ['AFFECTED', 'SELF'],
    ['AFFECTED', 'FEW'],
    ['AFFECTED', 'SECTOR'],
    ['AFFECTED', 'COMPANY'],
    ['BLOCKING', 'NONE'],
    ['BLOCKING', 'LIMITED'],
    ['BLOCKING', 'BLOCKED'],
    ['ALTERNATIVE', 'YES'],
    ['ALTERNATIVE', 'UNKNOWN'],
    ['ALTERNATIVE', 'NO'],
  ];
  return {
    maxScore: 10,
    weights: options.map(([question, option], i) => ({ question, option, points: weights[i] })),
    thresholds: [
      { priority: 'LOW', minScore: thresholds[0] },
      { priority: 'MEDIUM', minScore: thresholds[1] },
      { priority: 'HIGH', minScore: thresholds[2] },
      { priority: 'CRITICAL', minScore: thresholds[3] },
    ],
  };
}

describe('regras de prioridade', () => {
  it('aceita regras coerentes dentro do limite de 10', () => {
    expect(validateRules(rules([0, 4, 7, 9]))).toBeNull();
    expect(validateRules(rules([0, 4, 7, 10]))).toBeNull();
  });

  it('recusa pontuação mínima acima de 10', () => {
    expect(validateRules(rules([0, 4, 7, 112]))).toMatch(/vai até 10/);
  });

  it('recusa resposta com mais de 10 pontos', () => {
    expect(validateRules(rules([0, 4, 7, 9], [11, 3, 7, 10, 1, 2, 6, 0, 1, 2]))).toMatch(/de 0 a 10/);
  });

  it('exige pontuações mínimas crescentes', () => {
    expect(validateRules(rules([0, 7, 7, 9]))).toMatch(/Alta precisa ser maior que a de Média/);
  });

  it('a pontuação alcançável nunca passa de 10', () => {
    expect(highestScore(rules([0, 4, 7, 9]))).toBe(10);
    expect(highestScore(rules([0, 4, 7, 9], [0, 1, 1, 2, 0, 1, 2, 0, 1, 1]))).toBe(5);
  });
});
