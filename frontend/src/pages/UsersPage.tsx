import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pagination } from '../components/Pagination';
import { useCatalog } from '../hooks/useCatalog';
import { useUserAction, useUsers } from '../hooks/useUsers';
import { errorMessage } from '../lib/api-client';
import { ROLE_LABEL } from '../lib/labels';
import type { Role } from '../lib/types';

const PAGE_SIZE = 20;

export function UsersPage() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const sectors = useCatalog('sectors');
  const users = useUsers({
    q: q || undefined,
    role: role || undefined,
    sectorId: sectorId || undefined,
    active: active || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const userAction = useUserAction();

  const filterChange = (setter: (value: string) => void) => (event: { target: { value: string } }) => {
    setter(event.target.value);
    setPage(1);
  };

  const runAction = (id: number, name: string, action: 'deactivate' | 'reactivate' | 'reset-password') => {
    setNotice(null);
    userAction.mutate(
      { id, action },
      {
        onSuccess: (result) => {
          if (action === 'reset-password' && result.temporaryPassword) {
            setNotice(`Senha temporária de ${name}: ${result.temporaryPassword} (exibida uma única vez; a troca é obrigatória no próximo acesso).`);
          }
        },
      },
    );
  };

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Usuários</h1>
          <p className="muted">Contas nunca são excluídas: ao desativar, o usuário perde o acesso e o histórico permanece.</p>
        </div>
        <Link to="/users/new" className="btn btn-primary">
          Cadastrar usuário
        </Link>
      </div>
      <div className="filters">
        <div className="field" style={{ flex: '2 1 260px' }}>
          <label htmlFor="busca">Buscar por nome, e-mail ou login</label>
          <input id="busca" type="search" value={q} onChange={filterChange(setQ)} />
        </div>
        <div className="field">
          <label htmlFor="f-role">Perfil</label>
          <select id="f-role" value={role} onChange={filterChange(setRole)}>
            <option value="">Todos</option>
            {(Object.keys(ROLE_LABEL) as Role[]).map((key) => (
              <option key={key} value={key}>
                {ROLE_LABEL[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-sector">Setor</label>
          <select id="f-sector" value={sectorId} onChange={filterChange(setSectorId)}>
            <option value="">Todos</option>
            {(sectors.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-active">Conta</label>
          <select id="f-active" value={active} onChange={filterChange(setActive)}>
            <option value="">Todas</option>
            <option value="true">Ativa</option>
            <option value="false">Inativa</option>
          </select>
        </div>
      </div>
      {notice ? (
        <p className="alert alert-info" role="status">
          {notice}
        </p>
      ) : null}
      {userAction.isError ? (
        <p className="alert alert-error" role="alert">
          {errorMessage(userAction.error)}
        </p>
      ) : null}
      <div className="card flush">
        <table style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Perfil</th>
              <th>Setor</th>
              <th>Conta</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(users.data?.items ?? []).map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.name}</strong>
                  <div className="sub">
                    {u.email} · {u.login}
                  </div>
                </td>
                <td>{ROLE_LABEL[u.role]}</td>
                <td>{u.sectorName}</td>
                <td>
                  <span className={u.isActive ? 'chip chip-active' : 'chip chip-inactive'}>{u.isActive ? 'Ativa' : 'Inativa'}</span>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div className="btn-row end">
                    <Link to={`/users/${u.id}/edit`} className="btn">
                      Editar
                    </Link>
                    <button type="button" className="btn" disabled={userAction.isPending} onClick={() => runAction(u.id, u.name, 'reset-password')}>
                      Redefinir senha
                    </button>
                    {u.isActive ? (
                      <button type="button" className="btn btn-danger" disabled={userAction.isPending} onClick={() => runAction(u.id, u.name, 'deactivate')}>
                        Desativar
                      </button>
                    ) : (
                      <button type="button" className="btn btn-outline-accent" disabled={userAction.isPending} onClick={() => runAction(u.id, u.name, 'reactivate')}>
                        Reativar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.data ? <Pagination page={page} pageSize={PAGE_SIZE} total={users.data.total} onChange={setPage} /> : null}
    </div>
  );
}
