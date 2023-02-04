import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  ValidationPipe,
  HttpCode,
} from '@nestjs/common';
import {
  TF2Account,
  tf2BaseUrl,
  getTF2Account,
  craftTF2Items,
  CraftDto,
  CraftResult,
} from '@tf2-automatic/bot-data';
import { TF2Service } from './tf2.service';

@Controller(tf2BaseUrl)
export class TF2Controller {
  constructor(private readonly tf2Service: TF2Service) {}

  @Get(getTF2Account)
  getAccount(): Promise<TF2Account> {
    return this.tf2Service.getAccount();
  }

  @Post(craftTF2Items)
  @HttpCode(200)
  craft(
    @Body(
      new ValidationPipe({
        transform: true,
      })
    )
    body: CraftDto
  ): Promise<CraftResult> {
    return this.tf2Service.craft(body);
  }
}
