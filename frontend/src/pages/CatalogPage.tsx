import { FormEvent, useState } from 'react';
import { CatalogKind, useCatalog, useCatalogMutations } from '../hooks/useCatalog';
import { errorMessage } from '../lib/api-client';

function CatalogSection({ kind, title, singular }: { kind: CatalogKind; title: string; singular: string }) {
  const items = useCatalog(kind, true);
  const { create, update } = useCatalogMutations(kind);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setError(null);
    create.mutate(name.trim(), {
      onSuccess: () => setName(''),
      onError: (e) => setError(errorMessage(e)),
    });
  };

  return (
    <section className="card" aria-labelledby={`${kind}-title`}>
      <h2 id={`${kind}-title`}>{title}</h2>
      <form className="btn-row" onSubmit={submit} style={{ flexWrap: 'nowrap' }}>
        <label htmlFor={`${kind}-new`} className="sr-only">
          Novo {singular}
        </label>
        <input
          id={`${kind}-new`}
          type="text"
          style={{ flex: 1 }}
          placeholder={`Novo ${singular}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={create.isPending}>
          Adicionar
        </button>
      </form>
      {error ? (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      ) : null}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(items.data ?? []).map((item) => (
          <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderBottom: '1px solid #eef0f3', paddingBottom: 8 }}>
            <span>
              {item.name} <span className={item.active ? 'chip chip-active' : 'chip chip-inactive'}>{item.active ? 'Ativo' : 'Inativo'}</span>
            </span>
            <button
              type="button"
              className="btn"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: item.id, active: !item.active })}
            >
              {item.active ? 'Desativar' : 'Reativar'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CatalogPage() {
  return (
    <div className="container">
      <div>
        <h1>Setores e categorias</h1>
        <p className="muted">Itens desativados deixam de aparecer nos formulários, mas continuam nos chamados antigos.</p>
      </div>
      <div className="split">
        <div className="main">
          <CatalogSection kind="sectors" title="Setores" singular="setor" />
        </div>
        <div className="main">
          <CatalogSection kind="categories" title="Categorias" singular="categoria" />
        </div>
      </div>
    </div>
  );
}
