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
  TRADE_CONFIRMED_PATH,
  TRADE_ACCEPTED_PATH,
  CheckAcceptedResponse,
  TRADE_DELETED_PATH,
  CheckDeletedResponse,
} from '@tf2-automatic/bot-data';
import {
  ItemModel,
  ApiParamOfferID,
  DetailsModel,
  TradesModel,
  TradeWithItemsModel,
  TradeWithAssetsModel,
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
    type: TradeWithItemsModel,
  })
  @ApiNotFoundResponse({
    description: 'Trade offer not found',
  })
  getTrade(
    @Param('id') id: string,
    @Query('useCache') useCache: boolean,
  ): Promise<GetTradeResponse> {
    return this.tradesService.getTrade(id, useCache);
  }

  @Post(TRADE_REFRESH_PATH)
  @ApiOperation({
    summary: 'Refresh trade',
    description:
      'Gets a trade by id and publishes it, even if the state is the same',
  })
  @ApiParamOfferID()
  @ApiOkResponse({
    type: TradeWithItemsModel,
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
    type: TradeWithAssetsModel,
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
    type: TradeWithAssetsModel,
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
    type: TradeWithItemsModel,
  })
  @ApiNotFoundResponse({
    description: 'Trade offer not found',
  })
  async removeTrade(@Param('id') id: string): Promise<DeleteTradeResponse> {
    return this.tradesService.removeTrade(id);
  }

  @Get(TRADE_DELETED_PATH)
  @ApiOperation({
    summary: 'Check if trade is canceled / declined',
    description: 'Checks if a trade has already been canceled / declined',
  })
  @ApiParamOfferID()
  async checkRemoved(@Param('id') id: string): Promise<CheckDeletedResponse> {
    return this.tradesService.checkRemoved(id).then((deleted) => {
      return { deleted };
    });
  }

  @Post(TRADE_ACCEPT_PATH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept trade',
    description: 'Accept a trade by id',
  })
  @ApiParamOfferID()
  @ApiOkResponse({
    type: TradeWithItemsModel,
  })
  @ApiNotFoundResponse({
    description: 'Trade offer not found',
  })
  acceptTrade(@Param('id') id: string): Promise<AcceptTradeResponse> {
    return this.tradesService.acceptTrade(id);
  }

  @Get(TRADE_ACCEPTED_PATH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check if trade is accepted',
    description: 'Checks if a trade has already been accepted',
  })
  @ApiParamOfferID()
  async checkAccepted(@Param('id') id: string): Promise<CheckAcceptedResponse> {
    return this.tradesService.checkAccepted(id).then((accepted) => {
      return { accepted };
    });
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

  @Get(TRADE_CONFIRMED_PATH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check if trade is confirmed',
    description: 'Checks if a trade offer has already been confirmed',
  })
  checkConfirmed(@Param('id') id: string): Promise<{ confirmed: boolean }> {
    return this.tradesService.checkConfirmed(id).then((confirmed) => {
      return { confirmed };
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
