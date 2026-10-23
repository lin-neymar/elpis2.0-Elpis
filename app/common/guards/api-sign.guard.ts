import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import md5 = require('md5');
import { ConfigService } from '../../config/config.service';
import { LoggerProvider } from '../../extend/logger.provider';

const SIGN_KEY = 'klx05hb3n1c9ujp8uhxbs2ikkiowp212';
const TIMEOUT_MS = 600000;

@Injectable()
export class ApiSignGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly loggerProvider: LoggerProvider,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      path: string;
      method: string;
      headers: Record<string, string | string[] | undefined>;
    }>();
    const { path, method, headers } = request;

    const whiteList = this.configService.get('apiSignVerify.whiteList') as
      | string[]
      | undefined;
    if (whiteList?.includes(path)) {
      return true;
    }

    if (path.indexOf('/api') < 0) {
      return true;
    }

    const sSign = headers.s_sign as string | undefined;
    const st = headers.s_t as string | undefined;

    const signature = md5(`${SIGN_KEY}_${st}`).toLowerCase();
    this.loggerProvider.logger.info(`[${method} ${path}] signature: ${signature}`);

    const stNum = Number(st);
    if (
      !sSign ||
      !st ||
      signature !== String(sSign).toLowerCase() ||
      Date.now() - stNum > TIMEOUT_MS
    ) {
      throw new HttpException(
        {
          success: false,
          message: 'signature not correct or api timeout!!',
          code: 445,
        },
        HttpStatus.OK,
      );
    }

    return true;
  }
}
