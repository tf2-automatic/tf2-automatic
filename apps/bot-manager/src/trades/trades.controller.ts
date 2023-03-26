import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ValidationPipe,
} from '@nestjs/common';
import { Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  QueueTradeResponse,
  TRADES_BASE_URL,
  TRADES_PATH,
  TRADE_PATH,
} from '@tf2-automatic/bot-manager-data';
import { QueueTradeDto } from '@tf2-automatic/dto';
import { TradesService } from './trades.service';

@ApiTags('Trades')
@Controller(TRADES_BASE_URL)
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Post(TRADES_PATH)
  @ApiOperation({
    summary: 'Enqueue trade',
    description: 'Adds a new trade in the queue',
  })
  enqueueTrade(
    @Body(new ValidationPipe()) trade: QueueTradeDto
  ): Promise<QueueTradeResponse> {
    return this.tradesService.enqueueTrade(trade);
  }

  @Delete(TRADE_PATH)
  @ApiOperation({
    summary: 'Dequeue trade',
    description: 'Removes a trade from the queue',
  })
  getQueuedTrade(@Param('id') id: string) {
    return this.tradesService.dequeueTrade(id).then((deleted) => {
      return {
        deleted,
      };
    });
  }

  @Get(TRADES_PATH)
  @ApiOperation({
    summary: 'Get queued trades',
    description: 'Gets all queued trades',
  })
  getQueuedTrades() {
    return this.tradesService.getQueuedTrades();
  }
}
