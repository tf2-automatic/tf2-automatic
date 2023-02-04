import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  ValidationPipe,
  HttpCode,
  Param,
  HttpStatus,
} from '@nestjs/common';
import {
  TF2Account,
  CraftDto,
  CraftResult,
  TF2_BASE_URL,
  TF2_CRAFT,
  TF2_DELETE_ITEM,
  TF2_GET_ACCOUNT,
  TF2_USE_ITEM,
} from '@tf2-automatic/bot-data';
import { TF2Service } from './tf2.service';

@Controller(TF2_BASE_URL)
export class TF2Controller {
  constructor(private readonly tf2Service: TF2Service) {}

  @Get(TF2_GET_ACCOUNT)
  getAccount(): Promise<TF2Account> {
    return this.tf2Service.getAccount();
  }

  @Post(TF2_CRAFT)
  @HttpCode(HttpStatus.OK)
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

  @Post(TF2_USE_ITEM)
  @HttpCode(HttpStatus.OK)
  useItem(@Param('id') assetid: string): Promise<{
    success: boolean;
  }> {
    return this.tf2Service.useItem(assetid).then(() => {
      return {
        success: true,
      };
    });
  }

  @Delete(TF2_DELETE_ITEM)
  deleteItem(@Param('id') assetid: string): Promise<any> {
    return this.tf2Service.deleteItem(assetid).then(() => {
      return {
        success: true,
      };
    });
  }
}
