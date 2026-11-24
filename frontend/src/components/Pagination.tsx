interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav className="pagination" aria-label="Paginação">
      <span>
        {total} {total === 1 ? 'registro' : 'registros'} · página {page} de {pages}
      </span>
      <button type="button" className="btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Anterior
      </button>
      <button type="button" className="btn" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Próxima
      </button>
    </nav>
  );
}
