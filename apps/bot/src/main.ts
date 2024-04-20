import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Config } from './common/config/configuration';
import { BotService } from './bot/bot.service';
import { ShutdownService } from './shutdown/shutdown.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger:
      process.env.DEBUG === 'true'
        ? ['log', 'debug', 'error', 'verbose', 'warn']
        : ['log', 'warn', 'error'],
  });

  const config = new DocumentBuilder()
    .setTitle('Bot API Documentation')
    .setDescription('The documentation for the bot API')
    .setVersion('current')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const configService: ConfigService<Config> = app.get(ConfigService);
  const botService: BotService = app.get(BotService);

  app.enableShutdownHooks();

  const port = configService.getOrThrow<number>('port');

  // Subscribe to shutdown event
  app.get(ShutdownService).subscribeToShutdown(() => app.close());

  try {
    await app.init();
  } catch (err) {
    Logger.error('Failed to initialize application');
    console.error(err);
    await app.close();
    process.exit(1);
  }

  // Start bot after everything else to make sure events will be caught and handled properly
  try {
    await botService.start();
  } catch (err) {
    Logger.error('Failed to start bot');
    console.error(err);
    await app.close();
    process.exit(1);
  }

  await app.listen(port);

  Logger.log(`Application is running on: http://localhost:${port}/`);
}

bootstrap();
