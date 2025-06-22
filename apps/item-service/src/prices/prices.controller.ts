import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { PricesService } from './prices.service';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PricesSearchDto, SavePriceDto } from '@tf2-automatic/dto';
import {
  Price,
  PRICE_PATH,
  PRICES_BASE_PATH,
  PRICES_PATH,
} from '@tf2-automatic/item-service-data';

@ApiTags('Prices')
@Controller(PRICES_BASE_PATH)
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  @Get(PRICES_PATH)
  @ApiOperation({
    summary: 'Get prices paginated, or search for prices by name/sku/assetid',
    description: 'Returns prices paginated using a cursor and count',
  })
  @ApiQuery({
    name: 'cursor',
    description: 'The cursor to use, defaults to 0.',
    type: 'integer',
    required: false,
  })
  @ApiQuery({
    name: 'count',
    description: 'The number of items to return, defaults to 1000.',
    type: 'integer',
    required: false,
  })
  async getPrices(@Query() dto: PricesSearchDto) {
    return this.pricesService.getPrices(dto);
  }

  @Post(PRICES_PATH)
  @ApiOperation({
    summary: 'Save price',
    description: 'Save a price',
  })
  savePrice(
    @Body()
    dto: SavePriceDto,
  ): Promise<Price> {
    return this.pricesService.savePrice(dto);
  }

  @Delete(PRICE_PATH)
  @ApiOperation({
    summary: 'Delete price',
    description: 'Delete a price',
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the price to delete',
    example: 'aXRlbTqiARkTnQIG',
  })
  deletePrice(@Param('id') id: string): Promise<void> {
    return this.pricesService.deletePrice(id);
  }

  @Get(PRICE_PATH)
  @ApiOperation({
    summary: 'Get price',
    description: 'Get a price',
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the price to delete',
    example: 'aXRlbTqiARkTnQIG',
  })
  getPrice(@Param('id') id: string): Promise<Price> {
    return this.pricesService.getPrice(id);
  }
}
