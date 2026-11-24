import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { AppConfig } from '../config/env.validation';
import { AuthUser, toAuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';

export const SESSION_COOKIE = 'sid';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async create(userId: number): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.config.settings.sessionTtlHours * 3_600_000);
    await this.prisma.session.create({ data: { tokenHash: this.hash(token), userId, expiresAt } });
    return { token, expiresAt };
  }

  async validate(token: string): Promise<AuthUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt.getTime() < Date.now() || !session.user.isActive) return null;
    return toAuthUser(session.user);
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tokenHash: this.hash(token) } });
  }

  async revokeAllForUser(userId: number): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}
