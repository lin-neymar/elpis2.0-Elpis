import { Injectable } from '@nestjs/common';
import knex = require('knex');
import { ConfigService } from '../config/config.service';

type KnexClient = ReturnType<typeof knex>;

@Injectable()
export class DatabaseProvider {
  readonly db: KnexClient | undefined;

  constructor(private readonly configService: ConfigService) {
    const dbConfig = this.configService.get('db') as knex.Config | undefined;
    if (!dbConfig) {
      this.db = undefined;
      return;
    }

    this.db = knex({
      ...dbConfig,
      connection: {
        charset: 'utf8mb4',
        ...(dbConfig.connection as Record<string, unknown>),
      },
    });
  }
}
