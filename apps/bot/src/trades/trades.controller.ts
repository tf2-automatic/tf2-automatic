import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import {
  GetTradesDto,
  TRADES_BASE_URL,
  TRADES_GET_TRADES,
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
  ) {
    return this.tradesService.getTrades(dto);
  }
}
