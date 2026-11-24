import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AppConfig } from '../config/env.validation';
import { AuthUser, toAuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

export interface LoginResult {
  user: AuthUser;
  token: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly config: AppConfig,
  ) {}

  async login(login: string, password: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { login: login.trim().toLowerCase() } });
    const valid = user ? await this.passwords.verify(user.passwordHash, password) : false;
    if (!user || !user.isActive || !valid) {
      throw new UnauthorizedException('Login ou senha inválidos.');
    }
    const session = await this.sessions.create(user.id);
    return { user: toAuthUser(user), ...session };
  }

  async changePassword(user: AuthUser, currentPassword: string, newPassword: string): Promise<LoginResult> {
    const record = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await this.passwords.verify(record.passwordHash, currentPassword))) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }
    if (newPassword.length < this.config.settings.passwordMinLength) {
      throw new BadRequestException(
        `A nova senha deve ter pelo menos ${this.config.settings.passwordMinLength} caracteres.`,
      );
    }
    if (newPassword === currentPassword) {
      throw new BadRequestException('A nova senha deve ser diferente da senha atual.');
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.passwords.hash(newPassword), mustChangePassword: false },
    });
    await this.sessions.revokeAllForUser(user.id);
    const session = await this.sessions.create(user.id);
    return { user: toAuthUser(updated), ...session };
  }
}
