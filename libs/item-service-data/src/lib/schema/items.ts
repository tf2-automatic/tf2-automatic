import { ApiProperty } from '@nestjs/swagger';
import { AttachedParticle } from '.';

export interface SchemaItem {
  name: string;
  defindex: number;
  item_class: string;
  item_type_name: string;
  item_name: string;
  proper_name: boolean;
  item_slot?: string;
  model_player?: string | null;
  item_quality: number;
  image_inventory?: string;
  min_ilevel: number;
  max_ilevel: number;
  image_url?: string;
  image_url_large?: string;
  craft_class?: string;
  craft_material_type?: string;
  capabilities: Capabilities;
  used_by_classes?: string[];
  item_description?: string;
  styles?: Style[];
  attributes?: Attribute[];
  drop_type?: string;
  item_set?: string;
  holiday_restriction?: string;
  per_class_loadout_slots?: PerClassLoadoutSlots;
  tool?: Tool;
}

export interface Capabilities {
  nameable?: boolean;
  can_gift_wrap: boolean;
  can_craft_mark?: boolean;
  can_be_restored?: boolean;
  strange_parts: boolean;
  can_card_upgrade?: boolean;
  can_strangify: boolean;
  can_killstreakify: boolean;
  can_consume: boolean;
  can_collect?: boolean;
  paintable?: boolean;
  can_craft_if_purchased?: boolean;
  can_craft_count?: boolean;
  can_unusualify?: boolean;
  usable_gc?: boolean;
  usable?: boolean;
  can_customize_texture?: boolean;
  usable_out_of_game?: boolean;
  can_spell_page?: boolean;
  duck_upgradable?: boolean;
  decodable?: boolean;
}

export interface Style {
  name: string;
  additional_hidden_bodygroups?: AdditionalHiddenBodygroups;
}

export interface AdditionalHiddenBodygroups {
  dogtags?: number;
  headphones?: number;
  head?: number;
  hat?: number;
  grenades?: number;
}

export interface Attribute {
  name: string;
  class: string;
  value: number;
}

export interface PerClassLoadoutSlots {
  Soldier: string;
  Heavy?: string;
  Pyro?: string;
  Engineer?: string;
  Demoman?: string;
}

export interface Tool {
  type: string;
  use_string?: string;
  usage_capabilities?: UsageCapabilities;
  restriction?: string;
}

export interface UsageCapabilities {
  can_consume?: boolean;
  can_killstreakify?: boolean;
  can_unusualify?: boolean;
  can_spell_page?: boolean;
  can_card_upgrade?: boolean;
  strange_parts?: boolean;
  can_strangify?: boolean;
  decodable?: boolean;
  duck_upgradable?: boolean;
  can_gift_wrap?: boolean;
  paintable?: boolean;
  paintable_team_colors?: boolean;
  nameable?: boolean;
  can_customize_texture?: boolean;
}

export class SchemaItemModel implements SchemaItem {
  @ApiProperty({
    example: 'Decoder Ring',
  })
  name!: string;

  @ApiProperty({
    example: 5021,
  })
  defindex!: number;

  @ApiProperty({
    example: 'tool',
  })
  item_class!: string;

  @ApiProperty({
    example: 'Tool',
  })
  item_type_name!: string;

  @ApiProperty({
    example: 'Mann Co. Supply Crate Key',
  })
  item_name!: string;

  @ApiProperty({
    example: 'Used to open locked supply crates.',
  })
  item_description?: string | undefined;

  @ApiProperty({
    example: false,
  })
  proper_name!: boolean;

  @ApiProperty({
    example: null,
  })
  model_player?: string | null;

  @ApiProperty({
    example: 6,
  })
  item_quality!: number;

  @ApiProperty({
    example: 'backpack/player/items/crafting/key',
  })
  image_inventory?: string;

  @ApiProperty({
    example: 5,
  })
  min_ilevel!: number;

  @ApiProperty({
    example: 5,
  })
  max_ilevel!: number;

  @ApiProperty({
    example:
      'http://media.steampowered.com/apps/440/icons/key.be0a5e2cda3a039132c35b67319829d785e50352.png',
  })
  image_url?: string | undefined;

  @ApiProperty({
    example:
      'http://media.steampowered.com/apps/440/icons/key_large.354829243e53d73a5a75323c88fc5689ecb19359.png',
  })
  image_url_large?: string | undefined;

  @ApiProperty({
    example: 'tool',
  })
  craft_class?: string | undefined;

  @ApiProperty({
    example: 'tool',
  })
  craft_material_type?: string | undefined;

  @ApiProperty({
    example: {
      can_gift_wrap: true,
      can_craft_mark: true,
      can_be_restored: true,
      strange_parts: true,
      can_card_upgrade: true,
      can_strangify: true,
      can_killstreakify: true,
      can_consume: true,
    },
  })
  capabilities!: Capabilities;

  @ApiProperty({
    example: {
      type: 'decoder_ring',
      usage_capabilities: {
        decodable: true,
      },
    },
  })
  tool?: Tool | undefined;

  @ApiProperty({
    example: [],
  })
  used_by_classes?: string[] | undefined;

  @ApiProperty({
    example: [
      {
        name: 'always_tradable',
        class: 'always_tradable',
        value: 1,
      },
    ],
  })
  attributes?: Attribute[] | undefined;
}

export class SchemaItemsResponse {
  @ApiProperty({
    description: 'The cursor used for the current request',
    example: 0,
  })
  current: number;

  @ApiProperty({
    description: 'The cursor to use for the next request',
    example: 1000,
  })
  next: number | null;

  @ApiProperty({
    type: SchemaItemModel,
    isArray: true,
  })
  items: SchemaItem[];
}
