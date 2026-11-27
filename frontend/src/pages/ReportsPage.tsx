import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pagination } from '../components/Pagination';
import { ReportFilters, ReportPeriod, useReportSummary } from '../hooks/useReports';
import { useTicketList } from '../hooks/useTickets';
import { PRIORITY_LABEL, STATUS_LABEL, formatDate, formatDateTime, formatDuration } from '../lib/labels';
import type { CountRow, Priority, ReportSummary, TicketStatus, TrendPoint } from '../lib/types';

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
];

const FILTER_KEYS = [
  'status',
  'priority',
  'sectorId',
  'categoryId',
  'uncategorized',
  'assigneeId',
  'unassigned',
  'equipmentId',
] as const;

type FilterKey = (typeof FILTER_KEYS)[number];

interface Dimension {
  id: string;
  title: string;
  keys: FilterKey[];
  rows: (data: ReportSummary) => CountRow[];
  toFilter: (row: CountRow) => ReportFilters;
  isSelected: (row: CountRow, filters: ReportFilters) => boolean;
  partial?: boolean;
}

const STATUS_ORDER: TicketStatus[] = ['OPEN', 'WAITING_START', 'WAITING_USER', 'RESOLVED', 'CLOSED', 'CANCELLED'];
const PRIORITY_ORDER: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const DIMENSIONS: Dimension[] = [
  {
    id: 'status',
    title: 'Status',
    keys: ['status'],
    rows: (d) =>
      STATUS_ORDER.flatMap((s) => {
        const row = d.byStatus.find((r) => r.key === s);
        return row ? [{ ...row, name: STATUS_LABEL[s] }] : [];
      }),
    toFilter: (row) => ({ status: row.key }),
    isSelected: (row, f) => f.status === row.key,
  },
  {
    id: 'priority',
    title: 'Prioridade',
    keys: ['priority'],
    rows: (d) =>
      PRIORITY_ORDER.flatMap((p) => {
        const row = d.byPriority.find((r) => r.key === p);
        return row ? [{ ...row, name: PRIORITY_LABEL[p] }] : [];
      }),
    toFilter: (row) => ({ priority: row.key }),
    isSelected: (row, f) => f.priority === row.key,
  },
  {
    id: 'sector',
    title: 'Setor',
    keys: ['sectorId'],
    rows: (d) => d.bySector,
    toFilter: (row) => ({ sectorId: row.key }),
    isSelected: (row, f) => f.sectorId === row.key,
  },
  {
    id: 'category',
    title: 'Categoria',
    keys: ['categoryId', 'uncategorized'],
    rows: (d) => d.byCategory,
    toFilter: (row) => (row.key === 'null' ? { uncategorized: true } : { categoryId: row.key }),
    isSelected: (row, f) => (row.key === 'null' ? f.uncategorized === true : f.categoryId === row.key),
  },
  {
    id: 'technician',
    title: 'Técnico responsável',
    keys: ['assigneeId', 'unassigned'],
    rows: (d) => d.byTechnician,
    toFilter: (row) => (row.key === 'null' ? { unassigned: true } : { assigneeId: row.key }),
    isSelected: (row, f) => (row.key === 'null' ? f.unassigned === true : f.assigneeId === row.key),
  },
  {
    id: 'equipment',
    title: 'Equipamentos com mais chamados',
    keys: ['equipmentId'],
    rows: (d) => d.topEquipment,
    toFilter: (row) => ({ equipmentId: row.key }),
    isSelected: (row, f) => f.equipmentId === row.key,
    partial: true,
  },
];

function readFilters(params: URLSearchParams): ReportFilters {
  const filters: ReportFilters = {};
  for (const key of FILTER_KEYS) {
    const value = params.get(key);
    if (!value) continue;
    if (key === 'uncategorized' || key === 'unassigned') filters[key] = value === 'true';
    else filters[key] = value;
  }
  return filters;
}

function readPeriod(params: URLSearchParams): ReportPeriod {
  const value = params.get('period');
  return PERIODS.some((p) => p.value === value) ? (value as ReportPeriod) : '30d';
}

const percent = (part: number, whole: number): string => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '0%');

const dayLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const longDayLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' });

function bucketLabel(bucket: string, granularity: 'hour' | 'day', long = false): string {
  if (granularity === 'hour') {
    const hour = bucket.slice(11, 13);
    return long ? `Hoje, ${hour}h às ${hour}h59` : `${hour}h`;
  }
  const date = new Date(`${bucket}T12:00:00Z`);
  return long ? longDayLabel.format(date) : dayLabel.format(date);
}

