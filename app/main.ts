import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ElpisModule } from './elpis.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ApiSignGuard } from './common/guards/api-sign.guard';
import { createElpisValidationPipe } from './common/pipes/elpis-validation.pipe';
import { BootstrapOptions } from './config/bootstrap-options';
import { ConfigService } from './config/config.service';
import { LoggerProvider } from './extend/logger.provider';
import { ProjKeyInterceptor } from './common/interceptors/proj-key.interceptor';

async function applyElpisPipeline(app: INestApplication) {
  ElpisModule.configureStatic(app);

  // 对照 Koa 时代 cookie 中间件：AuthTokenGuard 依赖 req.cookies.token
  app.use(cookieParser());

  app.useGlobalPipes(createElpisValidationPipe());

  app.useGlobalFilters(
    new AllExceptionsFilter(
      app.get(ConfigService),
      app.get(LoggerProvider),
    ),
  );

  app.useGlobalGuards(
    new ApiSignGuard(app.get(ConfigService), app.get(LoggerProvider)),
  );

  app.useGlobalInterceptors(new ProjKeyInterceptor());
}

/** 供测试或自定义启动：装配管道，不 listen。 */
export async function createElpisApp(options: BootstrapOptions = {}) {
  const app = await NestFactory.create(AppModule.register(options));
  await applyElpisPipeline(app);
  await app.init();
  return app;
}

export async function bootstrap(options: BootstrapOptions = {}) {
  const app = await createElpisApp(options);

  const port = process.env.PORT || 8080;
  const host = process.env.IP || '0.0.0.0';

  await app.listen(port, host);
  console.log(`Server running on port:${port}`);

  return app;
}
