import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Config } from './common/config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService: ConfigService<Config> = app.get(ConfigService);

  app.enableShutdownHooks();

  const port = configService.getOrThrow<number>('port');

  await app.listen(port);

  Logger.log(`Application is running on: http://localhost:${port}/`);
}

bootstrap();
