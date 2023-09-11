import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration, {
  Config,
  RedisConfig,
} from './common/config/configuration';
import { validation } from './common/config/validation';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { RedisModule } from '@songkeys/nestjs-redis';
import { ListingsModule } from './listings/listings.module';
import { InventoriesModule } from './inventories/inventories.module';
import { TokensModule } from './tokens/tokens.module';
import { BullModule } from '@nestjs/bullmq';
import { AgentsModule } from './agents/agents.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

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
            keyPrefix: redisConfig.keyPrefix + ':',
          },
        };
      },
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Config>) => {
        const redisConfig = configService.getOrThrow<RedisConfig>('redis');
        return {
          prefix: redisConfig.keyPrefix + ':bptf-manager:bull',
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
    EventEmitterModule.forRoot(),
    ListingsModule,
    InventoriesModule,
    TokensModule,
    AgentsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
