import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SESSION_COOKIE, SessionService } from '../../auth/session.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser } from '../types/auth-user';

const ALLOWED_WHEN_PASSWORD_CHANGE_REQUIRED = ['/auth/change-password', '/auth/me', '/auth/logout'];

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token: string | undefined = req.cookies?.[SESSION_COOKIE];
    const user = token ? await this.sessions.validate(token) : null;
    if (!user) throw new UnauthorizedException('Sessão inválida ou expirada.');

    const allowed = ALLOWED_WHEN_PASSWORD_CHANGE_REQUIRED.some((path) => req.path.endsWith(path));
    if (user.mustChangePassword && !allowed) {
      throw new ForbiddenException('PASSWORD_CHANGE_REQUIRED');
    }

    req.user = user;
    return true;
  }
}
