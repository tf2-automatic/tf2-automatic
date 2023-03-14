import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration, {
  Config,
  RedisConfig,
} from './common/config/configuration';
import { validation } from './common/config/validation';
import { BotsModule } from './bots/bots.module';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { HealthModule } from './health/health.module';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { HeartbeatsModule } from './heartbeats/heartbeats.module';
import { InventoriesModule } from './inventories/inventories.module';
import { EventsModule } from './events/events.module';
import { BullModule } from '@nestjs/bullmq';
import { TradesModule } from './trades/trades.module';
import { EscrowModule } from './escrow/escrow.module';

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
            keyPrefix: redisConfig.keyPrefix,
          },
        };
      },
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Config>) => {
        const redisConfig = configService.getOrThrow<RedisConfig>('redis');
        return {
          prefix: redisConfig.keyPrefix,
          connection: {
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            db: redisConfig.db,
          },
        };
      },
    }),
    PrometheusModule.register(),
    EventsModule,
    HealthModule,
    HeartbeatsModule,
    BotsModule,
    InventoriesModule,
    TradesModule,
    EscrowModule,
  ],
})
export class AppModule {}
