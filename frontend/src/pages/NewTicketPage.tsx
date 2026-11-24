import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/AuthProvider';
import { AttachmentPicker } from '../components/AttachmentPicker';
import { FormField } from '../components/FormField';
import { useCatalog } from '../hooks/useCatalog';
import { useCreateTicket } from '../hooks/useTickets';
import { errorMessage } from '../lib/api-client';
import { AFFECTED_OPTIONS, ALTERNATIVE_OPTIONS, BLOCKING_OPTIONS } from '../lib/labels';

const schema = z.object({
  description: z.string().trim().min(1, 'Descreva o problema.').max(5000),
  serial: z.string().trim().min(1, 'Informe o número de série do equipamento.').max(80),
  title: z.string().max(150).optional(),
  categoryId: z.string().optional(),
  impactAffected: z.string().min(1),
  impactBlocking: z.string().min(1),
  impactAlternative: z.string().min(1),
});

type Values = z.infer<typeof schema>;

export function NewTicketPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const sectors = useCatalog('sectors');
  const categories = useCatalog('categories');
  const createTicket = useCreateTicket();
  const [files, setFiles] = useState<File[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { impactAffected: 'SELF', impactBlocking: 'NONE', impactAlternative: 'YES', categoryId: '' },
  });

  const sectorName = sectors.data?.find((s) => s.id === user?.sectorId)?.name ?? '';

  const onSubmit = async (values: Values) => {
    setServerError(null);
    const form = new FormData();
    form.set('description', values.description);
    form.set('serial', values.serial);
    if (values.title) form.set('title', values.title);
    if (values.categoryId) form.set('categoryId', values.categoryId);
    form.set('impactAffected', values.impactAffected);
    form.set('impactBlocking', values.impactBlocking);
    form.set('impactAlternative', values.impactAlternative);
    files.forEach((file) => form.append('files', file));
    try {
      const ticket = await createTicket.mutateAsync(form);
      navigate(`/tickets/${ticket.id}`);
    } catch (error) {
      setServerError(errorMessage(error));
    }
  };

  return (
    <div className="container narrow">
      <div>
        <h1>Abrir chamado</h1>
        <p className="muted">Seu nome, e-mail e setor são preenchidos automaticamente a partir da sua conta.</p>
      </div>
      <form className="card" onSubmit={handleSubmit(onSubmit)} noValidate style={{ padding: 24, gap: 20 }}>
        <p className="muted small">
          Solicitante: <strong>{user?.name}</strong> · {user?.email}
          {sectorName ? ` · ${sectorName}` : ''}
        </p>
        <FormField label="Descrição do problema" required error={errors.description?.message}>
          <textarea rows={4} placeholder="Conte o que está acontecendo e desde quando." {...register('description')} />
        </FormField>
        <FormField
          label="Número de série do equipamento"
          required
          hint="Se o número ainda não estiver cadastrado, o chamado é aberto mesmo assim e a TI valida o equipamento depois."
          error={errors.serial?.message}
        >
          <input type="text" className="mono" {...register('serial')} />
        </FormField>
        <fieldset>
          <legend>Impacto (usado para sugerir a prioridade)</legend>
          <FormField label="Quantas pessoas são afetadas?">
            <select {...register('impactAffected')}>
              {AFFECTED_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="O problema impede você de trabalhar?">
            <select {...register('impactBlocking')}>
              {BLOCKING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Existe alguma alternativa temporária?">
            <select {...register('impactAlternative')}>
              {ALTERNATIVE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FormField>
        </fieldset>
        <div className="field-row">
          <FormField label="Título (opcional)" error={errors.title?.message}>
            <input type="text" {...register('title')} />
          </FormField>
          <FormField label="Categoria (opcional)">
            <select {...register('categoryId')}>
              <option value="">Selecione</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <AttachmentPicker files={files} onChange={setFiles} />
        {serverError ? (
          <p className="alert alert-error" role="alert">
            {serverError}
          </p>
        ) : null}
        <div className="btn-row end">
          <button type="button" className="btn" onClick={() => navigate('/my-tickets')}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={createTicket.isPending}>
            Abrir chamado
          </button>
        </div>
      </form>
    </div>
  );
}
