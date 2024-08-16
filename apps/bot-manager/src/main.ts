import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Config } from './common/config/configuration';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Bot manager API Documentation')
    .setDescription('The documentation for the bot manager API')
    .setVersion('current')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const configService: ConfigService<Config> = app.get(ConfigService);

  app.enableShutdownHooks();

  const server = app.getHttpServer();
  server.keepAliveTimeout =
    configService.getOrThrow<number>('keepAliveTimeout');

  const port = configService.getOrThrow<number>('port');

  await app.listen(port);

  Logger.log(`Application is running on: http://localhost:${port}/`);
}

bootstrap();