function TrendChart({ points, granularity }: { points: TrendPoint[]; granularity: 'hour' | 'day' }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.count));
  const total = points.reduce((sum, p) => sum + p.count, 0);
  const peak = points.reduce((best, p) => (p.count > best.count ? p : best), points[0] ?? { bucket: '', count: 0 });
  const ticks = points.length > 1 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : [0];
  const active = hover !== null ? points[hover] : null;

  return (
    <section className="card report-trend">
      <div className="report-card-head">
        <div>
          <h2>Chamados abertos {granularity === 'hour' ? 'por hora' : 'por dia'}</h2>
          <p className="muted small">
            {total} no período
            {peak && peak.count > 0 ? ` · pico de ${peak.count} em ${bucketLabel(peak.bucket, granularity, true)}` : ''}
          </p>
        </div>
      </div>
      <div
        className="trend-plot"
        role="img"
        aria-label={`Gráfico de barras: ${total} chamados abertos no período, no máximo ${max} em um único ${granularity === 'hour' ? 'horário' : 'dia'}.`}
        onMouseLeave={() => setHover(null)}
      >
        <span className="trend-max muted small" aria-hidden="true">
          {max}
        </span>
        <div className="trend-bars">
          {points.map((point, index) => (
            <div
              key={point.bucket}
              className={`trend-slot${hover === index ? ' is-hover' : ''}`}
              onMouseEnter={() => setHover(index)}
            >
              <div className="trend-bar" style={{ height: `${(point.count / max) * 100}%` }} />
            </div>
          ))}
        </div>
        {active && hover !== null ? (
          <div
            className="chart-tooltip"
            style={{ left: `${((hover + 0.5) / points.length) * 100}%` }}
            aria-hidden="true"
          >
            <strong>{active.count}</strong> {active.count === 1 ? 'chamado' : 'chamados'}
            <span>{bucketLabel(active.bucket, granularity, true)}</span>
          </div>
        ) : null}
      </div>
      <div className="trend-axis muted small" aria-hidden="true">
        {ticks.map((index) => (
          <span key={index}>{points[index] ? bucketLabel(points[index].bucket, granularity) : ''}</span>
        ))}
      </div>
      <details className="table-toggle">
        <summary>Ver como tabela</summary>
        <table>
          <thead>
            <tr>
              <th>{granularity === 'hour' ? 'Horário' : 'Dia'}</th>
              <th className="num">Chamados</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.bucket}>
                <td>{bucketLabel(point.bucket, granularity, true)}</td>
                <td className="num">{point.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function Breakdown({
  dimension,
  data,
  filters,
  onSelect,
}: {
  dimension: Dimension;
  data: ReportSummary;
  filters: ReportFilters;
  onSelect: (dimension: Dimension, row: CountRow) => void;
}) {
  const rows = dimension.rows(data);
  const max = Math.max(1, ...rows.map((r) => r.count));
  const whole = rows.reduce((sum, r) => sum + r.count, 0);
  const hasSelection = rows.some((r) => dimension.isSelected(r, filters));

  return (
    <section className="card breakdown">
      <h2>{dimension.title}</h2>
      {rows.length === 0 ? (
        <p className="muted small">Nenhum chamado neste recorte.</p>
      ) : (
        <ul>
          {rows.map((row) => {
            const selected = dimension.isSelected(row, filters);
            return (
              <li key={row.key}>
                <button
                  type="button"
                  className={`breakdown-row${selected ? ' is-selected' : ''}${hasSelection && !selected ? ' is-dimmed' : ''}`}
                  aria-pressed={selected}
                  aria-label={`${row.name}: ${row.count} chamados${dimension.partial ? '' : `, ${percent(row.count, whole)}`}. ${selected ? 'Remover filtro' : 'Filtrar por este item'}.`}
                  onClick={() => onSelect(dimension, row)}
                >
                  <span className="breakdown-label">
                    <span className="breakdown-name">{row.name}</span>
                    <span className="breakdown-value">
                      <strong>{row.count}</strong>
                      {dimension.partial ? null : <span className="muted"> · {percent(row.count, whole)}</span>}
                    </span>
                  </span>
                  <span className="breakdown-track" aria-hidden="true">
                    <span className="breakdown-fill" style={{ width: `${(row.count / max) * 100}%` }} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function filterChips(data: ReportSummary | undefined, filters: ReportFilters) {
  if (!data) return [];
  return DIMENSIONS.flatMap((dimension) => {
    if (!dimension.keys.some((key) => filters[key] !== undefined)) return [];
    const row = dimension.rows(data).find((r) => dimension.isSelected(r, filters));
    return [{ dimension, label: `${dimension.title}: ${row?.name ?? 'selecionado'}` }];
  });
}

export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const period = readPeriod(params);
  const filters = useMemo(() => readFilters(params), [params]);
  const summary = useReportSummary(period, filters);
  const data = summary.data;
  const [page, setPage] = useState(1);
  const filterSignature = params.toString();

  useEffect(() => setPage(1), [filterSignature]);

  const tickets = useTicketList({
    ...filters,
    from: data?.from,
    page,
    pageSize: 10,
  });

  const update = (next: ReportFilters, nextPeriod: ReportPeriod = period) => {
    const search = new URLSearchParams();
    search.set('period', nextPeriod);
    for (const key of FILTER_KEYS) {
      const value = next[key];
      if (value !== undefined && value !== false && value !== '') search.set(key, String(value));
    }
    setParams(search, { replace: true });
  };

  const clearDimension = (dimension: Dimension): ReportFilters => {
    const rest = { ...filters };
    for (const key of dimension.keys) delete rest[key];
    return rest;
  };

  const onSelect = (dimension: Dimension, row: CountRow) => {
    const base = clearDimension(dimension);
    update(dimension.isSelected(row, filters) ? base : { ...base, ...dimension.toFilter(row) });
  };

  const chips = filterChips(data, filters);
  const resolvedShare = data ? percent(data.totals.resolvedOrClosed, data.totals.total) : '-';

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Relatórios</h1>
          <p className="muted">
            {data ? `De ${formatDateTime(data.from)} até agora.` : 'Indicadores do período selecionado.'} Clique em qualquer barra para filtrar
            o relatório e ver os chamados por trás do número.
          </p>
        </div>
        <div className="segmented" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <button key={p.value} type="button" aria-pressed={period === p.value} onClick={() => update(filters, p.value)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="filter-bar" aria-label="Filtros ativos">
          <span className="muted small">Filtrando por:</span>
          {chips.map(({ dimension, label }) => (
            <button
              key={dimension.id}
              type="button"
              className="filter-chip"
              aria-label={`Remover filtro ${label}`}
              onClick={() => update(clearDimension(dimension))}
            >
              {label}
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className="link-button" onClick={() => update({})}>
            Limpar filtros
          </button>
        </div>
      ) : null}

      {summary.isError ? (
        <p className="alert alert-error" role="alert">
          Não foi possível carregar o relatório.
        </p>
      ) : null}

      {data ? (
        <div className={summary.isFetching ? 'report-body is-loading' : 'report-body'}>
          <div className="grid-cards">
            <div className="card kpi">
              <span className="muted small">Chamados no recorte</span>
              <span className="counter">{data.totals.total}</span>
              <span className="muted small">Abertos no período</span>
            </div>
            <div className="card kpi">
              <span className="muted small">Resolvidos ou fechados</span>
              <span className="counter">{data.totals.resolvedOrClosed}</span>
              <span className="muted small">{resolvedShare} do recorte</span>
            </div>
            <div className="card kpi">
              <span className="muted small">Tempo médio de resolução</span>
              <span className="counter">{formatDuration(data.totals.avgResolutionSeconds)}</span>
              <span className="muted small">Da abertura até a solução</span>
            </div>
            <div className="card kpi">
              <span className="muted small">Sem responsável agora</span>
              <span className="counter">{data.totals.unassignedNow}</span>
              <span className="muted small">Fila atual da TI, em qualquer data</span>
            </div>
          </div>

          <TrendChart points={data.trend} granularity={data.granularity} />

          <div className="report-grid">
            {DIMENSIONS.map((dimension) => (
              <Breakdown key={dimension.id} dimension={dimension} data={data} filters={filters} onSelect={onSelect} />
            ))}
          </div>

          <section className="card flush report-tickets" aria-labelledby="report-tickets-title">
            <div className="report-card-head padded">
              <div>
                <h2 id="report-tickets-title">Chamados deste recorte</h2>
                <p className="muted small">
                  {tickets.data ? `${tickets.data.total} ${tickets.data.total === 1 ? 'chamado' : 'chamados'}` : 'Carregando…'}
                  {chips.length > 0 ? ` · ${chips.map((c) => c.label).join(' · ')}` : ' · todos os setores e status'}
                </p>
              </div>
            </div>
            {tickets.data && tickets.data.items.length === 0 ? (
              <p className="muted" style={{ padding: '0 20px 20px' }}>
                Nenhum chamado encontrado com estes filtros.
              </p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Chamado</th>
                    <th>Status</th>
                    <th>Prioridade</th>
                    <th>Setor</th>
                    <th>Responsável</th>
                    <th>Aberto em</th>
                  </tr>
                </thead>
                <tbody>
                  {(tickets.data?.items ?? []).map((ticket) => (
                    <tr key={ticket.id}>
                      <td>
                        <Link to={`/tickets/${ticket.id}`} className="ticket-link">
                          <span className="ticket-code">{ticket.code}</span>
                          <span className="ticket-link-title">{ticket.title ?? ticket.summary}</span>
                        </Link>
                        <div className="sub clamp">{ticket.summary}</div>
                      </td>
                      <td>
                        <span className={`chip chip-${ticket.status}`}>{STATUS_LABEL[ticket.status]}</span>
                      </td>
                      <td>
                        {ticket.priority ? (
                          <span className={`chip chip-${ticket.priority}`}>{PRIORITY_LABEL[ticket.priority]}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        {ticket.sector.name}
                        {ticket.category ? <div className="sub">{ticket.category.name}</div> : null}
                      </td>
                      <td>{ticket.assignee?.name ?? <span className="muted">Sem responsável</span>}</td>
                      <td>{formatDate(ticket.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tickets.data && tickets.data.total > 0 ? (
              <div style={{ padding: '12px 20px 20px' }}>
                <Pagination page={page} pageSize={10} total={tickets.data.total} onChange={setPage} />
              </div>
            ) : null}
          </section>
        </div>
      ) : (
        <p className="muted" role="status">
          Carregando…
        </p>
      )}
    </div>
  );
}
