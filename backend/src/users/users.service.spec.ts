import { BadRequestException, ConflictException } from '@nestjs/common';
import { PasswordService } from '../auth/password.service';
import { SessionService } from '../auth/session.service';
import { AuthUser } from '../common/types/auth-user';
import { AppConfig } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const storedUser = {
  id: 7,
  name: 'Renato',
  email: 'renato@empresa.example',
  login: 'renato',
  role: 'EMPLOYEE',
  sectorId: 2,
  isActive: true,
  mustChangePassword: true,
  deactivatedAt: null,
  createdAt: new Date(),
  sector: { name: 'Comercial' },
};

function build() {
  const prisma = {
    sector: { findUnique: jest.fn().mockResolvedValue({ id: 2 }) },
    user: {
      create: jest.fn().mockResolvedValue(storedUser),
      findUnique: jest.fn().mockResolvedValue(storedUser),
      update: jest.fn().mockResolvedValue(storedUser),
    },
  };
  const passwords = { hash: jest.fn().mockResolvedValue('hash') };
  const sessions = { revokeAllForUser: jest.fn().mockResolvedValue(undefined) };
  const config = { settings: { passwordMinLength: 10 } };
  const service = new UsersService(
    prisma as unknown as PrismaService,
    passwords as unknown as PasswordService,
    sessions as unknown as SessionService,
    config as unknown as AppConfig,
  );
  return { service, prisma, passwords, sessions };
}

const admin: AuthUser = { id: 1, name: 'Helena', email: 'h@e', login: 'helena', role: 'ADMIN', sectorId: 1, mustChangePassword: false };

describe('UsersService', () => {
  it('cria usuário com e-mail e login normalizados e troca de senha obrigatória', async () => {
    const { service, prisma } = build();
    await service.create({
      name: ' Renato ',
      email: 'Renato@Empresa.Example',
      login: 'Renato',
      role: 'EMPLOYEE',
      sectorId: 2,
      temporaryPassword: 'senha-temporaria-1',
    });
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.email).toBe('renato@empresa.example');
    expect(data.login).toBe('renato');
    expect(data.mustChangePassword).toBe(true);
  });

  it('gera senha temporária quando não informada e a devolve uma única vez', async () => {
    const { service } = build();
    const created = await service.create({ name: 'R', email: 'r@e.example', login: 'rrr', role: 'EMPLOYEE', sectorId: 2 });
    expect(created.temporaryPassword).toBeDefined();
    expect(created.temporaryPassword!.length).toBeGreaterThanOrEqual(10);
  });

  it('rejeita senha temporária curta', async () => {
    const { service } = build();
    await expect(
      service.create({ name: 'R', email: 'r@e.example', login: 'rrr', role: 'EMPLOYEE', sectorId: 2, temporaryPassword: 'curta' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita setor inexistente', async () => {
    const { service, prisma } = build();
    prisma.sector.findUnique.mockResolvedValue(null);
    await expect(
      service.create({ name: 'R', email: 'r@e.example', login: 'rrr', role: 'EMPLOYEE', sectorId: 99 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('desativa conta registrando autor e encerrando sessões', async () => {
    const { service, prisma, sessions } = build();
    await service.deactivate(admin, 7);
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.isActive).toBe(false);
    expect(data.deactivatedById).toBe(1);
    expect(data.deactivatedAt).toBeInstanceOf(Date);
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(7);
  });

  it('não permite desativar a própria conta', async () => {
    const { service } = build();
    await expect(service.deactivate(admin, 1)).rejects.toBeInstanceOf(ConflictException);
  });

  it('redefine a senha exigindo troca e encerrando sessões', async () => {
    const { service, prisma, sessions } = build();
    const result = await service.resetPassword(7);
    expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(10);
    expect(prisma.user.update.mock.calls[0][0].data.mustChangePassword).toBe(true);
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(7);
  });
});
