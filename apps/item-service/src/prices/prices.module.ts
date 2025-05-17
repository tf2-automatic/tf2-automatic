import { Module } from '@nestjs/common';
import { PricesService } from './prices.service';
import { PricesController } from './prices.controller';
import { SchemaModule } from '../schema/schema.module';

@Module({
  imports: [SchemaModule],
  providers: [PricesService],
  controllers: [PricesController],
})
export class PricesModule {}
