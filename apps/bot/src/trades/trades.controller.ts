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
  CreateTradeResponse,
  DeleteTradeResponse,
  GetTradeResponse,
  GetTradesResponse,
  Item,
  TradeOfferExchangeDetails,
  TRADES_BASE_URL,
  TRADES_PATH,
  TRADE_ACCEPT_PATH,
  TRADE_CONFIRMATION_PATH,
  TRADE_EXCHANGE_DETAILS_PATH,
  TRADE_PATH,
  TRADE_RECEIVED_ITEMS_PATH,
} from '@tf2-automatic/bot-data';
import { CreateTradeDto } from './dto/create-trade.dto';
import { GetTradesDto } from './dto/get-trades.dto';
import { TradesService } from './trades.service';

@Controller(TRADES_BASE_URL)
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Get(TRADES_PATH)
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

  @Get(TRADE_PATH)
  getTrade(@Param('id') id: string): Promise<GetTradeResponse> {
    return this.tradesService.getTrade(id);
  }

  @Post(TRADES_PATH)
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

  @Delete(TRADE_PATH)
  async removeTrade(@Param('id') id: string): Promise<DeleteTradeResponse> {
    return this.tradesService.removeTrade(id);
  }

  @Post(TRADE_ACCEPT_PATH)
  @HttpCode(HttpStatus.OK)
  acceptTrade(@Param('id') id: string): Promise<AcceptTradeResponse> {
    return this.tradesService.acceptTrade(id);
  }

  @Post(TRADE_CONFIRMATION_PATH)
  @HttpCode(HttpStatus.OK)
  acceptConfirmation(
    @Param('id') id: string
  ): Promise<AcceptConfirmationResponse> {
    return this.tradesService.acceptConfirmation(id).then(() => {
      return { success: true };
    });
  }

  @Get(TRADE_EXCHANGE_DETAILS_PATH)
  getExchangeDetails(
    @Param('id') id: string
  ): Promise<TradeOfferExchangeDetails> {
    return this.tradesService.getExchangeDetails(id);
  }

  @Get(TRADE_RECEIVED_ITEMS_PATH)
  getReceivedItems(@Param('id') id: string): Promise<Item[]> {
    return this.tradesService.getReceivedItems(id);
  }
}
