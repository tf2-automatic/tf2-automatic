import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotModule } from './bot/bot.module';
import configuration from './common/config/configuration';
import { validation } from './common/config/validation';
import { NestStorageModule } from '@tf2-automatic/nestjs-storage';
import { HealthModule } from './health/health.module';
import { FriendsModule } from './friends/friends.module';
import { InventoriesModule } from './inventories/inventories.module';
import { TF2Module } from './tf2/tf2.module';
import { TradesModule } from './trades/trades.module';
import { ProfileModule } from './profile/profile.module';
import { EventsModule } from './events/events.module';
import { MetadataModule } from './metadata/metadata.module';
import { EscrowModule } from './escrow/escrow.module';
import { ShutdownModule } from './shutdown/shutdown.module';
import { ManagerModule } from './manager/manager.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { getStorageConfig, getUserAgent } from '@tf2-automatic/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  IdempotencyInterceptor,
  UserAgentInterceptor,
} from '@tf2-automatic/nestjs';
import { HttpModule } from '@nestjs/axios';
import { ClsModule } from 'nestjs-cls';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: UserAgentInterceptor,
    },
  ],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      ignoreEnvFile: true,
      load: [configuration],
      validationSchema: validation,
    }),
    PrometheusModule.register({
      global: true,
    }),
    EventEmitterModule.forRoot(),
    BotModule,
    NestStorageModule.register(getStorageConfig()),
    HealthModule,
    FriendsModule,
    InventoriesModule,
    TF2Module,
    TradesModule,
    ProfileModule,
    EventsModule,
    MetadataModule,
    EscrowModule,
    ShutdownModule,
    ManagerModule,
    HttpModule.registerAsync({
      global: true,
      useFactory: () => {
        const headers: Record<string, string> = {};

        const agent = getUserAgent();
        if (agent) {
          headers['User-Agent'] = agent;
        }

        return {
          headers,
        };
      },
    }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
  ],
})
export class AppModule {}
