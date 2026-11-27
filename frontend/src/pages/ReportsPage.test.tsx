import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReportSummary, TicketListItem } from '../lib/types';
import { ReportsPage } from './ReportsPage';

const calls: { summary: unknown[]; tickets: unknown[] } = { summary: [], tickets: [] };

const summary: ReportSummary = {
  period: '30d',
  from: '2026-10-27T12:00:00.000Z',
  to: '2026-11-26T12:00:00.000Z',
  granularity: 'day',
  totals: { total: 30, resolvedOrClosed: 12, unassignedNow: 4, avgResolutionSeconds: 7200 },
  trend: [
    { bucket: '2026-11-24', count: 10 },
    { bucket: '2026-11-25', count: 0 },
    { bucket: '2026-11-26', count: 20 },
  ],
  byStatus: [
    { key: 'OPEN', name: 'OPEN', count: 18 },
    { key: 'CLOSED', name: 'CLOSED', count: 12 },
  ],
  byPriority: [{ key: 'HIGH', name: 'HIGH', count: 30 }],
  bySector: [
    { key: '3', name: 'Comercial', count: 17 },
    { key: '1', name: 'Financeiro', count: 13 },
  ],
  byCategory: [{ key: 'null', name: 'Sem categoria', count: 30 }],
  byTechnician: [{ key: 'null', name: 'Sem responsável', count: 30 }],
  topEquipment: [],
};

const ticket: TicketListItem = {
  id: 42,
  code: 'HD-0042',
  title: 'Impressora não imprime',
  summary: 'A impressora do corredor mostra pronta, mas nada sai.',
  status: 'OPEN',
  priority: 'HIGH',
  requesterId: 1,
  requesterName: 'Paula',
  sector: { id: 3, name: 'Comercial' },
  category: null,
  serialInformed: 'IMP-1',
  equipment: null,
  equipmentPending: false,
  assignee: null,
  createdAt: '2026-11-26T10:00:00.000Z',
  updatedAt: '2026-11-26T10:00:00.000Z',
  resolvedAt: null,
  closedAt: null,
};

vi.mock('../hooks/useReports', () => ({
  useReportSummary: (...args: unknown[]) => {
    calls.summary.push(args);
    return { data: summary, isError: false, isFetching: false };
  },
}));

vi.mock('../hooks/useTickets', () => ({
  useTicketList: (filters: unknown) => {
    calls.tickets.push(filters);
    return { data: { items: [ticket], total: 1, page: 1, pageSize: 10 } };
  },
}));

function renderPage(path = '/reports') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reports" element={<ReportsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReportsPage', () => {
  beforeEach(() => {
    calls.summary = [];
    calls.tickets = [];
  });

  it('clicar em um setor filtra o relatório e a lista de chamados', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Comercial: 17 chamados, 57%/ }));

    expect(screen.getByRole('button', { name: 'Remover filtro Setor: Comercial' })).toBeInTheDocument();
    expect(calls.summary.at(-1)).toEqual(['30d', { sectorId: '3' }]);
    expect(calls.tickets.at(-1)).toMatchObject({ sectorId: '3', from: summary.from, page: 1 });
    expect(screen.getByRole('button', { name: /Comercial: 17 chamados/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicar de novo no item selecionado remove o filtro', () => {
    renderPage('/reports?period=30d&sectorId=3');
    fireEvent.click(screen.getByRole('button', { name: /Comercial: 17 chamados/ }));
    expect(calls.summary.at(-1)).toEqual(['30d', {}]);
    expect(screen.queryByText('Filtrando por:')).not.toBeInTheDocument();
  });

  it('"Sem categoria" vira o filtro de chamados sem categoria', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Sem categoria: 30 chamados/ }));
    expect(calls.summary.at(-1)).toEqual(['30d', { uncategorized: true }]);
  });

  it('lista os chamados do recorte com link para o detalhe', () => {
    renderPage();
    const link = screen.getByRole('link', { name: /HD-0042/ });
    expect(link).toHaveAttribute('href', '/tickets/42');
    expect(screen.getAllByText(/A impressora do corredor/)[0]).toBeInTheDocument();
  });

  it('mostra a evolução diária com tabela acessível', () => {
    renderPage();
    expect(screen.getByRole('img', { name: /30 chamados abertos no período/ })).toBeInTheDocument();
    const table = screen.getByText('Ver como tabela').closest('details')!;
    expect(within(table).getAllByRole('row')).toHaveLength(4);
  });

  it('trocar o período mantém os filtros', () => {
    renderPage('/reports?period=30d&sectorId=3');
    fireEvent.click(screen.getByRole('button', { name: '90 dias' }));
    expect(calls.summary.at(-1)).toEqual(['90d', { sectorId: '3' }]);
  });
});
