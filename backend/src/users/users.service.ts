import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PasswordService } from '../auth/password.service';
import { SessionService } from '../auth/session.service';
import { Page, toSkipTake } from '../common/dto/pagination.dto';
import { AuthUser } from '../common/types/auth-user';
import { AppConfig } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQuery } from './dto/list-users.query';
import { UpdateUserDto } from './dto/update-user.dto';

export interface UserView {
  id: number;
  name: string;
  email: string;
  login: string;
  role: User['role'];
  sectorId: number;
  sectorName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  deactivatedAt: Date | null;
  createdAt: Date;
}

type UserWithSector = User & { sector: { name: string } };

function toView(user: UserWithSector): UserView {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    login: user.login,
    role: user.role,
    sectorId: user.sectorId,
    sectorName: user.sector.name,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    deactivatedAt: user.deactivatedAt,
    createdAt: user.createdAt,
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly config: AppConfig,
  ) {}

  private resolveTemporaryPassword(provided?: string): { plain: string; generated: boolean } {
    if (!provided) return { plain: randomBytes(9).toString('base64url'), generated: true };
    if (provided.length < this.config.settings.passwordMinLength) {
      throw new BadRequestException(
        `A senha temporária deve ter pelo menos ${this.config.settings.passwordMinLength} caracteres.`,
      );
    }
    return { plain: provided, generated: false };
  }

  private async assertSectorExists(sectorId: number): Promise<void> {
    const sector = await this.prisma.sector.findUnique({ where: { id: sectorId } });
    if (!sector) throw new BadRequestException('Setor inexistente.');
  }

  async create(dto: CreateUserDto): Promise<UserView & { temporaryPassword?: string }> {
    await this.assertSectorExists(dto.sectorId);
    const { plain, generated } = this.resolveTemporaryPassword(dto.temporaryPassword);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        login: dto.login.trim().toLowerCase(),
        role: dto.role,
        sectorId: dto.sectorId,
        passwordHash: await this.passwords.hash(plain),
        mustChangePassword: true,
      },
      include: { sector: true },
    });
    return generated ? { ...toView(user), temporaryPassword: plain } : toView(user);
  }

  async list(query: ListUsersQuery): Promise<Page<UserView>> {
    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role;
    if (query.sectorId) where.sectorId = query.sectorId;
    if (query.active !== undefined) where.isActive = query.active;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { email: { contains: query.q, mode: 'insensitive' } },
        { login: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, include: { sector: true }, orderBy: { name: 'asc' }, ...toSkipTake(query) }),
      this.prisma.user.count({ where }),
    ]);
    return { items: items.map(toView), total, page: query.page, pageSize: query.pageSize };
  }

  async get(id: number): Promise<UserView> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { sector: true } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return toView(user);
  }

  async update(id: number, dto: UpdateUserDto): Promise<UserView> {
    await this.get(id);
    if (dto.sectorId !== undefined) await this.assertSectorExists(dto.sectorId);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        email: dto.email?.trim().toLowerCase(),
        login: dto.login?.trim().toLowerCase(),
        role: dto.role,
        sectorId: dto.sectorId,
      },
      include: { sector: true },
    });
    return toView(user);
  }

  async deactivate(actor: AuthUser, id: number): Promise<UserView> {
    if (actor.id === id) throw new ConflictException('Você não pode desativar a própria conta.');
    await this.get(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false, deactivatedAt: new Date(), deactivatedById: actor.id },
      include: { sector: true },
    });
    await this.sessions.revokeAllForUser(id);
    return toView(user);
  }

  async reactivate(id: number): Promise<UserView> {
    await this.get(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: true, deactivatedAt: null, deactivatedById: null },
      include: { sector: true },
    });
    return toView(user);
  }

  async resetPassword(id: number, temporaryPassword?: string): Promise<{ temporaryPassword: string }> {
    await this.get(id);
    const { plain } = this.resolveTemporaryPassword(temporaryPassword);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await this.passwords.hash(plain), mustChangePassword: true },
    });
    await this.sessions.revokeAllForUser(id);
    return { temporaryPassword: plain };
  }
}
