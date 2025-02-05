import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  ValidationPipe,
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
  SCHEMA_EFFECT_ID_PATH,
  SCHEMA_EFFECT_NAME_PATH,
  SCHEMA_ITEM_DEFINDEX_PATH,
  SCHEMA_ITEM_NAME_PATH,
  SCHEMA_ITEMS_GAME_PATH,
  SCHEMA_ITEMS_PATH,
  SCHEMA_OVERVIEW_PATH,
  SCHEMA_PAINTKIT_ID_PATH,
  SCHEMA_PAINTKIT_NAME_PATH,
  SCHEMA_PATH,
  SCHEMA_QUALITY_ID_PATH,
  SCHEMA_QUALITY_NAME_PATH,
  SCHEMA_REFRESH_PATH,
  SCHEMA_SPELL_ID_PATH,
  SCHEMA_SPELL_NAME_PATH,
  SchemaItem,
  SchemaItemModel,
  SchemaItemsResponse,
  SchemaModel,
  SchemaRefreshAction,
  Spell,
  SpellModel,
  UpdateSchemaResponse,
} from '@tf2-automatic/item-service-data';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiQuerySchemaTime } from '@tf2-automatic/swagger';

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
    @Query(new ValidationPipe({ transform: true })) dto: SchemaRefreshDto,
  ): Promise<UpdateSchemaResponse> {
    const enqueued = await this.schemaService.createJobs(dto.action);
    return {
      enqueued,
    };
  }

  @Get(SCHEMA_ITEMS_GAME_PATH)
  @ApiOperation({
    summary: 'Get items game',
    description: 'Returns the items game',
  })
  @ApiQuerySchemaTime()
  async getItemsGame(
    @Query('time', new ParseIntPipe({ optional: true })) time?: number,
  ) {
    return this.schemaService.getSchemaItemsGameByTime(time);
  }

  @Get(SCHEMA_OVERVIEW_PATH)
  @ApiOperation({
    summary: 'Get schema overview',
    description: 'Returns an overview of the schema',
  })
  @ApiQuerySchemaTime()
  async getSchemaOverview(
    @Query('time', new ParseIntPipe({ optional: true })) time?: number,
  ) {
    return this.schemaService.getSchemaOverviewByTime(time);
  }

  @Get(SCHEMA_ITEMS_PATH)
  @ApiOperation({
    summary: 'Get schema items paginated',
    description: 'Returns schema items paginated using a cursor and count',
  })
  @ApiResponse({
    type: SchemaItemsResponse,
  })
  @ApiQuery({
    name: 'cursor',
    description: 'The cursor to use, defaults to 0.',
    required: false,
  })
  @ApiQuery({
    name: 'count',
    description: 'The number of items to return, defaults to 1000.',
    required: false,
  })
  @ApiQuerySchemaTime()
  async getItems(
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor = 0,
    @Query('count', new ParseIntPipe({ optional: true })) count = 1000,
    @Query('time', new ParseIntPipe({ optional: true })) time?: number,
  ): Promise<SchemaItemsResponse> {
    return this.schemaService.getItems(cursor, count, time);
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
  @ApiQuerySchemaTime()
  @ApiResponse({
    type: SchemaItemModel,
  })
  async getSchemaItemByDefinedx(
    @Param('defindex') defindex: string,
    @Query('time', new ParseIntPipe({ optional: true })) time?: number,
  ): Promise<SchemaItem> {
    return this.schemaService.getItemByDefindex(defindex, time);
  }

  @Get(SCHEMA_ITEM_NAME_PATH)
  @ApiOperation({
    summary: 'Get schema item(s) by name',
    description: 'Returns schema items that match the name provide',
  })
  @ApiParam({
    name: 'name',
    description: 'The name of the item',
    example: 'Mann Co. Supply Crate Key',
  })
  @ApiQuerySchemaTime()
  @ApiResponse({
    type: SchemaItemModel,
    isArray: true,
  })
  async getSchemaItemsByName(
    @Param('name') name: string,
    @Query('time', new ParseIntPipe({ optional: true })) time?: number,
  ): Promise<SchemaItem[]> {
    return this.schemaService.getItemsByName(name, time);
  }

  @Get(SCHEMA_QUALITY_NAME_PATH)
  @ApiOperation({
    summary: 'Get schema quality by name',
    description: 'Returns a schema quality',
  })
  @ApiParam({
    name: 'name',
    description: 'The name of the quality',
    example: 'Unique',
  })
  @ApiQuerySchemaTime()
  @ApiResponse({
    type: QualityModel,
  })
  async getSchemaQualitiesByName(
    @Param('name') name: string,
    @Query('time', new ParseIntPipe({ optional: true })) time?: number,
  ): Promise<Quality> {
    return this.schemaService.getQualityByName(name, time);
  }

  @Get(SCHEMA_QUALITY_ID_PATH)
  @ApiOperation({
    summary: 'Get schema quality by id',
    description: 'Returns a schema quality',
  })
  @ApiParam({
    name: 'id',
    description: 'The id of the quality',
    example: '6',
  })
  @ApiQuerySchemaTime()
  @ApiResponse({
    type: QualityModel,
  })
  async getSchemaQualitiesById(
    @Param('id') id: string,

    @Query('time', new ParseIntPipe({ optional: true })) time?: number,
  ): Promise<Quality> {
    return this.schemaService.getQualityById(id, time);
  }

  @Get(SCHEMA_EFFECT_NAME_PATH)
  @ApiOperation({
    summary: 'Get schema effect by name',
    description: 'Returns a schema effect',
  })
  @ApiParam({
    name: 'name',
    description: 'The name of the effect',
    example: 'Burning Flames',
  })
  @ApiQuerySchemaTime()
  @ApiResponse({
    type: AttachedParticleModel,
  })
  async getSchemaEffectsByName(
    @Param('name') name: string,
    @Query('time', new ParseIntPipe({ optional: true })) time?: number,
  ): Promise<AttachedParticle> {
    return this.schemaService.getEffectByName(name, time);
  }

  @Get(SCHEMA_EFFECT_ID_PATH)
  @ApiOperation({
    summary: 'Get schema effect by id',
    description: 'Returns a schema effect',
  })
  @ApiParam({
    name: 'id',
    description: 'The id of the effect',
    example: '13',
  })
  @ApiQuerySchemaTime()
  @ApiResponse({
    type: AttachedParticleModel,
  })
  async getSchemaEffectsById(
    @Param('id') id: string,
    @Query('time', new ParseIntPipe({ optional: true })) time?: number,
  ): Promise<AttachedParticle> {
    return this.schemaService.getEffectById(id, time);
  }

  @Get(SCHEMA_PAINTKIT_NAME_PATH)
  @ApiOperation({
    summary: 'Get paint kit by name',
    description: 'Returns a paint kit',
  })
  @ApiParam({
    name: 'name',
    description: 'The name of the paint kit',
    example: 'Night Owl',
  })
  @ApiQuerySchemaTime()
  @ApiResponse({
    type: PaintKitModel,
  })
  async getSchemaPaintkitsByName(
    @Param('name') name: string,
    @Query('time', new ParseIntPipe({ optional: true })) time?: number,
  ): Promise<PaintKit> {
    return this.schemaService.getPaintKitByName(name, time);
  }

  @Get(SCHEMA_PAINTKIT_ID_PATH)
  @ApiOperation({
    summary: 'Get paint kit by id',
    description: 'Returns a paint kit',
  })
  @ApiParam({
    name: 'id',
    description: 'The id of the paint kit',
    example: '14',
  })
  @ApiQuerySchemaTime()
  @ApiResponse({
    type: PaintKitModel,
  })
  async getSchemaPaintkitsById(
    @Param('id') id: string,
    @Query('time', new ParseIntPipe({ optional: true })) time?: number,
  ): Promise<PaintKit> {
    return this.schemaService.getPaintKitById(id, time);
  }

  @Get(SCHEMA_SPELL_NAME_PATH)
  @ApiOperation({
    summary: 'Get spell by name',
    description: 'Returns a spell',
  })
  @ApiParam({
    name: 'name',
    description: 'The name of the spell',
    example: 'Exorcism',
  })
  @ApiQuerySchemaTime()
  @ApiResponse({
    type: SpellModel,
  })
  getSpellByName(
    @Param('name') name: string,
    @Query('time', new ParseIntPipe({ optional: true })) time?: number,
  ): Promise<Spell> {
    return this.schemaService.getSpellByName(name, time);
  }

  @Get(SCHEMA_SPELL_ID_PATH)
  @ApiOperation({
    summary: 'Get spell by id',
    description: 'Returns a spell',
  })
  @ApiParam({
    name: 'id',
    description: 'The id of the spell',
    example: '1009',
  })
  @ApiQuerySchemaTime()
  @ApiResponse({
    type: SpellModel,
  })
  getSpellById(
    @Param('id') id: string,

    @Query('time', new ParseIntPipe({ optional: true })) time?: number,
  ): Promise<Spell> {
    return this.schemaService.getSpellById(id, time);
  }
}
