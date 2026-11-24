import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ReasonDialog } from './ReasonDialog';

function setup(props: Partial<Parameters<typeof ReasonDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ReasonDialog
      title="Reabrir chamado"
      label="Motivo da reabertura"
      confirmLabel="Reabrir chamado"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onConfirm, onCancel };
}

describe('ReasonDialog', () => {
  it('expõe o diálogo com título e campo de motivo acessíveis', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Reabrir chamado' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Motivo da reabertura/)).toBeInTheDocument();
  });

  it('não confirma sem motivo e mostra o erro', async () => {
    const { onConfirm } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Reabrir chamado' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Este campo é obrigatório.');
  });

  it('não confirma com motivo apenas em branco', async () => {
    const { onConfirm } = setup();
    await userEvent.type(screen.getByLabelText(/Motivo da reabertura/), '    ');
    await userEvent.click(screen.getByRole('button', { name: 'Reabrir chamado' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirma com o motivo sem espaços nas pontas', async () => {
    const { onConfirm } = setup();
    await userEvent.type(screen.getByLabelText(/Motivo da reabertura/), '  O problema voltou  ');
    await userEvent.click(screen.getByRole('button', { name: 'Reabrir chamado' }));
    expect(onConfirm).toHaveBeenCalledWith('O problema voltou');
  });

  it('cancela pelo botão Voltar e pela tecla Escape', async () => {
    const { onCancel } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('mostra o erro do servidor e desabilita a confirmação enquanto ocupado', () => {
    setup({ error: 'Prazo de reabertura expirado.', busy: true });
    expect(screen.getByRole('alert')).toHaveTextContent('Prazo de reabertura expirado.');
    expect(screen.getByRole('button', { name: 'Reabrir chamado' })).toBeDisabled();
  });
});
