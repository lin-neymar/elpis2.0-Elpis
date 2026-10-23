import { DynamicModule, INestApplication, Module } from '@nestjs/common';
import { loadBusinessModules } from './common/load-business-modules';
import { applyStaticAssets } from './common/middleware/static.middleware';
import { ExtendModule } from './extend/extend.module';
import { FallbackModule } from './modules/fallback/fallback.module';
import { ProjectModule } from './modules/project/project.module';
import { ViewModule } from './modules/view/view.module';

@Module({})
export class ElpisModule {
  static register(): DynamicModule {
    return {
      module: ElpisModule,
      imports: [
        ExtendModule,
        ProjectModule,
        ViewModule,
        ...loadBusinessModules(),
        FallbackModule,
      ],
      exports: [ExtendModule],
    };
  }

  static configureStatic(app: INestApplication) {
    applyStaticAssets(app);
  }
}
