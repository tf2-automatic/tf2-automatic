import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import {
  AcceptConfirmationResponse,
  AcceptTradeResponse,
  CreateTradeDto,
  CreateTradeResponse,
  DeleteTradeResponse,
  GetTradeResponse,
  GetTradesDto,
  GetTradesResponse,
  TRADES_ACCEPT_CONFIRMATION,
  TRADES_ACCEPT_TRADE,
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

  @Post(TRADES_ACCEPT_TRADE)
  @HttpCode(HttpStatus.OK)
  acceptTrade(@Param('id') id: string): Promise<AcceptTradeResponse> {
    return this.tradesService.acceptTrade(id);
  }

  @Post(TRADES_ACCEPT_CONFIRMATION)
  @HttpCode(HttpStatus.OK)
  acceptConfirmation(
    @Param('id') id: string
  ): Promise<AcceptConfirmationResponse> {
    return this.tradesService.acceptConfirmation(id).then(() => {
      return { success: true };
    });
  }
}
