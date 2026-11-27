import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, initialTheme } from '../lib/theme';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    applyTheme('light');
  });

  it('alterna para o tema escuro e lembra a escolha', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Usar tema escuro' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('button', { name: 'Usar tema claro' })).toHaveAttribute('aria-pressed', 'true');
    expect(initialTheme()).toBe('dark');
  });

  it('volta para o tema claro', () => {
    applyTheme('dark');
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Usar tema claro' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(initialTheme()).toBe('light');
  });
});
