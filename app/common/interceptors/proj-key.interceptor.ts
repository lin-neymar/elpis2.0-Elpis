import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, EMPTY } from 'rxjs';

type ProjKeyRequest = Request & { projKey?: string };

/**
 * 对照 app/middleware/project-handler.js
 */
@Injectable()
export class ProjKeyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<ProjKeyRequest>();
    const path = req.path ?? '';

    if (!path.includes('/api/proj/')) {
      return next.handle();
    }

    const raw = req.headers.proj_key;
    const projKey = Array.isArray(raw) ? raw[0] : raw;

    if (!projKey) {
      const res = http.getResponse<Response>();
      res.status(200).json({
        success: false,
        message: 'proj_key not found',
        code: 446,
      });
      return EMPTY;
    }

    req.projKey = projKey;
    return next.handle();
  }
}
