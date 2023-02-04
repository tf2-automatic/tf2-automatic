import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  ValidationPipe,
  HttpCode,
  Param,
} from '@nestjs/common';
import {
  TF2Account,
  tf2BaseUrl,
  getTF2Account,
  craftTF2Items,
  CraftDto,
  CraftResult,
  useTF2Item,
  deleteTF2Item,
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

  @Post(useTF2Item)
  @HttpCode(200)
  useItem(@Param('id') assetid: string): Promise<{
    success: boolean;
  }> {
    return this.tf2Service.useItem(assetid).then(() => {
      return {
        success: true,
      };
    });
  }

  @Delete(deleteTF2Item)
  deleteItem(@Param('id') assetid: string): Promise<any> {
    return this.tf2Service.deleteItem(assetid).then(() => {
      return {
        success: true,
      };
    });
  }
}
