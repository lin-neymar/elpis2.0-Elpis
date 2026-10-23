import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '../../config/config.service';

/** 对照 elpis-core/loader/router.js GET * 兜底 */
@Controller()
export class FallbackController {
  constructor(private readonly configService: ConfigService) {}

  @Get('*')
  catchAll(@Res() res: Response) {
    const homePage = this.configService.getBootstrapOptions().homePage ?? '/';
    res.redirect(302, homePage);
  }
}
