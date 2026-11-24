import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AppConfig } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

const baseUser = {
  id: 1,
  name: 'Paula Ribeiro',
  email: 'paula@empresa.example',
  login: 'paula',
  passwordHash: 'hash',
  role: 'EMPLOYEE',
  sectorId: 1,
  isActive: true,
  mustChangePassword: false,
};

function build(overrides: { user?: Record<string, unknown> | null; verify?: boolean } = {}) {
  const user = overrides.user === undefined ? baseUser : overrides.user;
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      findUniqueOrThrow: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue({ ...baseUser, mustChangePassword: false }),
    },
  };
  const passwords = {
    verify: jest.fn().mockResolvedValue(overrides.verify ?? true),
    hash: jest.fn().mockResolvedValue('novo-hash'),
  };
  const sessions = {
    create: jest.fn().mockResolvedValue({ token: 't', expiresAt: new Date() }),
    revokeAllForUser: jest.fn().mockResolvedValue(undefined),
  };
  const config = { settings: { passwordMinLength: 10 } };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    passwords as unknown as PasswordService,
    sessions as unknown as SessionService,
    config as unknown as AppConfig,
  );
  return { service, prisma, passwords, sessions };
}

describe('AuthService', () => {
  it('autentica usuário ativo com senha correta', async () => {
    const { service, sessions } = build();
    const result = await service.login(' Paula ', 'senha');
    expect(result.user.login).toBe('paula');
    expect(sessions.create).toHaveBeenCalledWith(1);
  });

  it('rejeita conta inativa mesmo com senha correta', async () => {
    const { service, sessions } = build({ user: { ...baseUser, isActive: false } });
    await expect(service.login('paula', 'senha')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('rejeita usuário inexistente e senha incorreta com a mesma mensagem', async () => {
    const missing = build({ user: null });
    const wrong = build({ verify: false });
    await expect(missing.service.login('x', 'y')).rejects.toThrow('Login ou senha inválidos.');
    await expect(wrong.service.login('paula', 'y')).rejects.toThrow('Login ou senha inválidos.');
  });

  it('troca a senha, revoga sessões antigas e cria nova sessão', async () => {
    const { service, sessions, passwords } = build();
    await service.changePassword(
      { id: 1, name: 'P', email: 'e', login: 'paula', role: 'EMPLOYEE', sectorId: 1, mustChangePassword: true },
      'atual-senha',
      'nova-senha-longa',
    );
    expect(passwords.hash).toHaveBeenCalledWith('nova-senha-longa');
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(1);
    expect(sessions.create).toHaveBeenCalled();
  });

  it('rejeita nova senha curta ou igual à atual', async () => {
    const { service } = build();
    const user = { id: 1, name: 'P', email: 'e', login: 'paula', role: 'EMPLOYEE' as const, sectorId: 1, mustChangePassword: true };
    await expect(service.changePassword(user, 'atual-senha', 'curta')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.changePassword(user, 'mesma-senha-longa', 'mesma-senha-longa')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejeita troca quando a senha atual está errada', async () => {
    const { service } = build({ verify: false });
    const user = { id: 1, name: 'P', email: 'e', login: 'paula', role: 'EMPLOYEE' as const, sectorId: 1, mustChangePassword: true };
    await expect(service.changePassword(user, 'errada', 'nova-senha-longa')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
