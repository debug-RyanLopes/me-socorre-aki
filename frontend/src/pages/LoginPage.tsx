import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/AuthProvider';
import { FormField } from '../components/FormField';
import { errorMessage } from '../lib/api-client';
import { homePathFor } from '../lib/labels';

const schema = z.object({
  login: z.string().trim().min(1, 'Informe o login.'),
  password: z.string().min(1, 'Informe a senha.'),
});

type Values = z.infer<typeof schema>;

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  if (user) return <Navigate to={user.mustChangePassword ? '/change-password' : homePathFor(user.role)} replace />;

  const onSubmit = async (values: Values) => {
    setServerError(null);
    try {
      const signedIn = await login(values.login, values.password);
      navigate(signedIn.mustChangePassword ? '/change-password' : homePathFor(signedIn.role), { replace: true });
    } catch (error) {
      setServerError(errorMessage(error));
    }
  };

  return (
    <div className="center-screen">
      <main className="auth-box">
        <div>
          <div className="brand">Me Socorre Aki</div>
          <h1>Entrar</h1>
          <p className="muted">Use o login e a senha fornecidos pela administração.</p>
        </div>
        <form className="card" onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField label="Login" error={errors.login?.message}>
            <input type="text" autoComplete="username" {...register('login')} />
          </FormField>
          <FormField label="Senha" error={errors.password?.message}>
            <input type="password" autoComplete="current-password" {...register('password')} />
          </FormField>
          {serverError ? (
            <p className="alert alert-error" role="alert">
              {serverError}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            Entrar
          </button>
          <p className="muted small">Esqueceu a senha? Peça a redefinição ao administrador do sistema.</p>
        </form>
      </main>
    </div>
  );
}
