import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfHeaderMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    if (!SAFE_METHODS.has(req.method) && !req.headers['x-requested-with']) {
      throw new ForbiddenException('Cabeçalho X-Requested-With ausente.');
    }
    next();
  }
}
