import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../lib/types';
import { RequireRole } from './RequireRole';

const authState: { user: AuthUser | null; loading: boolean } = { user: null, loading: false };

vi.mock('./AuthProvider', () => ({
  useAuth: () => authState,
}));

const employee: AuthUser = { id: 1, name: 'Paula', email: 'p@e', login: 'paula', role: 'EMPLOYEE', sectorId: 1, mustChangePassword: false };

function renderAt(path: string, roles?: AuthUser['role'][]) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>tela de login</p>} />
        <Route path="/my-tickets" element={<p>meus chamados</p>} />
        <Route path="/change-password" element={<p>troca de senha</p>} />
        <Route element={<RequireRole roles={roles} />}>
          <Route path="/queue" element={<p>fila da TI</p>} />
          <Route path="/open" element={<p>área liberada</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireRole', () => {
  beforeEach(() => {
    authState.user = null;
    authState.loading = false;
  });

  it('redireciona visitante sem sessão para o login', () => {
    renderAt('/queue', ['TECHNICIAN']);
    expect(screen.getByText('tela de login')).toBeInTheDocument();
  });

  it('mostra carregando enquanto verifica a sessão', () => {
    authState.loading = true;
    renderAt('/queue', ['TECHNICIAN']);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando');
  });

  it('bloqueia o funcionário na rota da TI e o leva à própria página inicial', () => {
    authState.user = employee;
    renderAt('/queue', ['TECHNICIAN', 'ADMIN']);
    expect(screen.queryByText('fila da TI')).not.toBeInTheDocument();
    expect(screen.getByText('meus chamados')).toBeInTheDocument();
  });

  it('libera o perfil permitido', () => {
    authState.user = { ...employee, role: 'TECHNICIAN' };
    renderAt('/queue', ['TECHNICIAN', 'ADMIN']);
    expect(screen.getByText('fila da TI')).toBeInTheDocument();
  });

  it('sem restrição de perfil, qualquer usuário autenticado entra', () => {
    authState.user = employee;
    renderAt('/open');
    expect(screen.getByText('área liberada')).toBeInTheDocument();
  });

  it('obriga a troca de senha antes de qualquer outra rota', () => {
    authState.user = { ...employee, mustChangePassword: true };
    renderAt('/open');
    expect(screen.getByText('troca de senha')).toBeInTheDocument();
  });
});
