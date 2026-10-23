import {
  Controller,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import nunjucks = require('nunjucks');
import { ConfigService } from '../../config/config.service';

const templateRoot = join(process.cwd(), 'app/public');
const nunjucksEnv = nunjucks.configure(templateRoot, {
  noCache: true,
  trimBlocks: true,
  autoescape: true,
});

@Controller('view')
export class ViewController {
  constructor(private readonly configService: ConfigService) {}

  @Get([':page', ':page/{*path}'])
  renderPage(
    @Param('page') page: string,
    @Query() query: Record<string, string | undefined>,
    @Res() res: Response,
  ) {
    const html = nunjucksEnv.render(`dist/entry.${page}.tpl`, {
      projKey: query.proj_key,
      name: this.configService.get('name'),
      env: this.configService.getEnv(),
      options: JSON.stringify(this.configService.getBootstrapOptions()),
    });

    res.type('html').send(html);
  }
}
