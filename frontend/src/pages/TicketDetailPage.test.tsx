import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser, TicketComment, TicketDetail } from '../lib/types';
import { TicketDetailPage } from './TicketDetailPage';

const state: { user: AuthUser; ticket: TicketDetail; comments: TicketComment[] } = {} as never;

vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('../hooks/useUsers', () => ({
  useUsers: () => ({ data: { items: [{ id: 5, name: 'Marcos Teixeira' }] } }),
}));
vi.mock('../hooks/useTickets', () => ({
  useTicket: () => ({ data: state.ticket, isLoading: false, isError: false }),
  useTicketComments: () => ({ data: state.comments }),
  useTicketAction: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, error: null }),
  useCreateComment: () => ({ mutate: vi.fn(), isPending: false }),
}));

const baseTicket: TicketDetail = {
  id: 7,
  code: 'CH-000007',
  title: 'Teclado com defeito',
  summary: 'Teclas falhando',
  status: 'WAITING_START',
  priority: 'MEDIUM',
  requesterId: 1,
  requesterName: 'Paula Ribeiro',
  sector: { id: 1, name: 'Financeiro' },
  category: null,
  serialInformed: 'NB-1',
  equipment: { id: 1, serial: 'NB-1', manufacturer: 'Dell', model: 'Latitude' },
  equipmentPending: false,
  assignee: { id: 5, name: 'Marcos Teixeira' },
  createdAt: '2026-11-20T12:00:00.000Z',
  updatedAt: '2026-11-20T12:00:00.000Z',
  resolvedAt: null,
  closedAt: null,
  description: 'Várias teclas não respondem.',
  requesterEmail: 'paula@empresa.example',
  solution: null,
  cancelledAt: null,
  assignedAt: null,
  impact: { affected: 'SELF', blocking: 'LIMITED', alternative: 'YES' },
  suggestedPriority: 'MEDIUM',
  reopenUntil: null,
  events: [{ id: 1, type: 'CREATED', actor: { id: 1, name: 'Paula Ribeiro' }, payload: {}, createdAt: '2026-11-20T12:00:00.000Z' }],
  attachments: [],
};

const employee: AuthUser = { id: 1, name: 'Paula Ribeiro', email: 'p@e', login: 'paula', role: 'EMPLOYEE', sectorId: 1, mustChangePassword: false };
const technician: AuthUser = { ...employee, id: 5, name: 'Marcos Teixeira', role: 'TECHNICIAN' };
const admin: AuthUser = { ...employee, id: 9, name: 'Helena', role: 'ADMIN' };

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/tickets/7']}>
      <Routes>
        <Route path="/tickets/:id" element={<TicketDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TicketDetailPage: ações por perfil e status', () => {
  beforeEach(() => {
    state.user = employee;
    state.ticket = baseTicket;
    state.comments = [];
  });

  it('funcionário vê Cancelar chamado e não vê ferramentas da TI nem a prioridade', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Cancelar chamado' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar solução' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Alterar prioridade' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar observação interna' })).not.toBeInTheDocument();
    expect(screen.queryByText('Média')).not.toBeInTheDocument();
  });

  it('funcionário com chamado Resolvido vê a solução e as opções de confirmar ou recusar', () => {
    state.ticket = { ...baseTicket, status: 'RESOLVED', solution: 'Teclado trocado por um novo.' };
    renderPage();
    expect(screen.getByText('Teclado trocado por um novo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar resolução' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'O problema persiste' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar chamado' })).not.toBeInTheDocument();
  });

  it('funcionário com chamado Fechado dentro do prazo pode reabrir', () => {
    state.ticket = { ...baseTicket, status: 'CLOSED', closedAt: '2026-11-20T12:00:00.000Z', reopenUntil: new Date(Date.now() + 86_400_000).toISOString() };
    renderPage();
    expect(screen.getByRole('button', { name: 'Reabrir chamado' })).toBeInTheDocument();
    expect(screen.getByText('Este chamado está encerrado e não aceita novos comentários.')).toBeInTheDocument();
  });

  it('funcionário com chamado Fechado fora do prazo não vê a reabertura', () => {
    state.ticket = { ...baseTicket, status: 'CLOSED', closedAt: '2026-11-01T12:00:00.000Z', reopenUntil: '2026-11-04T12:00:00.000Z' };
    renderPage();
    expect(screen.queryByRole('button', { name: 'Reabrir chamado' })).not.toBeInTheDocument();
  });

  it('funcionário não age em chamado de outra pessoa', () => {
    state.ticket = { ...baseTicket, requesterId: 99 };
    renderPage();
    expect(screen.queryByRole('button', { name: 'Cancelar chamado' })).not.toBeInTheDocument();
  });

  it('técnico vê as ações de atendimento, prioridade sugerida e observação interna', () => {
    state.user = technician;
    renderPage();
    expect(screen.getByRole('button', { name: 'Registrar solução' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pedir informações' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alterar prioridade' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar observação interna' })).toBeInTheDocument();
    expect(screen.getByText('Prioridade sugerida: Média')).toBeInTheDocument();
    expect(screen.queryByLabelText('Atribuir a um técnico')).not.toBeInTheDocument();
  });

  it('técnico vê Assumir somente quando não há responsável', () => {
    state.user = technician;
    state.ticket = { ...baseTicket, assignee: null };
    renderPage();
    expect(screen.getByRole('button', { name: 'Assumir chamado' })).toBeInTheDocument();
  });

  it('em chamado Aberto o técnico vê a triagem; em Aguardando iniciar não', () => {
    state.user = technician;
    state.ticket = { ...baseTicket, status: 'OPEN' };
    renderPage();
    expect(screen.getByRole('button', { name: 'Confirmar prioridade e iniciar' })).toBeInTheDocument();
  });

  it('administrador pode atribuir o chamado a um técnico', () => {
    state.user = admin;
    renderPage();
    expect(screen.getByLabelText('Atribuir a um técnico')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Marcos Teixeira' })).toBeInTheDocument();
  });

  it('chamado encerrado não mostra ações de atendimento para a TI', () => {
    state.user = technician;
    state.ticket = { ...baseTicket, status: 'CANCELLED' };
    renderPage();
    expect(screen.queryByRole('button', { name: 'Registrar solução' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Alterar prioridade' })).not.toBeInTheDocument();
  });

  it('serial pendente oferece a correção apenas à TI', () => {
    state.ticket = { ...baseTicket, equipment: null, equipmentPending: true };
    renderPage();
    expect(screen.queryByLabelText('Corrigir serial do chamado')).not.toBeInTheDocument();
    state.user = technician;
    renderPage();
    expect(screen.getByLabelText('Corrigir serial do chamado')).toBeInTheDocument();
  });

  it('exibe observação interna marcada e o histórico em português', () => {
    state.user = technician;
    state.comments = [
      {
        id: 1,
        ticketId: 7,
        body: 'Suspeita de falha de hardware',
        visibility: 'INTERNAL',
        createdAt: '2026-11-20T12:00:00.000Z',
        author: { id: 5, name: 'Marcos Teixeira', role: 'TECHNICIAN' },
        attachments: [],
      },
    ];
    renderPage();
    expect(screen.getByText('Observação interna · visível só para a TI')).toBeInTheDocument();
    expect(screen.getByText('Chamado criado por Paula Ribeiro')).toBeInTheDocument();
  });
});
