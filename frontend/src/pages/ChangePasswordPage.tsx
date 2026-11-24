import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/AuthProvider';
import { FormField } from '../components/FormField';
import { errorMessage } from '../lib/api-client';
import { homePathFor } from '../lib/labels';

const MIN_LENGTH = 10;

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: z.string().min(MIN_LENGTH, `A nova senha deve ter pelo menos ${MIN_LENGTH} caracteres.`),
    confirm: z.string(),
  })
  .refine((values) => values.newPassword === values.confirm, {
    path: ['confirm'],
    message: 'As senhas não conferem.',
  });

type Values = z.infer<typeof schema>;

export function ChangePasswordPage() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  if (!user) return <Navigate to="/login" replace />;

  const onSubmit = async (values: Values) => {
    setServerError(null);
    try {
      const updated = await changePassword(values.currentPassword, values.newPassword);
      navigate(homePathFor(updated.role), { replace: true });
    } catch (error) {
      setServerError(errorMessage(error));
    }
  };

  return (
    <div className="center-screen">
      <main className="auth-box">
        <div>
          <div className="brand">Me Socorre Aki</div>
          <h1>{user.mustChangePassword ? 'Crie sua senha' : 'Trocar senha'}</h1>
          <p className="muted">
            {user.mustChangePassword
              ? 'Este é o seu primeiro acesso. Troque a senha temporária por uma senha só sua para continuar.'
              : 'Informe a senha atual e escolha uma nova.'}
          </p>
        </div>
        <form className="card" onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField label="Senha atual" error={errors.currentPassword?.message}>
            <input type="password" autoComplete="current-password" {...register('currentPassword')} />
          </FormField>
          <FormField
            label="Nova senha"
            hint={`Mínimo de ${MIN_LENGTH} caracteres, diferente da senha atual.`}
            error={errors.newPassword?.message}
          >
            <input type="password" autoComplete="new-password" {...register('newPassword')} />
          </FormField>
          <FormField label="Confirmar nova senha" error={errors.confirm?.message}>
            <input type="password" autoComplete="new-password" {...register('confirm')} />
          </FormField>
          {serverError ? (
            <p className="alert alert-error" role="alert">
              {serverError}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            Salvar e entrar
          </button>
        </form>
      </main>
    </div>
  );
}
