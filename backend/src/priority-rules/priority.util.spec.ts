import { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, scoreAnswers, suggestPriority } from './priority.util';

function suggest(affected: string, blocking: string, alternative: string) {
  const score = scoreAnswers(DEFAULT_WEIGHTS, { affected, blocking, alternative });
  return { score, priority: suggestPriority(score, DEFAULT_THRESHOLDS) };
}

describe('priority.util', () => {
  it('sem impacto relevante resulta em Baixa', () => {
    expect(suggest('SELF', 'NONE', 'YES')).toEqual({ score: 0, priority: 'LOW' });
  });

  it('trabalho com limitações e alternativa resulta em Média', () => {
    expect(suggest('SELF', 'LIMITED', 'YES').priority).toBe('MEDIUM');
  });

  it('uma pessoa impossibilitada sem alternativa resulta em Alta', () => {
    expect(suggest('SELF', 'BLOCKED', 'NO')).toEqual({ score: 3, priority: 'HIGH' });
  });

  it('setor inteiro impossibilitado sem alternativa resulta em Crítica', () => {
    expect(suggest('SECTOR', 'BLOCKED', 'NO')).toEqual({ score: 5, priority: 'CRITICAL' });
  });

  it('empresa inteira impossibilitada sem alternativa resulta em Crítica', () => {
    expect(suggest('COMPANY', 'BLOCKED', 'NO').priority).toBe('CRITICAL');
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
