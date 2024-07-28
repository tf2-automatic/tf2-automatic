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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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
  TRADE_COUNTER_PATH,
  TRADE_REFRESH_PATH,
  RefreshTradeResponse,
} from '@tf2-automatic/bot-data';
import {
  ItemModel,
  ApiParamOfferID,
  DetailsModel,
  TradeModel,
  TradesModel,
} from '@tf2-automatic/swagger';
import { TradesService } from './trades.service';
import {
  CounterTradeDto,
  CreateTradeDto,
  GetTradesDto,
  GetExchangeDetailsDto,
} from '@tf2-automatic/dto';

@ApiTags('Trades')
@Controller(TRADES_BASE_URL)
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Get(TRADES_PATH)
  @ApiOperation({
    summary: 'Get trades',
    description: 'Get a list of trades',
  })
  @ApiOkResponse({
    type: TradesModel,
  })
  getTrades(
    @Query(
      new ValidationPipe({
        transform: true,
      }),
    )
    dto: GetTradesDto,
  ): Promise<GetTradesResponse> {
    return this.tradesService.getTrades(dto);
  }

  @Get(TRADE_PATH)
  @ApiOperation({
    summary: 'Get trade',
    description: 'Get a trade by id',
  })
  @ApiParamOfferID()
  @ApiOkResponse({
    type: TradeModel,
  })
  @ApiNotFoundResponse({
    description: 'Trade offer not found',
  })
  getTrade(@Param('id') id: string): Promise<GetTradeResponse> {
    return this.tradesService.getTrade(id);
  }

  @Post(TRADE_REFRESH_PATH)
  @ApiOperation({
    summary: 'Refresh trade',
    description:
      'Gets a trade by id and publishes it, even if the state is the same',
  })
  @ApiParamOfferID()
  @ApiOkResponse({
    type: TradeModel,
  })
  @ApiNotFoundResponse({
    description: 'Trade offer not found',
  })
  refreshTrade(@Param('id') id: string): Promise<RefreshTradeResponse> {
    return this.tradesService.refreshTrade(id);
  }

  @Post(TRADES_PATH)
  @ApiOperation({
    summary: 'Create trade',
    description: 'Create a trade',
  })
  @ApiOkResponse({
    type: TradeModel,
  })
  async createTrade(
    @Body(
      new ValidationPipe({
        transform: true,
      }),
    )
    dto: CreateTradeDto,
  ): Promise<CreateTradeResponse> {
    return this.tradesService.createTrade(dto);
  }

  @Post(TRADE_COUNTER_PATH)
  @ApiOperation({
    summary: 'Counter trade',
    description: 'Counter a trade by id',
  })
  @ApiOkResponse({
    type: TradeModel,
  })
  counterTrade(
    @Param('id') id: string,
    @Body(
      new ValidationPipe({
        transform: true,
      }),
    )
    dto: CounterTradeDto,
  ): Promise<CreateTradeResponse> {
    return this.tradesService.counterTrade(id, dto);
  }

  @Delete(TRADE_PATH)
  @ApiOperation({
    summary: 'Cancel / decline trade',
    description: 'Cancel / decline a trade by id',
  })
  @ApiParamOfferID()
  @ApiOkResponse({
    type: TradeModel,
  })
  @ApiNotFoundResponse({
    description: 'Trade offer not found',
  })
  async removeTrade(@Param('id') id: string): Promise<DeleteTradeResponse> {
    return this.tradesService.removeTrade(id);
  }

  @Post(TRADE_ACCEPT_PATH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept trade',
    description: 'Accept a trade by id',
  })
  @ApiParamOfferID()
  @ApiOkResponse({
    type: TradeModel,
  })
  @ApiNotFoundResponse({
    description: 'Trade offer not found',
  })
  acceptTrade(@Param('id') id: string): Promise<AcceptTradeResponse> {
    return this.tradesService.acceptTrade(id);
  }

  @Post(TRADE_CONFIRMATION_PATH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept confirmation',
    description: 'Accept a confirmation by id',
  })
  acceptConfirmation(
    @Param('id') id: string,
  ): Promise<AcceptConfirmationResponse> {
    return this.tradesService.acceptConfirmation(id).then(() => {
      return { success: true };
    });
  }

  @Get(TRADE_EXCHANGE_DETAILS_PATH)
  @ApiOperation({
    summary: 'Get exchange details',
    description: 'Get the exchange details of a trade by id',
  })
  @ApiParamOfferID()
  @ApiOkResponse({
    type: DetailsModel,
  })
  @ApiNotFoundResponse({
    description: 'Trade offer not found',
  })
  getExchangeDetails(
    @Param('id') id: string,
    @Query(
      new ValidationPipe({
        transform: true,
      }),
    )
    exchangeDetailsDto: GetExchangeDetailsDto,
  ): Promise<TradeOfferExchangeDetails> {
    return this.tradesService.getExchangeDetails(id, exchangeDetailsDto);
  }

  @Get(TRADE_RECEIVED_ITEMS_PATH)
  @ApiOperation({
    summary: 'Get received items',
    description: 'Get the received items of a trade by id',
  })
  @ApiParamOfferID()
  @ApiOkResponse({
    type: [ItemModel],
  })
  @ApiNotFoundResponse({
    description: 'Trade offer not found',
  })
  getReceivedItems(@Param('id') id: string): Promise<Item[]> {
    return this.tradesService.getReceivedItems(id);
  }
}
