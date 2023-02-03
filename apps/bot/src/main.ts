import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Config } from './common/config/configuration';
import { BotService } from './bot/bot.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.DEBUG === 'true'
        ? ['log', 'debug', 'error', 'verbose', 'warn']
        : ['log', 'warn', 'error'],
  });
  const configService: ConfigService<Config> = app.get(ConfigService);
  const botService: BotService = app.get(BotService);

  app.enableShutdownHooks();

  const port = configService.getOrThrow<number>('port');

  await app.init();

  // Start bot after everything else to make sure events will be caught and handled properly
  try {
    await botService.start();
  } catch (err) {
    Logger.error('Failed to start bot: ' + err.message);
    Logger.debug(err);
    return app.close();
  }

  await app.listen(port);

  Logger.log(`Application is running on: http://localhost:${port}/`);
}

bootstrap();
