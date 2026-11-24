import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { ROLE_LABEL } from '../lib/labels';
import type { Role } from '../lib/types';
import { NotificationBell } from './NotificationBell';

interface NavItem {
  to: string;
  label: string;
}

const NAV: Record<Role, NavItem[]> = {
  EMPLOYEE: [
    { to: '/new-ticket', label: 'Abrir chamado' },
    { to: '/my-tickets', label: 'Meus chamados' },
  ],
  TECHNICIAN: [
    { to: '/queue', label: 'Fila' },
    { to: '/equipment', label: 'Equipamentos' },
  ],
  ADMIN: [
    { to: '/queue', label: 'Fila' },
    { to: '/users', label: 'Usuários' },
    { to: '/catalog', label: 'Setores e categorias' },
    { to: '/priority-rules', label: 'Prioridades' },
    { to: '/equipment', label: 'Equipamentos' },
    { to: '/reports', label: 'Relatórios' },
  ],
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <header className="app-header">
        <div className="brand">Me Socorre Aki</div>
        <nav className="nav" aria-label="Principal">
          {NAV[user.role].map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="header-user">
          <NotificationBell />
          <div className="user-info">
            <strong>{user.name}</strong>
            <span>{ROLE_LABEL[user.role]}</span>
          </div>
          <button type="button" className="btn" onClick={() => void handleLogout()}>
            Sair
          </button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
