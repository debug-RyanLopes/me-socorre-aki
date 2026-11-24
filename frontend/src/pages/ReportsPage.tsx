import { useState } from 'react';
import { ReportPeriod, useReportSummary } from '../hooks/useReports';
import { formatDuration, STATUS_LABEL } from '../lib/labels';
import type { CountRow, TicketStatus } from '../lib/types';

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
];

function CountTable({ title, rows }: { title: string; rows: CountRow[] }) {
  return (
    <section>
      <h2>{title}</h2>
      <table>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="muted">Sem dados no período.</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.key}>
                <td>{row.name}</td>
                <td className="num">{row.count}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

export function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>('7d');
  const summary = useReportSummary(period);
  const data = summary.data;

  const statusRows: CountRow[] = (data?.byStatus ?? []).map((row) => ({
    ...row,
    name: STATUS_LABEL[row.key as TicketStatus] ?? row.name,
  }));
  const percent =
    data && data.totals.total > 0 ? `${Math.round((data.totals.resolvedOrClosed / data.totals.total) * 100)}% do total` : '-';

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Relatórios</h1>
          <p className="muted">Indicadores operacionais do período selecionado.</p>
        </div>
        <div className="segmented" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <button key={p.value} type="button" aria-pressed={period === p.value} onClick={() => setPeriod(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {summary.isError ? <p className="alert alert-error" role="alert">Não foi possível carregar o relatório.</p> : null}
      {data ? (
        <>
          <div className="grid-cards">
            <div className="card" style={{ gap: 4 }}>
              <span className="muted small">Total de chamados</span>
              <span className="counter">{data.totals.total}</span>
              <span className="muted small">Abertos no período</span>
            </div>
            <div className="card" style={{ gap: 4 }}>
              <span className="muted small">Tempo médio de resolução</span>
              <span className="counter">{formatDuration(data.totals.avgResolutionSeconds)}</span>
              <span className="muted small">Da abertura à última resolução</span>
            </div>
            <div className="card" style={{ gap: 4 }}>
              <span className="muted small">Resolvidos ou fechados</span>
              <span className="counter">{data.totals.resolvedOrClosed}</span>
              <span className="muted small">{percent}</span>
            </div>
            <div className="card" style={{ gap: 4 }}>
              <span className="muted small">Sem responsável agora</span>
              <span className="counter">{data.totals.unassignedNow}</span>
              <span className="muted small">Na fila da TI</span>
            </div>
          </div>
          <div className="report-tables">
            <CountTable title="Chamados por status" rows={statusRows} />
            <CountTable title="Chamados por setor" rows={data.bySector} />
            <CountTable title="Chamados por categoria" rows={data.byCategory} />
            <CountTable title="Chamados por técnico" rows={data.byTechnician} />
            <CountTable title="Equipamentos com mais chamados" rows={data.topEquipment} />
          </div>
        </>
      ) : (
        <p className="muted" role="status">Carregando…</p>
      )}
    </div>
  );
}
