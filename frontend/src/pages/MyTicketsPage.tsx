import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pagination } from '../components/Pagination';
import { StatusChip } from '../components/StatusChip';
import { useTicketList } from '../hooks/useTickets';
import { formatDateTime, STATUS_LABEL } from '../lib/labels';
import type { TicketListItem, TicketStatus } from '../lib/types';

const PAGE_SIZE = 10;

function noteFor(ticket: TicketListItem): string {
  switch (ticket.status) {
    case 'WAITING_USER':
      return 'A TI fez uma pergunta e espera sua resposta.';
    case 'RESOLVED':
      return 'Solução registrada. Confirme se o problema foi resolvido.';
    case 'CLOSED':
      return `Fechado em ${formatDateTime(ticket.closedAt)}.`;
    case 'CANCELLED':
      return 'Chamado cancelado.';
    default:
      return ticket.assignee ? `Responsável: ${ticket.assignee.name}` : 'Aguardando um técnico assumir.';
  }
}

export function MyTicketsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const tickets = useTicketList({ status: status || undefined, page, pageSize: PAGE_SIZE });

  return (
    <div className="container medium">
      <div className="page-head">
        <div>
          <h1>Meus chamados</h1>
          <p className="muted">Acompanhe suas solicitações de suporte.</p>
        </div>
        <Link to="/new-ticket" className="btn btn-primary">
          Abrir chamado
        </Link>
      </div>
      <div className="filters">
        <div className="field" style={{ maxWidth: 280 }}>
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((key) => (
              <option key={key} value={key}>
                {STATUS_LABEL[key]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {tickets.isLoading ? <p className="muted" role="status">Carregando…</p> : null}
      {tickets.isError ? <p className="alert alert-error" role="alert">Não foi possível carregar os chamados.</p> : null}
      {tickets.data && tickets.data.items.length === 0 ? <p className="muted">Você ainda não tem chamados.</p> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(tickets.data?.items ?? []).map((ticket) => (
          <Link key={ticket.id} to={`/tickets/${ticket.id}`} className="ticket-card">
            <div className="grow">
              <div className="ticket-code">{ticket.code}</div>
              <div className="ticket-title">{ticket.title ?? ticket.summary}</div>
              <div className="muted small" style={{ marginTop: 4 }}>
                {noteFor(ticket)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
              <StatusChip status={ticket.status} />
              <span className="muted small">Atualizado em {formatDateTime(ticket.updatedAt)}</span>
            </div>
          </Link>
        ))}
      </div>
      {tickets.data ? (
        <Pagination page={page} pageSize={PAGE_SIZE} total={tickets.data.total} onChange={setPage} />
      ) : null}
    </div>
  );
}
