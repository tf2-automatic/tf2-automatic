import { Module } from '@nestjs/common';
import { PricesService } from './prices.service';
import { PricesController } from './prices.controller';
import { SchemaModule } from '../schema/schema.module';
import { InventoriesModule } from '../inventories/inventories.module';

@Module({
  imports: [SchemaModule, InventoriesModule],
  providers: [PricesService],
  controllers: [PricesController],
})
export class PricesModule {}
