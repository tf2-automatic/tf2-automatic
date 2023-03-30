import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ValidationPipe,
} from '@nestjs/common';
import { Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  QueueTradeResponse,
  TRADES_BASE_URL,
  TRADE_JOBS_PATH,
  TRADE_JOB_PATH,
} from '@tf2-automatic/bot-manager-data';
import { TradeQueueJobDto } from '@tf2-automatic/dto';
import { TradesService } from './trades.service';

@ApiTags('Trades')
@Controller(TRADES_BASE_URL)
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Post(TRADE_JOBS_PATH)
  @ApiOperation({
    summary: 'Create trade job',
    description: 'Adds a new trade in the queue',
  })
  @ApiBody({
    type: TradeQueueJobDto,
    examples: {
      'Create trade': {
        value: {
          type: 'CREATE',
          data: {
            partner: '76561198120070906',
            token: '_Eq1Y3An',
            message: 'Hello, I would like to trade with you',
            itemsToGive: [
              {
                assetid: '1234567890',
                appid: 440,
                contextid: '2',
                amount: 1,
              },
            ],
            itemsToReceive: [
              {
                assetid: '1234567890',
                appid: 440,
                contextid: '2',
                amount: 1,
              },
            ],
          },
          bot: '76561198120070906',
        },
      },
      'Cancel / decline trade': {
        value: {
          type: 'DELETE',
          data: '1234567890',
          bot: '76561198120070906',
        },
      },
      'Accept trade': {
        value: {
          type: 'ACCEPT',
          data: '1234567890',
          bot: '76561198120070906',
        },
      },
    },
  })
  enqueueTrade(
    @Body(new ValidationPipe()) dto: TradeQueueJobDto
  ): Promise<QueueTradeResponse> {
    return this.tradesService.enqueueJob(dto);
  }

  @Delete(TRADE_JOB_PATH)
  @ApiOperation({
    summary: 'Remove trade job',
    description: 'Removes a job from the queue',
  })
  deleteQueueJob(@Param('id') id: string) {
    return this.tradesService.dequeueJob(id).then((deleted) => {
      return {
        deleted,
      };
    });
  }

  @Get(TRADE_JOBS_PATH)
  @ApiOperation({
    summary: 'Get queue',
    description:
      'Gets all queued trade actions (accept, decline / cancel, send, etc.)',
  })
  getQueue() {
    return this.tradesService.getQueue();
  }
}
