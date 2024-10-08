import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { SchemaService } from './schema.service';
import {
  AttachedParticle,
  AttachedParticleModel,
  PaintKit,
  PaintKitModel,
  Quality,
  QualityModel,
  SchemaItem,
  SchemaItemModel,
  SchemaItemsResponse,
  UpdateSchemaResponse,
} from '@tf2-automatic/item-service-data';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Schema')
@Controller('schema')
export class SchemaController {
  constructor(private readonly schemaService: SchemaService) {}

  @Get()
  @ApiOperation({
    summary: 'Get schema metadata',
    description: 'Returns the schema metadata',
  })
  async getSchemaMetadata() {
    return this.schemaService.getSchemaMetadata();
  }

  @Post('/refresh')
  @ApiOperation({
    summary: 'Update schema',
    description: 'Enqueues a job to update the schema',
  })
  @HttpCode(HttpStatus.OK)
  async updateSchema(): Promise<UpdateSchemaResponse> {
    const enqueued = await this.schemaService.createJobsIfNotRecentlyUpdated();
    return {
      enqueued,
    };
  }

  @Get('/items_game')
  @ApiOperation({
    summary: 'Get items game',
    description: 'Returns the items game',
  })
  async getItemsGame(): Promise<any> {
    return this.schemaService.getSchemaItemsGame();
  }

  @Get('/overview')
  @ApiOperation({
    summary: 'Get schema overview',
    description: 'Returns an overview of the schema',
  })
  async getSchemaOverview() {
    return this.schemaService.getSchemaOverview();
  }

  @Get('/items')
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
  async getItems(
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor = 0,
    @Query('count', new ParseIntPipe({ optional: true })) count = 1000,
  ): Promise<SchemaItemsResponse> {
    return this.schemaService.getItems(cursor, count);
  }

  @Get('/items/defindex/:defindex')
  @ApiOperation({
    summary: 'Get schema item by defindex',
    description: 'Returns a schema item by its defindex',
  })
  @ApiParam({
    name: 'defindex',
    description: 'The defindex of the item',
    example: '5021',
  })
  @ApiResponse({
    type: SchemaItemModel,
  })
  async getSchemaItemByDefinedx(
    @Param('defindex') defindex: string,
  ): Promise<SchemaItem> {
    return this.schemaService.getItemByDefindex(defindex);
  }

  @Get('/items/name/:name')
  @ApiOperation({
    summary: 'Get schema item(s) by name',
    description: 'Returns schema items that match the name provide',
  })
  @ApiParam({
    name: 'name',
    description: 'The name of the item',
    example: 'Mann Co. Supply Crate Key',
  })
  @ApiResponse({
    type: SchemaItemModel,
    isArray: true,
  })
  async getSchemaItemsByName(
    @Param('name') name: string,
  ): Promise<SchemaItem[]> {
    return this.schemaService.getItemsByName(name);
  }

  @Get('/qualities/name/:name')
  @ApiOperation({
    summary: 'Get schema quality by name',
    description: 'Returns a schema quality',
  })
  @ApiParam({
    name: 'name',
    description: 'The name of the quality',
    example: 'Unique',
  })
  @ApiResponse({
    type: QualityModel,
  })
  async getSchemaQualitiesByName(
    @Param('name') name: string,
  ): Promise<Quality> {
    return this.schemaService.getQualitiesByName(name);
  }

  @Get('/qualities/id/:id')
  @ApiOperation({
    summary: 'Get schema quality by id',
    description: 'Returns a schema quality',
  })
  @ApiParam({
    name: 'id',
    description: 'The id of the quality',
    example: '6',
  })
  @ApiResponse({
    type: QualityModel,
  })
  async getSchemaQualitiesById(@Param('id') id: string): Promise<Quality> {
    return this.schemaService.getQualitiesById(id);
  }

  @Get('/effects/name/:name')
  @ApiOperation({
    summary: 'Get schema effect by name',
    description: 'Returns a schema effect',
  })
  @ApiParam({
    name: 'name',
    description: 'The name of the effect',
    example: 'Burning Flames',
  })
  @ApiResponse({
    type: AttachedParticleModel,
  })
  async getSchemaEffectsByName(
    @Param('name') name: string,
  ): Promise<AttachedParticle> {
    return this.schemaService.getEffectsByName(name);
  }

  @Get('/effects/id/:id')
  @ApiOperation({
    summary: 'Get schema effect by id',
    description: 'Returns a schema effect',
  })
  @ApiParam({
    name: 'id',
    description: 'The id of the effect',
    example: '13',
  })
  @ApiResponse({
    type: AttachedParticleModel,
  })
  async getSchemaEffectsById(
    @Param('id') id: string,
  ): Promise<AttachedParticle> {
    return this.schemaService.getEffectsById(id);
  }

  @Get('/paintkits/name/:name')
  @ApiOperation({
    summary: 'Get paint kit by name',
    description: 'Returns a paint kit',
  })
  @ApiParam({
    name: 'name',
    description: 'The name of the paint kit',
    example: 'Night Owl',
  })
  @ApiResponse({
    type: PaintKitModel,
  })
  async getSchemaPaintkitsByName(
    @Param('name') name: string,
  ): Promise<PaintKit> {
    return this.schemaService.getPaintKitByName(name);
  }

  @Get('/paintkits/id/:id')
  @ApiOperation({
    summary: 'Get paint kit by id',
    description: 'Returns a paint kit',
  })
  @ApiParam({
    name: 'id',
    description: 'The id of the paint kit',
    example: '14',
  })
  @ApiResponse({
    type: PaintKitModel,
  })
  async getSchemaPaintkitsById(@Param('id') id: string): Promise<PaintKit> {
    return this.schemaService.getPaintKitById(id);
  }
}