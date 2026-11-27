import { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, MAX_SCORE, scoreAnswers, suggestPriority } from './priority.util';

function suggest(affected: string, blocking: string, alternative: string) {
  const score = scoreAnswers(DEFAULT_WEIGHTS, { affected, blocking, alternative });
  return { score, priority: suggestPriority(score, DEFAULT_THRESHOLDS) };
}

describe('priority.util', () => {
  it('sem impacto relevante resulta em Baixa', () => {
    expect(suggest('SELF', 'NONE', 'YES')).toEqual({ score: 2, priority: 'LOW' });
  });

  it('algumas pessoas com limitações resulta em Média', () => {
    expect(suggest('FEW', 'LIMITED', 'UNKNOWN')).toEqual({ score: 6, priority: 'MEDIUM' });
  });

  it('setor inteiro afetado, mas trabalhando, resulta em Alta', () => {
    expect(suggest('SECTOR', 'NONE', 'YES')).toEqual({ score: 8, priority: 'HIGH' });
  });

  it('uma pessoa impossibilitada sem alternativa resulta em Crítica', () => {
    expect(suggest('SELF', 'BLOCKED', 'NO')).toEqual({ score: 9, priority: 'CRITICAL' });
  });

  it('a pontuação nunca passa do máximo de 10', () => {
    expect(suggest('COMPANY', 'BLOCKED', 'NO')).toEqual({ score: MAX_SCORE, priority: 'CRITICAL' });
  });

  it('respeita limiares editados', () => {
    const custom = [
      { priority: 'LOW' as const, minScore: 0 },
      { priority: 'MEDIUM' as const, minScore: 2 },
      { priority: 'HIGH' as const, minScore: 4 },
      { priority: 'CRITICAL' as const, minScore: 6 },
    ];
    expect(suggestPriority(3, custom)).toBe('MEDIUM');
    expect(suggestPriority(5, custom)).toBe('HIGH');
  });

  it('respostas desconhecidas não somam pontos', () => {
    expect(scoreAnswers(DEFAULT_WEIGHTS, { affected: 'X', blocking: 'Y', alternative: 'Z' })).toBe(0);
  });
});
