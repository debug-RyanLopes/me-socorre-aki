import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { FormField } from '../components/FormField';
import { Pagination } from '../components/Pagination';
import { useCatalog } from '../hooks/useCatalog';
import { useCreateEquipment, useEquipmentList, usePendingSerials } from '../hooks/useEquipment';
import { errorMessage } from '../lib/api-client';
import { EQUIPMENT_TYPE_LABEL } from '../lib/labels';
import type { EquipmentType } from '../lib/types';

const PAGE_SIZE = 20;

const schema = z.object({
  serial: z.string().trim().min(1, 'Informe o serial.').max(80),
  type: z.enum(['NOTEBOOK', 'DESKTOP', 'PRINTER', 'PERIPHERAL', 'OTHER']),
  manufacturer: z.string().trim().min(1, 'Informe o fabricante.').max(100),
  model: z.string().trim().min(1, 'Informe o modelo.').max(100),
  sectorId: z.string().min(1, 'Selecione o setor.'),
  assetTag: z.string().max(60).optional(),
});

type Values = z.infer<typeof schema>;

export function EquipmentPage() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const sectors = useCatalog('sectors');
  const list = useEquipmentList({ q: q || undefined, type: type || undefined, sectorId: sectorId || undefined, page, pageSize: PAGE_SIZE });
  const pending = usePendingSerials();
  const createEquipment = useCreateEquipment();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'NOTEBOOK', sectorId: '', assetTag: '' },
  });

  const filterChange = (setter: (value: string) => void) => (event: { target: { value: string } }) => {
    setter(event.target.value);
    setPage(1);
  };

  const onSubmit = async (values: Values) => {
    setServerError(null);
    setNotice(null);
    try {
      const created = await createEquipment.mutateAsync({
        serial: values.serial,
        type: values.type as EquipmentType,
        manufacturer: values.manufacturer,
        model: values.model,
        sectorId: Number(values.sectorId),
        assetTag: values.assetTag || undefined,
      });
      setNotice(
        created.linkedTickets
          ? `Equipamento cadastrado e ${created.linkedTickets} chamado(s) vinculado(s).`
          : 'Equipamento cadastrado.',
      );
      reset({ type: 'NOTEBOOK', sectorId: '', assetTag: '', serial: '', manufacturer: '', model: '' });
    } catch (error) {
      setServerError(errorMessage(error));
    }
  };

  return (
    <div className="container">
      <div>
        <h1>Equipamentos</h1>
        <p className="muted">Cadastro por número de série, com histórico de chamados por equipamento.</p>
      </div>
      <div className="split">
        <section className="main">
          <div className="filters">
            <div className="field" style={{ flex: '2 1 220px' }}>
              <label htmlFor="busca">Buscar por serial, modelo ou fabricante</label>
              <input id="busca" type="search" value={q} onChange={filterChange(setQ)} />
            </div>
            <div className="field">
              <label htmlFor="f-type">Tipo</label>
              <select id="f-type" value={type} onChange={filterChange(setType)}>
                <option value="">Todos</option>
                {(Object.keys(EQUIPMENT_TYPE_LABEL) as EquipmentType[]).map((key) => (
                  <option key={key} value={key}>
                    {EQUIPMENT_TYPE_LABEL[key]}
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
          </div>
          <div className="card flush">
            <table style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th>Serial</th>
                  <th>Equipamento</th>
                  <th>Setor</th>
                  <th>Chamados</th>
                </tr>
              </thead>
              <tbody>
                {(list.data?.items ?? []).map((item) => (
                  <tr key={item.id}>
                    <td className="mono">{item.serial}</td>
                    <td>
                      <strong>
                        {item.manufacturer} {item.model}
                      </strong>
                      <div className="sub">{EQUIPMENT_TYPE_LABEL[item.type]}</div>
                    </td>
                    <td>{item.sectorName}</td>
                    <td>
                      <Link to={`/queue?q=${encodeURIComponent(item.serial)}`} style={{ fontWeight: 600, textDecoration: 'none' }}>
                        {item.ticketCount} {item.ticketCount === 1 ? 'chamado' : 'chamados'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.data && list.data.items.length === 0 ? <p className="muted">Nenhum equipamento encontrado.</p> : null}
          {list.data ? <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onChange={setPage} /> : null}
        </section>

        <aside className="side">
          <section className="card card-warning" aria-labelledby="pending-title">
            <h2 id="pending-title">Seriais pendentes de validação ({pending.data?.length ?? 0})</h2>
            <p className="small">Informados em chamados, mas ainda não cadastrados.</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(pending.data ?? []).map((item) => (
                <li
                  key={item.serial}
                  style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}
                >
                  <span>
                    <span className="mono" style={{ fontWeight: 600 }}>{item.serial}</span>
                    <br />
                    <span className="muted">
                      {item.ticketCount} {item.ticketCount === 1 ? 'chamado' : 'chamados'} · {item.tickets[0]?.requesterName}
                    </span>
                  </span>
                  <button type="button" className="btn btn-outline-accent" onClick={() => setValue('serial', item.serial)}>
                    Validar
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <form className="card" onSubmit={handleSubmit(onSubmit)} noValidate>
            <h2>Cadastrar equipamento</h2>
            <p className="muted small">Ao salvar, os chamados abertos com este serial são vinculados ao equipamento.</p>
            <FormField label="Serial" required error={errors.serial?.message}>
              <input type="text" className="mono" {...register('serial')} />
            </FormField>
            <FormField label="Tipo" required>
              <select {...register('type')}>
                {(Object.keys(EQUIPMENT_TYPE_LABEL) as EquipmentType[]).map((key) => (
                  <option key={key} value={key}>
                    {EQUIPMENT_TYPE_LABEL[key]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Fabricante" required error={errors.manufacturer?.message}>
              <input type="text" {...register('manufacturer')} />
            </FormField>
            <FormField label="Modelo" required error={errors.model?.message}>
              <input type="text" {...register('model')} />
            </FormField>
            <FormField label="Setor" required error={errors.sectorId?.message}>
              <select {...register('sectorId')}>
                <option value="">Selecione</option>
                {(sectors.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Nº de patrimônio (opcional)" error={errors.assetTag?.message}>
              <input type="text" {...register('assetTag')} />
            </FormField>
            {notice ? (
              <p className="alert alert-info" role="status">
                {notice}
              </p>
            ) : null}
            {serverError ? (
              <p className="alert alert-error" role="alert">
                {serverError}
              </p>
            ) : null}
            <button type="submit" className="btn btn-primary" disabled={createEquipment.isPending}>
              Cadastrar equipamento
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
