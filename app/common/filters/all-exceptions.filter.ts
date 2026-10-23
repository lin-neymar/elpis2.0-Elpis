import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '../../config/config.service';
import { LoggerProvider } from '../../extend/logger.provider';

/** 兼容 demo / 框架各自 node_modules 下的 HttpException */
function readHttpExceptionPayload(exception: unknown): {
  status: number;
  body: Record<string, unknown>;
} | null {
  if (
    typeof exception !== 'object' ||
    exception === null ||
    typeof (exception as HttpException).getStatus !== 'function' ||
    typeof (exception as HttpException).getResponse !== 'function'
  ) {
    return null;
  }
  const ex = exception as HttpException;
  const status = ex.getStatus();
  const exceptionResponse = ex.getResponse();
  if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
    return { status, body: exceptionResponse as Record<string, unknown> };
  }
  return null;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly configService: ConfigService,
    private readonly loggerProvider: LoggerProvider,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (response.headersSent) {
      return;
    }

    const httpPayload = readHttpExceptionPayload(exception);
    if (httpPayload) {
      const { status, body } = httpPayload;
      const redirect = body.elpisRedirect;
      if (typeof redirect === 'string') {
        response.redirect(302, redirect);
        return;
      }
      if ('success' in body && 'code' in body) {
        response.status(status).json(body);
        return;
      }
    }

    const err = exception as {
      status?: number;
      message?: string;
      detail?: unknown;
    };
    const message =
      err?.message ??
      (exception instanceof Error ? exception.message : String(exception));

    this.loggerProvider.logger.info(JSON.stringify(exception));
    this.loggerProvider.logger.error('[-- exception --]:', exception);
    this.loggerProvider.logger.error(
      '[-- exception --]:',
      err?.status,
      message,
      err?.detail,
    );

    if (message && message.indexOf('template not found') > -1) {
      const homePage = this.configService.get('homePage') as string | undefined;
      response.redirect(302, homePage ?? '/');
      return;
    }

    response.status(200).json({
      success: false,
      code: 50000,
      message: '网络异常 请稍后重试',
    });
  }
}
