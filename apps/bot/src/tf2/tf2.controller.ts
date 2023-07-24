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
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  TF2Account,
  CraftResult,
  TF2_BASE_URL,
  TF2_ACCOUNT_PATH,
  TF2_CRAFT_PATH,
  TF2_USE_ITEM_PATH,
  TF2_ITEM_PATH,
  TF2_SORT_PATH,
  TF2ActionResult,
  CraftRecipe,
  SortBackpackTypes,
  TF2_BACKPACK_PATH,
  TF2Item,
} from '@tf2-automatic/bot-data';
import { CraftDto, SortBackpackDto } from '@tf2-automatic/dto';
import {
  TF2AccountModel,
  CraftResultModel,
  TF2ItemModel,
} from '@tf2-automatic/swagger';
import { TF2Service } from './tf2.service';

@ApiTags('TF2')
@Controller(TF2_BASE_URL)
export class TF2Controller {
  constructor(private readonly tf2Service: TF2Service) {}

  @Get(TF2_ACCOUNT_PATH)
  @ApiOperation({
    summary: 'Get account information',
    description: 'Get information about the account',
  })
  @ApiOkResponse({
    type: TF2AccountModel,
  })
  getAccount(): Promise<TF2Account> {
    return this.tf2Service.getAccount();
  }

  @Post(TF2_CRAFT_PATH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Craft items',
    description: 'Craft items',
  })
  @ApiBody({
    type: CraftDto,
    examples: {
      'Smelt 1 refined into 3 reclaimed': {
        value: {
          recipe: CraftRecipe.SmeltRefined,
          assetids: ['1234567890'],
        },
      },
      'Combine 3 reclaimed into 1 refined': {
        value: {
          recipe: CraftRecipe.CombineReclaimed,
          assetids: ['1234567891', '1234567892', '1234567893'],
        },
      },
    },
  })
  @ApiOkResponse({
    type: CraftResultModel,
  })
  craft(
    @Body(
      new ValidationPipe({
        transform: true,
      }),
    )
    body: CraftDto,
  ): Promise<CraftResult> {
    return this.tf2Service.craft(body);
  }

  @Post(TF2_USE_ITEM_PATH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Use an item',
    description: 'Use an item',
  })
  @ApiParam({
    name: 'id',
    description: 'The assetid of the item to use',
  })
  useItem(@Param('id') assetid: string): Promise<TF2ActionResult> {
    return this.tf2Service.useItem(assetid).then(() => {
      return {
        success: true,
      };
    });
  }

  @Delete(TF2_ITEM_PATH)
  @ApiOperation({
    summary: 'Delete an item',
    description: 'Delete an item',
  })
  @ApiParam({
    name: 'id',
    description: 'The assetid of the item to delete',
  })
  deleteItem(@Param('id') assetid: string): Promise<TF2ActionResult> {
    return this.tf2Service.deleteItem(assetid).then(() => {
      return {
        success: true,
      };
    });
  }

  @Post(TF2_SORT_PATH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sort backpack',
    description: 'Sort backpack',
  })
  @ApiBody({
    type: SortBackpackDto,
    examples: {
      'Sort by quality': {
        value: {
          sort: SortBackpackTypes.Quality,
        },
      },
      'Sort by item slot': {
        value: {
          sort: SortBackpackTypes.Slot,
        },
      },
    },
  })
  sortBackpack(
    @Body(
      new ValidationPipe({
        transform: true,
      }),
    )
    body: SortBackpackDto,
  ): Promise<TF2ActionResult> {
    return this.tf2Service.sortBackpack(body).then(() => {
      return {
        success: true,
      };
    });
  }

  @Get(TF2_BACKPACK_PATH)
  @ApiOperation({
    summary: 'Get backpack',
    description: 'Get items in backpack',
  })
  @ApiOkResponse({
    type: [TF2ItemModel],
  })
  getBackpack(): TF2Item[] {
    return this.tf2Service.getBackpack();
  }
}
