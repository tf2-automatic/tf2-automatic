import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotModule } from './bot/bot.module';
import configuration from './common/config/configuration';
import { validation } from './common/config/validation';
import { StorageModule } from './storage/storage.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      ignoreEnvFile: true,
      load: [configuration],
      validationSchema: validation,
    }),
    EventEmitterModule.forRoot(),
    BotModule,
    StorageModule,
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
  ],
})
export class AppModule {}
