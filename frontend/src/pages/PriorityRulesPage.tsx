import { useEffect, useState } from 'react';
import { usePriorityRules, useSavePriorityRules } from '../hooks/useCatalog';
import { errorMessage } from '../lib/api-client';
import { OPTION_LABEL, PRIORITY_LABEL, QUESTION_LABEL } from '../lib/labels';
import type { PriorityRules } from '../lib/types';

export function PriorityRulesPage() {
  const rules = usePriorityRules();
  const save = useSavePriorityRules();
  const [draft, setDraft] = useState<PriorityRules | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (rules.data) setDraft(rules.data);
  }, [rules.data]);

  if (!draft) return <p className="muted" role="status" style={{ padding: 32 }}>Carregando…</p>;

  const setWeight = (index: number, points: number) => {
    setSaved(false);
    setDraft({ ...draft, weights: draft.weights.map((w, i) => (i === index ? { ...w, points } : w)) });
  };

  const setThreshold = (priority: string, minScore: number) => {
    setSaved(false);
    setDraft({
      ...draft,
      thresholds: draft.thresholds.map((t) => (t.priority === priority ? { ...t, minScore } : t)),
    });
  };

  return (
    <div className="container medium">
      <div>
        <h1>Regras de prioridade</h1>
        <p className="muted">
          Cada resposta de impacto vale pontos; a soma é comparada aos limiares abaixo para sugerir a prioridade. Chamados já abertos não são recalculados.
        </p>
      </div>
      <section className="card flush">
        <table>
          <thead>
            <tr>
              <th>Pergunta</th>
              <th>Resposta</th>
              <th style={{ width: 140 }}>Pontos</th>
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
                    min={0}
                    max={10}
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
              <th style={{ width: 200 }}>Pontuação mínima</th>
            </tr>
          </thead>
          <tbody>
            {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((priority) => {
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
                      min={0}
                      max={100}
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
          disabled={save.isPending}
          onClick={() => save.mutate(draft, { onSuccess: () => setSaved(true) })}
        >
          Salvar regras
        </button>
      </div>
    </div>
  );
}
