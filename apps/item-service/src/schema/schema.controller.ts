import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { SchemaService } from './schema.service';
import {
  AttachedParticle,
  AttachedParticleModel,
  PaintKit,
  PaintKitModel,
  Quality,
  QualityModel,
  SchemaRefreshDto,
  SCHEMA_BASE_PATH,
  SCHEMA_ITEM_DEFINDEX_PATH,
  SCHEMA_ITEMS_GAME_PATH,
  SCHEMA_ITEMS_PATH,
  SCHEMA_OVERVIEW_PATH,
  SCHEMA_PATH,
  SCHEMA_REFRESH_PATH,
  SchemaItem,
  SchemaModel,
  SchemaRefreshAction,
  Spell,
  SpellModel,
  UpdateSchemaResponse,
  SCHEMA_BY_TIME_PATH,
  SCHEMA_ITEMS_SEARCH_PATH,
  SCHEMA_QUALITY_PATH,
  SCHEMA_EFFECT_PATH,
  SCHEMA_PAINTKIT_PATH,
  SCHEMA_SPELL_PATH,
  ItemsGameItem,
  SCHEMA_STRANGE_PART_PATH,
  StrangePart,
  StrangePartModel,
  Paint,
  SCHEMA_PAINT_PATH,
  PaintModel,
} from '@tf2-automatic/item-service-data';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiQuerySchemaTime } from '@tf2-automatic/swagger';
import { Response } from 'express';
import {
  CursorPaginationDto,
  SchemaOptionsDto,
  SchemaSearchDto,
} from '@tf2-automatic/dto';

@ApiTags('Schema')
@Controller(SCHEMA_BASE_PATH)
export class SchemaController {
  constructor(private readonly schemaService: SchemaService) {}

  @Get(SCHEMA_PATH)
  @ApiOperation({
    summary: 'Get available schemas',
    description: 'Returns a list of all the available schemas',
  })
  @ApiResponse({
    type: SchemaModel,
    isArray: true,
  })
  async getSchema() {
    return this.schemaService.getSchemas();
  }

  @Delete(SCHEMA_BY_TIME_PATH)
  @ApiOperation({
    summary: 'Delete schema',
    description: 'Deletes the schema',
  })
  @ApiParam({
    name: 'time',
    description: 'The time of the schema',
    example: Math.floor(Date.now() / 1000),
  })
  async deleteSchema(@Param('time', ParseIntPipe) time: number): Promise<void> {
    await this.schemaService.deleteSchema(time);
  }

  @Post(SCHEMA_REFRESH_PATH)
  @ApiOperation({
    summary: 'Update schema',
    description:
      'Enqueues a job to check if the schema needs to be updated and updates the schema if it does.',
  })
  @ApiQuery({
    name: 'action',
    description: 'The action to take',
    example: SchemaRefreshAction.CHECK,
    enum: Object.values(SchemaRefreshAction),
    required: false,
  })
  @HttpCode(HttpStatus.OK)
  async updateSchema(
    @Query() dto: SchemaRefreshDto,
  ): Promise<UpdateSchemaResponse> {
    const enqueued = await this.schemaService.createJobs(dto.action);
    return {
      enqueued,
    };
  }

  @Get(SCHEMA_ITEMS_GAME_PATH)
  @ApiOperation({
    summary: 'Get items game',
    description: 'Redirects the request to download the items_game.txt file',
  })
  @ApiQuerySchemaTime()
  async getItemsGame(@Query() options: SchemaOptionsDto, @Res() res: Response) {
    const url = await this.schemaService.getSchemaItemsGameUrlByTime(
      options.time,
    );
    res.redirect(url);
  }

  @Get(SCHEMA_OVERVIEW_PATH)
  @ApiOperation({
    summary: 'Get schema overview',
    description: 'Redirects the request to download the schema overview',
  })
  @ApiQuerySchemaTime()
  async getSchemaOverview(
    @Query() options: SchemaOptionsDto,
    @Res() res: Response,
  ) {
    const url = await this.schemaService.getSchemaOverviewUrlByTime(
      options.time,
    );
    res.redirect(url);
  }

  @Get(SCHEMA_ITEMS_PATH)
  @ApiOperation({
    summary: 'Get schema items paginated',
    description: 'Returns schema items paginated using a cursor and count',
  })
  @ApiQuery({
    name: 'cursor',
    description: 'The cursor to use, defaults to 0.',
    type: 'integer',
    required: false,
  })
  @ApiQuery({
    name: 'count',
    description: 'The number of items to return, defaults to 1000.',
    type: 'integer',
    required: false,
  })
  @ApiQuery({
    name: 'items_game',
    description:
      'If the items should be fetched from the schema or items_game.txt, defaults to false.',
    type: 'boolean',
    required: false,
  })
  @ApiQuerySchemaTime()
  async getItems(
    @Query() pagination: CursorPaginationDto,
    @Query() options: SchemaOptionsDto,
  ) {
    return this.schemaService.getItems(
      pagination.cursor,
      pagination.count,
      options.time,
      options.items_game,
    );
  }

  @Get(SCHEMA_ITEMS_SEARCH_PATH)
  @ApiOperation({
    summary: 'Search for schema items',
    description: 'Returns schema items that match the given query',
  })
  @ApiQuery({
    name: 'name',
    description: 'The name of the item',
    example: 'Mann Co. Supply Crate Key',
    required: true,
  })
  @ApiQuery({
    name: 'items_game',
    description:
      'If the items should be fetched from the schema or items_game.txt, defaults to false.',
    type: 'boolean',
    required: false,
  })
  @ApiQuerySchemaTime()
  async getSchemaItemsBySearch(
    @Query() dto: SchemaSearchDto,
    @Query() options: SchemaOptionsDto,
  ): Promise<SchemaItem[] | ItemsGameItem[]> {
    return this.schemaService.getItemsByName(
      dto.name,
      options.items_game,
      options.time,
    );
  }

