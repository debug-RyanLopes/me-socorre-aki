import { useEffect, useState } from 'react';
import { usePriorityRules, useSavePriorityRules } from '../hooks/useCatalog';
import { errorMessage } from '../lib/api-client';
import { OPTION_LABEL, PRIORITY_LABEL, QUESTION_LABEL } from '../lib/labels';
import type { Priority, PriorityRules } from '../lib/types';

const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const QUESTIONS = ['AFFECTED', 'BLOCKING', 'ALTERNATIVE'] as const;

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.trunc(value), 0), max);
}

export function validateRules(rules: PriorityRules): string | null {
  const scores = PRIORITIES.map((p) => rules.thresholds.find((t) => t.priority === p)?.minScore ?? 0);
  if (rules.weights.some((w) => w.points < 0 || w.points > rules.maxScore)) {
    return `Cada resposta vale de 0 a ${rules.maxScore} pontos.`;
  }
  if (scores.some((s) => s > rules.maxScore)) {
    return `A pontuação mínima vai até ${rules.maxScore}, a pontuação máxima de um chamado.`;
  }
  for (let i = 1; i < scores.length; i += 1) {
    if (scores[i] <= scores[i - 1]) {
      return `A pontuação mínima de ${PRIORITY_LABEL[PRIORITIES[i]]} precisa ser maior que a de ${PRIORITY_LABEL[PRIORITIES[i - 1]]}.`;
    }
  }
  return null;
}

export function highestScore(rules: PriorityRules): number {
  const sum = QUESTIONS.reduce(
    (total, question) => total + Math.max(0, ...rules.weights.filter((w) => w.question === question).map((w) => w.points)),
    0,
  );
  return Math.min(sum, rules.maxScore);
}

export function PriorityRulesPage() {
  const rules = usePriorityRules();
  const save = useSavePriorityRules();
  const [draft, setDraft] = useState<PriorityRules | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (rules.data) setDraft(rules.data);
  }, [rules.data]);

  if (!draft) return <p className="muted" role="status" style={{ padding: 32 }}>Carregando…</p>;

  const max = draft.maxScore;
  const problem = validateRules(draft);
  const reachable = highestScore(draft);

  const setWeight = (index: number, points: number) => {
    setSaved(false);
    setDraft({ ...draft, weights: draft.weights.map((w, i) => (i === index ? { ...w, points: clamp(points, max) } : w)) });
  };

  const setThreshold = (priority: string, minScore: number) => {
    setSaved(false);
    setDraft({
      ...draft,
      thresholds: draft.thresholds.map((t) => (t.priority === priority ? { ...t, minScore: clamp(minScore, max) } : t)),
    });
  };

  return (
    <div className="container medium">
      <div>
        <h1>Regras de prioridade</h1>
        <p className="muted">
          Cada resposta de impacto vale de 0 a {max} pontos. A soma, limitada a {max}, é comparada às pontuações mínimas abaixo para sugerir a
          prioridade. Chamados já abertos não são recalculados.
        </p>
      </div>
      <section className="card flush">
        <table>
          <thead>
            <tr>
              <th>Pergunta</th>
              <th>Resposta</th>
              <th style={{ width: 140 }}>Pontos (0 a {max})</th>
            </tr>
          </thead>
          <tbody>
            {draft.weights.map((weight, index) => (
              <tr key={`${weight.question}-${weight.option}`}>
                <td>{QUESTION_LABEL[weight.question]}</td>
                <td>{OPTION_LABEL[weight.option] ?? weight.option}</td>
                <td>
                  <label className="sr-only" htmlFor={`w-${index}`}>
                    Pontos para {OPTION_LABEL[weight.option] ?? weight.option}
                  </label>
                  <input
                    id={`w-${index}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={max}
                    value={weight.points}
                    onChange={(event) => setWeight(index, Number(event.target.value))}
                    style={{ width: 90 }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card flush">
        <table>
          <thead>
            <tr>
              <th>Prioridade</th>
              <th style={{ width: 200 }}>Pontuação mínima (0 a {max})</th>
            </tr>
          </thead>
          <tbody>
            {PRIORITIES.map((priority) => {
              const threshold = draft.thresholds.find((t) => t.priority === priority);
              return (
                <tr key={priority}>
                  <td>
                    <span className={`chip chip-${priority}`}>{PRIORITY_LABEL[priority]}</span>
                  </td>
                  <td>
                    <label className="sr-only" htmlFor={`t-${priority}`}>
                      Pontuação mínima para {PRIORITY_LABEL[priority]}
                    </label>
                    <input
                      id={`t-${priority}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={max}
                      value={threshold?.minScore ?? 0}
                      disabled={priority === 'LOW'}
                      onChange={(event) => setThreshold(priority, Number(event.target.value))}
                      style={{ width: 90 }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <p className="muted small">
        Com estas regras, um chamado chega a no máximo <strong>{reachable}</strong> de {max} pontos.
      </p>
      {problem ? (
        <p className="alert alert-error" role="alert">
          {problem}
        </p>
      ) : null}
      {save.isError ? (
        <p className="alert alert-error" role="alert">
          {errorMessage(save.error)}
        </p>
      ) : null}
      {saved ? (
        <p className="alert alert-info" role="status">
          Regras salvas.
        </p>
      ) : null}
      <div className="btn-row end">
        <button
          type="button"
          className="btn btn-primary"
          disabled={save.isPending || problem !== null}
          onClick={() => save.mutate(draft, { onSuccess: () => setSaved(true) })}
        >
          Salvar regras
        </button>
      </div>
    </div>
  );
}
