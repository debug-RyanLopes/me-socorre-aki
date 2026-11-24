import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { FormField } from '../components/FormField';
import { useCatalog } from '../hooks/useCatalog';
import { useCreateUser, useUpdateUser, useUser } from '../hooks/useUsers';
import { errorMessage } from '../lib/api-client';
import { ROLE_LABEL } from '../lib/labels';
import type { Role } from '../lib/types';

const ROLE_DESCRIPTION: Record<Role, string> = {
  EMPLOYEE: 'Abre chamados e acompanha apenas os próprios.',
  TECHNICIAN: 'Atende a fila, comenta, registra observações internas e soluções.',
  ADMIN: 'Gerencia usuários, setores, categorias, equipamentos e relatórios.',
};

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome completo.').max(150),
  email: z.string().trim().email('Informe um e-mail válido.'),
  login: z.string().trim().regex(/^[a-zA-Z0-9._-]{3,50}$/, 'Use de 3 a 50 caracteres: letras, números, ponto, hífen ou sublinhado.'),
  sectorId: z.string().min(1, 'Selecione o setor.'),
  role: z.enum(['EMPLOYEE', 'TECHNICIAN', 'ADMIN']),
  temporaryPassword: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export function generatePassword(length = 14): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
}

export function UserFormPage() {
  const params = useParams();
  const editingId = params.id ? Number(params.id) : null;
  const navigate = useNavigate();
  const sectors = useCatalog('sectors');
  const existing = useUser(editingId);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser(editingId ?? 0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'EMPLOYEE', sectorId: '', temporaryPassword: '' },
  });
  const role = watch('role');

  useEffect(() => {
    if (existing.data) {
      reset({
        name: existing.data.name,
        email: existing.data.email,
        login: existing.data.login,
        sectorId: String(existing.data.sectorId),
        role: existing.data.role,
        temporaryPassword: '',
      });
    }
  }, [existing.data, reset]);

  const onSubmit = async (values: Values) => {
    setServerError(null);
    const base = {
      name: values.name,
      email: values.email,
      login: values.login,
      role: values.role,
      sectorId: Number(values.sectorId),
    };
    try {
      if (editingId !== null) {
        await updateUser.mutateAsync(base);
        navigate('/users');
        return;
      }
      const created = await createUser.mutateAsync({ ...base, temporaryPassword: values.temporaryPassword || undefined });
      if (created.temporaryPassword) setCreatedPassword(created.temporaryPassword);
      else navigate('/users');
    } catch (error) {
      setServerError(errorMessage(error));
    }
  };

  if (createdPassword) {
    return (
      <div className="container narrow">
        <h1>Usuário cadastrado</h1>
        <p className="alert alert-info" role="status">
          Senha temporária: <strong className="mono">{createdPassword}</strong>. Ela é exibida uma única vez; o usuário será obrigado a trocá-la no primeiro acesso.
        </p>
        <Link to="/users" className="btn btn-primary">
          Voltar para usuários
        </Link>
      </div>
    );
  }

  return (
    <div className="container narrow">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link to="/users" style={{ fontSize: 14, textDecoration: 'none' }}>
          ← Voltar para usuários
        </Link>
        <h1>{editingId !== null ? 'Editar usuário' : 'Cadastrar usuário'}</h1>
        <p className="muted">Somente administradores criam contas. Não existe cadastro público.</p>
      </div>
      <form className="card" onSubmit={handleSubmit(onSubmit)} noValidate style={{ padding: 24, gap: 20 }}>
        <FormField label="Nome completo" required error={errors.name?.message}>
          <input type="text" autoComplete="off" {...register('name')} />
        </FormField>
        <div className="field-row">
          <FormField label="E-mail" required error={errors.email?.message}>
            <input type="email" autoComplete="off" {...register('email')} />
          </FormField>
          <FormField label="Login" required error={errors.login?.message}>
            <input type="text" autoComplete="off" {...register('login')} />
          </FormField>
        </div>
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
        <fieldset>
          <legend>
            Perfil de acesso <span className="required" aria-hidden="true">*</span>
          </legend>
          {(Object.keys(ROLE_LABEL) as Role[]).map((key) => (
            <label key={key} className="radio">
              <input type="radio" value={key} {...register('role')} />
              <span>
                <strong>{ROLE_LABEL[key]}</strong>
                <br />
                <span className="muted small">{ROLE_DESCRIPTION[key]}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {editingId === null ? (
          <div className="field">
            <label htmlFor="temporary-password">Senha temporária</label>
            <div className="btn-row" style={{ flexWrap: 'nowrap' }}>
              <input
                id="temporary-password"
                type="text"
                autoComplete="off"
                className="mono"
                style={{ flex: 1 }}
                aria-describedby="temporary-password-hint"
                {...register('temporaryPassword')}
              />
              <button type="button" className="btn" onClick={() => setValue('temporaryPassword', generatePassword())}>
                Gerar senha
              </button>
            </div>
            <span id="temporary-password-hint" className="hint">
              Deixe em branco para gerar automaticamente. No primeiro acesso, o usuário será obrigado a trocar a senha.
            </span>
          </div>
        ) : null}
        {editingId === null ? (
          <p className="alert alert-info small">
            A conta é criada como <strong>Ativa</strong>. Ela pode ser desativada depois sem apagar chamados, comentários ou histórico.
          </p>
        ) : null}
        {role === 'ADMIN' ? <p className="muted small">Administradores têm acesso total ao sistema.</p> : null}
        {serverError ? (
          <p className="alert alert-error" role="alert">
            {serverError}
          </p>
        ) : null}
        <div className="btn-row end">
          <Link to="/users" className="btn">
            Cancelar
          </Link>
          <button type="submit" className="btn btn-primary" disabled={createUser.isPending || updateUser.isPending}>
            {editingId !== null ? 'Salvar alterações' : 'Cadastrar usuário'}
          </button>
        </div>
      </form>
    </div>
  );
}
