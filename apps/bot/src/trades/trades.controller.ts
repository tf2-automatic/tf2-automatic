import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import {
  CreateTradeDto,
  CreateTradeResponse,
  DeleteTradeResponse,
  GetTradeResponse,
  GetTradesDto,
  GetTradesResponse,
  TRADES_BASE_URL,
  TRADES_CREATE_TRADE,
  TRADES_GET_TRADE,
  TRADES_GET_TRADES,
  TRADES_REMOVE_TRADE,
} from '@tf2-automatic/bot-data';
import { TradesService } from './trades.service';

@Controller(TRADES_BASE_URL)
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Get(TRADES_GET_TRADES)
  getTrades(
    @Query(
      new ValidationPipe({
        transform: true,
      })
    )
    dto: GetTradesDto
  ): Promise<GetTradesResponse> {
    return this.tradesService.getTrades(dto);
  }

  @Get(TRADES_GET_TRADE)
  getTrade(@Param('id') id: string): Promise<GetTradeResponse> {
    return this.tradesService.getTrade(id);
  }

  @Post(TRADES_CREATE_TRADE)
  async createTrade(
    @Body(
      new ValidationPipe({
        transform: true,
      })
    )
    dto: CreateTradeDto
  ): Promise<CreateTradeResponse> {
    return this.tradesService.createTrade(dto);
  }

  @Delete(TRADES_REMOVE_TRADE)
  async removeTrade(@Param('id') id: string): Promise<DeleteTradeResponse> {
    return this.tradesService.removeTrade(id);
  }
}
