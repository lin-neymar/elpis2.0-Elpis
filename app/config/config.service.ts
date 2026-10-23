import { Inject, Injectable } from '@nestjs/common';
import { get as lodashGet } from 'lodash';
import { createRequire } from 'module';
import { join } from 'path';
import { BOOTSTRAP_OPTIONS, BootstrapOptions } from './bootstrap-options';

const nodeRequire = createRequire(__filename);

@Injectable()
export class ConfigService {
  private readonly config: Record<string, unknown>;

  constructor(
    @Inject(BOOTSTRAP_OPTIONS) private readonly options: BootstrapOptions,
  ) {
    this.config = this.mergeConfig();
    console.log('[config] loaded:', this.config);
    console.log('-- [start] load config done --');
  }

  get(key: string): unknown {
    return lodashGet(this.config, key);
  }

  getBootstrapOptions(): BootstrapOptions {
    return this.options;
  }

  getEnv(): string {
    return process.env._ENV ?? 'local';
  }

  isLocal(): boolean {
    return process.env._ENV == 'local';
  }

  isBeta(): boolean {
    return process.env._ENV == 'beta';
  }

  isProduction(): boolean {
    return process.env._ENV == 'production';
  }

  private mergeConfig(): Record<string, unknown> {
    const elpisConfigPath = join(__dirname, '..', '..', 'config');
    let defaultConfig: Record<string, unknown> = {};

    try {
      defaultConfig = {
        ...nodeRequire(join(elpisConfigPath, 'config.default.js')),
      };
    } catch {
      console.error('[exception]default.config file exception');
    }

    const businessConfigPath = join(process.cwd(), 'config');
    try {
      defaultConfig = {
        ...defaultConfig,
        ...nodeRequire(join(businessConfigPath, 'config.default.js')),
      };
    } catch {
      console.error('[exception]default.config file exception');
    }

    let envConfig: Record<string, unknown> = {};
    try {
      if (this.isLocal()) {
        envConfig = nodeRequire(join(businessConfigPath, 'config.local.js'));
      } else if (this.isBeta()) {
        envConfig = nodeRequire(join(businessConfigPath, 'config.beta.js'));
      } else if (this.isProduction()) {
        envConfig = nodeRequire(join(businessConfigPath, 'config.production.js'));
      }
    } catch {
      console.error('[exception] there is no env.config file');
    }

    const { name, homePage, ...restOptions } = this.options;
    const optionsOverlay: Record<string, unknown> = { ...restOptions };
    if (name !== undefined) {
      optionsOverlay.name = name;
    }
    if (homePage !== undefined) {
      optionsOverlay.homePage = homePage;
    }

    return Object.assign({}, defaultConfig, envConfig, optionsOverlay);
  }
}
