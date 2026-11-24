import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pagination } from '../components/Pagination';
import { PriorityChip } from '../components/PriorityChip';
import { StatusChip } from '../components/StatusChip';
import { useCatalog } from '../hooks/useCatalog';
import { useAssumeFromQueue, useTicketList } from '../hooks/useTickets';
import { errorMessage } from '../lib/api-client';
import { PRIORITY_LABEL, STATUS_LABEL } from '../lib/labels';
import type { Priority, TicketStatus } from '../lib/types';

const PAGE_SIZE = 20;

const PERIODS = [
  { value: '', label: 'Qualquer período' },
  { value: '1', label: 'Hoje' },
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
];

function periodStart(days: string): string | undefined {
  if (!days) return undefined;
  const start = new Date();
  if (days === '1') start.setHours(0, 0, 0, 0);
  else start.setDate(start.getDate() - Number(days));
  return start.toISOString();
}

function Counter({ label, filters }: { label: string; filters: { status?: string; unassigned?: boolean; mine?: boolean } }) {
  const result = useTicketList({ ...filters, pageSize: 1 });
  return (
    <div className="card" style={{ gap: 4 }}>
      <span className="muted small">{label}</span>
      <span className="counter">{result.data?.total ?? '-'}</span>
    </div>
  );
}

export function TicketQueuePage() {
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [assignment, setAssignment] = useState('');
  const [period, setPeriod] = useState('');
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [page, setPage] = useState(1);
  const sectors = useCatalog('sectors');
  const assume = useAssumeFromQueue();

  const tickets = useTicketList({
    status: status || undefined,
    priority: priority || undefined,
    sectorId: sectorId || undefined,
    unassigned: assignment === 'unassigned' ? true : undefined,
    mine: assignment === 'mine' ? true : undefined,
    from: periodStart(period),
    q: q || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const reset = (setter: (value: string) => void) => (event: { target: { value: string } }) => {
    setter(event.target.value);
    setPage(1);
  };

  return (
    <div className="container">
      <div>
        <h1>Fila de chamados</h1>
        <p className="muted">Chamados da equipe de TI. Assuma um chamado sem responsável para iniciar o atendimento.</p>
      </div>
      <div className="grid-cards">
        <Counter label="Abertos" filters={{ status: 'OPEN' }} />
        <Counter label="Aguardando iniciar" filters={{ status: 'WAITING_START' }} />
        <Counter label="Aguardando usuário" filters={{ status: 'WAITING_USER' }} />
        <Counter label="Atribuídos a mim" filters={{ mine: true }} />
      </div>
      <div className="filters">
        <div className="field" style={{ flex: '2 1 220px' }}>
          <label htmlFor="f-q">Buscar por número, serial ou texto</label>
          <input id="f-q" type="search" value={q} onChange={reset(setQ)} />
        </div>
        <div className="field">
          <label htmlFor="f-status">Status</label>
          <select id="f-status" value={status} onChange={reset(setStatus)}>
            <option value="">Todos</option>
            {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((key) => (
              <option key={key} value={key}>
                {STATUS_LABEL[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-priority">Prioridade</label>
          <select id="f-priority" value={priority} onChange={reset(setPriority)}>
            <option value="">Todas</option>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((key) => (
              <option key={key} value={key}>
                {PRIORITY_LABEL[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-sector">Setor</label>
          <select id="f-sector" value={sectorId} onChange={reset(setSectorId)}>
            <option value="">Todos</option>
            {(sectors.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-assignment">Responsável</label>
          <select id="f-assignment" value={assignment} onChange={reset(setAssignment)}>
            <option value="">Todos</option>
            <option value="unassigned">Sem responsável</option>
            <option value="mine">Atribuídos a mim</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-period">Período</label>
          <select id="f-period" value={period} onChange={reset(setPeriod)}>
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {assume.isError ? (
        <p className="alert alert-error" role="alert">
          {errorMessage(assume.error)}
        </p>
      ) : null}
      {tickets.isError ? <p className="alert alert-error" role="alert">Não foi possível carregar a fila.</p> : null}
      <div className="card flush">
        <table style={{ minWidth: 880 }}>
          <thead>
            <tr>
              <th>Chamado</th>
              <th>Solicitante</th>
              <th>Equipamento</th>
              <th>Prioridade</th>
              <th>Status</th>
              <th>Responsável</th>
              <th>
                <span className="sr-only">Ação</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(tickets.data?.items ?? []).map((ticket) => (
              <tr key={ticket.id}>
                <td>
                  <Link to={`/tickets/${ticket.id}`} style={{ fontWeight: 600, textDecoration: 'none' }}>
                    {ticket.code}
                  </Link>
                  <div className="sub">{ticket.title ?? ticket.summary}</div>
                </td>
                <td>
                  {ticket.requesterName}
                  <div className="sub">{ticket.sector.name}</div>
                </td>
                <td>
                  <span className="mono">{ticket.serialInformed}</span>
                  <div className="sub">
                    {ticket.equipment ? `${ticket.equipment.manufacturer} ${ticket.equipment.model}` : 'Pendente de validação'}
                  </div>
                </td>
                <td>
                  <PriorityChip priority={ticket.priority} />
                </td>
                <td>
                  <StatusChip status={ticket.status} />
                </td>
                <td>{ticket.assignee?.name ?? 'Sem responsável'}</td>
                <td style={{ textAlign: 'right' }}>
                  {!ticket.assignee && ['OPEN', 'WAITING_START', 'WAITING_USER'].includes(ticket.status) ? (
                    <button
                      type="button"
                      className="btn btn-outline-accent"
                      disabled={assume.isPending}
                      onClick={() => assume.mutate(ticket.id)}
                    >
                      Assumir
                    </button>
                  ) : (
                    <Link to={`/tickets/${ticket.id}`} className="btn btn-outline-accent">
                      Abrir
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tickets.data && tickets.data.items.length === 0 ? <p className="muted">Nenhum chamado encontrado.</p> : null}
      {tickets.data ? (
        <Pagination page={page} pageSize={PAGE_SIZE} total={tickets.data.total} onChange={setPage} />
      ) : null}
    </div>
  );
}
