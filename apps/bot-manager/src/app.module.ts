import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration, {
  Config,
  RedisConfig,
} from './common/config/configuration';
import { validation } from './common/config/validation';
import { BotsModule } from './bots/bots.module';
import { RedisModule } from '@liaoliaots/nestjs-redis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      ignoreEnvFile: true,
      load: [configuration],
      validationSchema: validation,
    }),
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Config>) => {
        const redisConfig = configService.getOrThrow<RedisConfig>('redis');
        return {
          readyLog: true,
          config: {
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            db: redisConfig.db,
          },
        };
      },
    }),
    BotsModule,
  ],
})
export class AppModule {}