  @Get(SCHEMA_ITEM_DEFINDEX_PATH)
  @ApiOperation({
    summary: 'Get schema item by defindex',
    description: 'Returns a schema item by its defindex',
  })
  @ApiParam({
    name: 'defindex',
    description: 'The defindex of the item',
    example: '5021',
  })
  @ApiQuery({
    name: 'items_game',
    description:
      'If the items should be fetched from the schema or items_game.txt, defaults to false.',
    type: 'boolean',
    required: false,
  })
  @ApiQuerySchemaTime()
  async getSchemaItemByDefindex(
    @Param('defindex') defindex: string,
    @Query() options: SchemaOptionsDto,
  ): Promise<SchemaItem | ItemsGameItem> {
    return this.schemaService.getItemByDefindex(
      defindex,
      options.items_game,
      options.time,
    );
  }

  @Get(SCHEMA_QUALITY_PATH)
  @ApiOperation({
    summary: 'Get schema quality by id or name',
    description: 'Returns a schema quality',
  })
  @ApiParam({
    name: 'idOrName',
    description: 'The id or name of the quality',
    example: 'Unique',
  })
  @ApiQuerySchemaTime()
  @ApiResponse({
    type: QualityModel,
  })
  async getQuality(
    @Param('idOrName') idOrName: string,
    @Query() options: SchemaOptionsDto,
  ): Promise<Quality> {
    if (Number.isInteger(Number(idOrName))) {
      return this.schemaService.getQualityById(idOrName, options.time);
    } else {
      return this.schemaService.getQualityByName(idOrName, options.time);
    }
  }

  @Get(SCHEMA_EFFECT_PATH)
  @ApiOperation({
    summary: 'Get schema effect by id or name',
    description: 'Returns a schema effect',
  })
  @ApiParam({
    name: 'idOrName',
    description: 'The id or name of the effect',
    example: 'Burning Flames',
  })
  @ApiQuerySchemaTime()
  @ApiResponse({
    type: AttachedParticleModel,
  })
  async getEffect(
    @Param('idOrName') idOrName: string,
    @Query() options: SchemaOptionsDto,
  ): Promise<AttachedParticle> {
    if (Number.isInteger(Number(idOrName))) {
      return this.schemaService.getEffectById(idOrName, options.time);
    } else {
      return this.schemaService.getEffectByName(idOrName, options.time);
    }
  }

  @Get(SCHEMA_PAINTKIT_PATH)
  @ApiOperation({
    summary: 'Get paint kit by id or name',
    description: 'Returns a paint kit',
  })
  @ApiParam({
    name: 'idOrName',
    description: 'The id or name of the paint kit',
    example: 'Night Owl',
  })
  @ApiQuerySchemaTime()
  @ApiResponse({
    type: PaintKitModel,
  })
  async getPaintkit(
    @Param('idOrName') idOrName: string,
    @Query() options: SchemaOptionsDto,
  ): Promise<PaintKit> {
    if (Number.isInteger(Number(idOrName))) {
      return this.schemaService.getPaintKitById(idOrName, options.time);
    } else {
      return this.schemaService.getPaintKitByName(idOrName, options.time);
    }
  }

  @Get(SCHEMA_SPELL_PATH)
  @ApiOperation({
    summary: 'Get spell by id or name',
    description: 'Returns a spell',
  })
  @ApiParam({
    name: 'idOrName',
    description: 'The id or name of the spell',
    example: 'Exorcism',
  })
  @ApiQuerySchemaTime()
  @ApiResponse({
    type: SpellModel,
  })
  getSpell(
    @Param('idOrName') idOrName: string,
    @Query() options: SchemaOptionsDto,
  ): Promise<Spell> {
    if (Number.isInteger(Number(idOrName))) {
      return this.schemaService.getSpellById(idOrName, options.time);
    } else {
      return this.schemaService.getSpellByName(idOrName, options.time);
    }
  }

  @Get(SCHEMA_STRANGE_PART_PATH)
  @ApiOperation({
    summary: 'Get strange part by id or name',
    description: 'Returns a strange part',
  })
  @ApiParam({
    name: 'idOrName',
    description: 'The id or name of the strange part',
    example: 'Kills Under A Full Moon',
  })
  @ApiQuerySchemaTime()
  @ApiResponse({
    type: StrangePartModel,
  })
  getStrangePart(
    @Param('idOrName') idOrName: string,
    @Query() options: SchemaOptionsDto,
  ): Promise<StrangePart> {
    if (Number.isInteger(Number(idOrName))) {
      return this.schemaService.getStrangePartByScoreType(
        idOrName,
        options.time,
      );
    } else {
      return this.schemaService.getStrangePartByScoreTypeName(
        idOrName,
        options.time,
      );
    }
  }

  @Get(SCHEMA_PAINT_PATH)
  @ApiOperation({
    summary: 'Get paint by color',
    description: 'Returns a paint',
  })
  @ApiParam({
    name: 'color',
    description: 'The color of the paint',
    example: 'e7b53b',
  })
  @ApiQuerySchemaTime()
  @ApiResponse({
    type: PaintModel,
  })
  getPaint(
    @Param('color') color: string,
    @Query() options: SchemaOptionsDto,
  ): Promise<Paint> {
    return this.schemaService.getPaintByColor(
      color.toLowerCase(),
      options.time,
    );
  }
}
