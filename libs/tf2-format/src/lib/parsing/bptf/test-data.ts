import { BptfItem } from './types';

export function getBasicItem(): BptfItem {
  return {
    appid: 440,
    baseName: 'Mann Co. Supply Crate Key',
    defindex: 5021,
    id: '15681438673',
    originalId: '10638364157',
    quality: {
      id: 6,
      name: 'Unique',
      color: '#FFD700',
    },
    tradable: true,
    craftable: true,
  };
}

export function getFunnyItem(): BptfItem {
  return {
    appid: 440,
    baseName: 'Team Captain',
    defindex: 378,
    id: '',
    originalId: '',
    quality: {
      id: 6,
      name: 'Unique',
      color: '#FFD700',
    },
    elevatedQuality: {
      id: 11,
      name: 'Strange',
      color: '#CF6A32',
    },
    texture: {
      id: 82,
      itemDefindex: 15156,
      rarity: {
        id: 3,
        name: 'Mercenary',
        color: '#4B69FF',
      },
      name: 'Airwolf',
    },
    killstreakTier: 1,
    spells: [
      {
        name: 'Exorcism',
      },
      {
        name: 'Voices from Below',
      },
      {
        name: 'Pumpkin Bombs',
      },
    ],
    wearTier: {
      id: 1,
      name: 'Factory New',
    },
    killEaters: [
      {
        killEater: {
          id: 64,
          name: 'Points Scored',
        },
      },
    ],
    particle: {
      id: 4,
      name: 'Community Sparkle',
    },
    tradable: true,
    festivized: true,
    craftable: true,
    recipe: {
      inputItems: [],
      outputItem: {
        appid: 440,
        baseName: 'Tour of Duty Ticket',
        defindex: 725,
        id: '',
        originalId: '',
        quality: {
          id: 6,
          name: 'Unique',
          color: '#FFD700',
        },
      },
      targetItem: null,
    },
    sheen: {
      id: 1,
      name: 'Team Shine',
    },
    killstreaker: {
      id: 2002,
      name: 'Fire Horns',
    },
    priceindex: '4',
    paint: {
      id: 5052,
      name: 'A Color Similar to Slate',
      color: '#2f4f4f',
    },
  };
}

export function getItemWithParts() {
  return {
    appid: 440,
    baseName: 'Silver Botkiller Knife Mk.II',
    defindex: 959,
    id: '15445799655',
    imageUrl:
      'https://steamcdn-a.akamaihd.net/apps/440/icons/fob_e_knife.53bdee237f650cc9b5f8e7c4a22a1ccb11f2d367.png',
    marketName: 'Strange Killstreak Silver Botkiller Knife Mk.II',
    name: 'Strange Killstreak Silver Botkiller Knife Mk.II',
    origin: {
      id: 20,
      name: 'MvM Badge completion reward',
    },
    originalId: '10534293412',
    quality: {
      id: 11,
      name: 'Strange',
      color: '#CF6A32',
    },
    summary: 'Level 1 Knife',
    price: {
      steam: {
        currency: 'usd',
        short: '$0.93',
        long: '36.47 ref',
        raw: 29.74449999999999,
        value: 93,
      },
      suggested: {
        raw: 48.26599999999999,
        short: '48.27 ref',
        long: '48.27 ref, $1.23',
        usd: 1.230783,
      },
    },
    level: 1,
    strangeParts: [
      {
        score: 0,
        killEater: {
          id: 11,
          name: 'Snipers Killed',
          item: {
            appid: 440,
            baseName: 'Strange Part: Snipers Killed',
            defindex: 6005,
            id: '',
            imageUrl:
              'https://steamcdn-a.akamaihd.net/apps/440/icons/strange_part_snipers_killed.06fc155fc5b6aba320c46a39896a7054b0394b91.png',
            marketName: 'Strange Part: Snipers Killed',
            name: 'Strange Part: Snipers Killed',
            origin: null,
            originalId: '',
            quality: {
              id: 6,
              name: 'Unique',
              color: '#FFD700',
            },
            summary: 'Level 1 Strange Part',
            price: {
              steam: {
                currency: 'usd',
                short: '$4.44',
                long: '174.12 ref, 2.59 keys',
                raw: 142.00599999999997,
                value: 444.00000000000006,
              },
              community: {
                value: 2,
                valueHigh: 2,
                currency: 'keys',
                raw: 134.32999999999998,
                short: '2 keys',
                long: '134.33 ref, $3.43',
                usd: 3.4254149999999997,
                updatedAt: 1731279152,
                difference: -31.061625000000006,
              },
              suggested: {
                raw: 134.32999999999998,
                short: '2 keys',
                long: '134.33 ref, $3.43',
                usd: 3.4254149999999997,
              },
            },
            tradable: true,
            craftable: true,
          },
        },
      },
      {
        score: 0,
        killEater: {
          id: 13,
          name: 'Demomen Killed',
          item: {
            appid: 440,
            baseName: 'Strange Part: Demomen Killed',
            defindex: 6001,
            id: '',
            imageUrl:
              'https://steamcdn-a.akamaihd.net/apps/440/icons/strange_part_demos_killed.1d7f2ae1775c54fa443450be3f80c3b95116bf95.png',
            marketName: 'Strange Part: Demomen Killed',
            name: 'Strange Part: Demomen Killed',
            origin: null,
            originalId: '',
            quality: {
              id: 6,
              name: 'Unique',
              color: '#FFD700',
            },
            summary: 'Level 1 Strange Part',
            price: {
              steam: {
                currency: 'usd',
                short: '$1.07',
                long: '41.96 ref',
                raw: 34.22216666666666,
                value: 107,
              },
              community: {
                value: 33.11,
                valueHigh: 37.44,
                currency: 'metal',
                raw: 35.275,
                short: '33.11–37.44 ref',
                long: '$0.8995',
                usd: 0.9271162500000001,
                updatedAt: 1746974532,
                difference: 3.5549999999999997,
              },
              suggested: {
                raw: 35.275,
                short: '35.28 ref',
                long: '$0.8995',
                usd: 0.8995125,
              },
            },
            tradable: true,
            craftable: true,
          },
        },
      },
      {
        score: 0,
        killEater: {
          id: 17,
          name: 'Engineers Killed',
          item: {
            appid: 440,
            baseName: 'Strange Part: Engineers Killed',
            defindex: 6004,
            id: '',
            imageUrl:
              'https://steamcdn-a.akamaihd.net/apps/440/icons/strange_part_engineers_killed.0f6b1cf2e269a48df47f32349120563957046287.png',
            marketName: 'Strange Part: Engineers Killed',
            name: 'Strange Part: Engineers Killed',
            origin: null,
            originalId: '',
            quality: {
              id: 6,
              name: 'Unique',
              color: '#FFD700',
            },
            summary: 'Level 1 Strange Part',
            price: {
              steam: {
                currency: 'usd',
                short: '$0.55',
                long: '21.57 ref',
                raw: 17.59083333333333,
                value: 55.00000000000001,
              },
              community: {
                value: 15.11,
                valueHigh: 16.11,
                currency: 'metal',
                raw: 15.61,
                short: '15.11–16.11 ref',
                long: '$0.3981',
                usd: 0.40443,
                updatedAt: 1740515982,
                difference: -2.6099999999999994,
              },
              suggested: {
                raw: 15.61,
                short: '15.61 ref',
                long: '$0.3981',
                usd: 0.398055,
              },
            },
            tradable: true,
            craftable: true,
          },
        },
      },
    ],
    killstreakTier: 1,
    class: ['Spy'],
    slot: 'melee',
    killEaters: [
      {
        score: 0,
        killEater: {
          name: 'Kills',
        },
      },
    ],
    tradable: true,
    craftable: true,
    customName: 'let me just give you a hug',
    tag: null,
  };
}

export function getStrangifierChemistrySet() {
  return {
    appid: 440,
    baseName: 'Chemistry Set',
    defindex: 20005,
    id: '15510439400',
    imageUrl:
      'https://steamcdn-a.akamaihd.net/apps/440/icons/construction_kit.fdc5df204409bca571d7315ed7208c132a918570.png',
    marketName: 'Professor Speks Strangifier Chemistry Set',
    name: 'Professor Speks Strangifier Chemistry Set',
    origin: {
      id: 0,
      name: 'Timed Drop',
    },
    originalId: '2124822184',
    quality: {
      id: 6,
      name: 'Unique',
      color: '#FFD700',
    },
    summary: 'Level 5 Recipe',
    price: [],
    level: 5,
    tradable: true,
    craftable: true,
    recipe: {
      estimatedCraftingCost: {
        short: '19.06 ref',
        long: '19.06 ref, $0.4859',
        raw: 19.054999999999996,
      },
      inputItems: [
        {
          quantity: 4,
          name: 'The Fists of Steel',
        },
        {
          quantity: 1,
          name: 'The Ambassador',
        },
        {
          quantity: 1,
          name: 'The Spy-cicle',
        },
        {
          quantity: 1,
          name: 'The Sandvich',
        },
        {
          quantity: 1,
          name: 'The Blutsauger',
        },
        {
          quantity: 1,
          name: 'The Axtinguisher',
        },
        {
          quantity: 1,
          name: 'Strange Killing Gloves of Boxing',
        },
      ],
      outputItem: {
        appid: 440,
        baseName: 'Strangifier',
        defindex: 6522,
        id: '',
        imageUrl:
          'https://steamcdn-a.akamaihd.net/apps/440/icons/strange_generic.c49007ba98593c7ac9fded38d2d61b1d2b4091b9.png',
        marketName: 'Professor Speks Strangifier',
        name: 'Professor Speks Strangifier',
        origin: null,
        originalId: '',
        quality: {
          id: 6,
          name: 'Unique',
          color: '#FFD700',
        },
        summary: 'Level 5 Strangifier',
        price: {
          steam: {
            currency: 'usd',
            short: '$1.46',
            long: '57.25 ref, 0.85 keys',
            raw: 46.695666666666654,
            value: 146,
          },
          community: {
            value: 39,
            valueHigh: 43,
            currency: 'metal',
            raw: 41,
            short: '39–43 ref',
            long: '$1.05',
            usd: 1.0710000000000002,
            updatedAt: 1671519405,
            difference: 6.5,
          },
          suggested: {
            raw: 41,
            short: '41 ref',
            long: '$1.05',
            usd: 1.0455,
          },
        },
        tradable: true,
        craftable: true,
        recipe: {
          estimatedCraftingCost: [],
          inputItems: [],
          outputItem: null,
          targetItem: {
            itemName: 'Professor Speks',
            imageUrl:
              'https://steamcdn-a.akamaihd.net/apps/440/icons/professor_speks.65cd9e3d7d91dc4956a322d2292c4e1d7519d529.png',
            _source: {
              _id: '440_343',
              name: 'Friendly Item',
              defindex: 343,
              item_class: 'tf_wearable',
              item_type_name: 'Glasses',
              item_name: 'Professor Speks',
              item_description:
                'Give your teacher the gift of insight, paper clip and rubber band included.',
              proper_name: false,
              item_slot: 'misc',
              item_quality: 6,
              image_inventory:
                'backpack/player/items/all_class/professor_speks',
              min_ilevel: 5,
              max_ilevel: 5,
              image_url:
                'https://steamcdn-a.akamaihd.net/apps/440/icons/professor_speks.65cd9e3d7d91dc4956a322d2292c4e1d7519d529.png',
              image_url_large:
                'https://steamcdn-a.akamaihd.net/apps/440/icons/professor_speks_large.6fc4e83fb4c98c7e4d8fd814f3d85d5d6c5d3d37.png',
              drop_type: 'drop',
              capabilities: {
                nameable: true,
                can_gift_wrap: true,
                can_craft_mark: true,
                can_be_restored: true,
                strange_parts: true,
                can_card_upgrade: true,
                can_strangify: true,
                can_killstreakify: true,
                can_consume: true,
              },
              attributes: [
                {
                  name: 'kill eater score type',
                  class: 'kill_eater_score_type',
                  value: 64,
                },
                {
                  name: 'kill eater kill type',
                  class: 'kill_eater_kill_type',
                  value: 64,
                },
                {
                  name: 'cannot trade',
                  class: 'cannot_trade',
                  value: 1,
                },
              ],
              release_date: 1309463324,
              appid: 440,
              _keywords: ['Professor', 'Speks'],
            },
          },
        },
        priceindex: '343',
      },
      targetItem: {
        itemName: 'Professor Speks',
        imageUrl:
          'https://steamcdn-a.akamaihd.net/apps/440/icons/professor_speks.65cd9e3d7d91dc4956a322d2292c4e1d7519d529.png',
        _source: {
          _id: '440_343',
          name: 'Friendly Item',
          defindex: 343,
          item_class: 'tf_wearable',
          item_type_name: 'Glasses',
          item_name: 'Professor Speks',
          item_description:
            'Give your teacher the gift of insight, paper clip and rubber band included.',
          proper_name: false,
          item_slot: 'misc',
          item_quality: 6,
          image_inventory: 'backpack/player/items/all_class/professor_speks',
          min_ilevel: 5,
          max_ilevel: 5,
          image_url:
            'https://steamcdn-a.akamaihd.net/apps/440/icons/professor_speks.65cd9e3d7d91dc4956a322d2292c4e1d7519d529.png',
          image_url_large:
            'https://steamcdn-a.akamaihd.net/apps/440/icons/professor_speks_large.6fc4e83fb4c98c7e4d8fd814f3d85d5d6c5d3d37.png',
          drop_type: 'drop',
          capabilities: {
            nameable: true,
            can_gift_wrap: true,
            can_craft_mark: true,
            can_be_restored: true,
            strange_parts: true,
            can_card_upgrade: true,
            can_strangify: true,
            can_killstreakify: true,
            can_consume: true,
          },
          attributes: [
            {
              name: 'kill eater score type',
              class: 'kill_eater_score_type',
              value: 64,
            },
            {
              name: 'kill eater kill type',
              class: 'kill_eater_kill_type',
              value: 64,
            },
            {
              name: 'cannot trade',
              class: 'cannot_trade',
              value: 1,
            },
          ],
          release_date: 1309463324,
          appid: 440,
          _keywords: ['Professor', 'Speks'],
        },
      },
    },
    priceindex: '6522-6-343',
    tag: null,
  };
}

export function getDuelingMinigame() {
  return {
    appid: 440,
    baseName: 'Dueling Mini-Game',
    defindex: 241,
    id: '15568852549',
    imageUrl:
      'https://steamcdn-a.akamaihd.net/apps/440/icons/icon_dueling.beb67c53914fe22878324f27f0813933439d81f8.png',
    marketName: 'Dueling Mini-Game',
    name: 'Dueling Mini-Game',
    origin: {
      id: 0,
      name: 'Timed Drop',
    },
    originalId: '15487882462',
    quality: {
      id: 6,
      name: 'Unique',
      color: '#FFD700',
    },
    summary: 'Level 5 Usable Item',
    price: {
      community: {
        value: 0.77,
        valueHigh: 0.88,
        currency: 'metal',
        raw: 0.825,
        short: '0.77–0.88 ref',
        long: '$0.021',
        usd: 0.02173875,
        updatedAt: 1731431534,
        difference: -0.11499999999999999,
      },
      suggested: {
        raw: 0.825,
        short: '0.83 ref',
        long: '$0.021',
        usd: 0.0210375,
      },
    },
    level: 5,
    slot: 'action',
    tradable: true,
    craftable: true,
    quantity: 5,
    tag: null,
  };
}

export function getKillstreakKit() {
  return {
    appid: 440,
    baseName: 'Kit',
    defindex: 6527,
    id: '15443117883',
    imageUrl:
      'https://steamcdn-a.akamaihd.net/apps/440/icons/professional_grease_basic.ee3b1254f3a6bdc43ba695dae8058798ed57cf6b.png',
    marketName: 'Killstreak Grenade Launcher Kit',
    name: 'Non-Craftable Killstreak Grenade Launcher Kit',
    origin: {
      id: 20,
      name: 'MvM Badge completion reward',
    },
    originalId: '13666970636',
    quality: {
      id: 6,
      name: 'Unique',
      color: '#FFD700',
    },
    summary: 'Level 1 Killstreak Kit',
    price: {
      steam: {
        currency: 'usd',
        short: '$1.04',
        long: '40.78 ref',
        raw: 33.26266666666666,
        value: 104,
      },
      suggested: {
        raw: 33.26266666666666,
        short: '33.26 ref',
        long: '33.26 ref, $0.8482',
        usd: 0.8481979999999999,
      },
    },
    level: 1,
    killstreakTier: 1,
    tradable: true,
    recipe: {
      estimatedCraftingCost: [],
      inputItems: [],
      outputItem: null,
      targetItem: {
        itemName: 'Grenade Launcher',
        imageUrl:
          'https://steamcdn-a.akamaihd.net/apps/440/icons/w_grenadelauncher.a430fe11337c5f14f68126a1d3d48fe4a67273af.png',
        _source: {
          _id: '440_206',
          name: 'Upgradeable TF_WEAPON_GRENADELAUNCHER',
          defindex: 206,
          item_class: 'tf_weapon_grenadelauncher',
          item_type_name: 'Grenade Launcher',
          item_name: 'Grenade Launcher',
          proper_name: false,
          item_slot: 'primary',
          item_quality: 6,
          image_inventory: 'backpack/weapons/w_models/w_grenadelauncher',
          min_ilevel: 1,
          max_ilevel: 1,
          image_url:
            'https://steamcdn-a.akamaihd.net/apps/440/icons/w_grenadelauncher.a430fe11337c5f14f68126a1d3d48fe4a67273af.png',
          image_url_large:
            'https://steamcdn-a.akamaihd.net/apps/440/icons/w_grenadelauncher_large.1e6e606c6a76392bb98a6a03481ceca496250277.png',
          craft_class: '',
          craft_material_type: 'weapon',
          capabilities: {
            nameable: true,
            can_gift_wrap: true,
            can_craft_mark: true,
            can_be_restored: true,
            strange_parts: true,
            can_card_upgrade: true,
            can_strangify: true,
            can_killstreakify: true,
            can_consume: true,
          },
          styles: [
            {
              name: 'TF_UnknownStyle',
            },
            {
              name: 'TF_UnknownStyle',
            },
          ],
          used_by_classes: ['Demoman'],
          first_sale_date: 1285718400,
          release_date: 1309463324,
          appid: 440,
          _keywords: ['Grenade', 'Launcher'],
        },
      },
    },
    priceindex: '1-206',
    tag: null,
  };
}

export function getProfessionalKillstreakKitFabricator() {
  return {
    appid: 440,
    baseName: 'Fabricator',
    defindex: 20003,
    id: '15443117973',
    imageUrl:
      'https://steamcdn-a.akamaihd.net/apps/440/icons/professional_kit_rare.97f580303b4d77bfe95dda36615979508a5b0533.png',
    marketName: 'Professional Killstreak Splendid Screen Kit Fabricator',
    name: 'Professional Killstreak Splendid Screen Kit Fabricator',
    origin: {
      id: 20,
      name: 'MvM Badge completion reward',
    },
    originalId: '13666970647',
    quality: {
      id: 6,
      name: 'Unique',
      color: '#FFD700',
    },
    summary: 'Level 1 Recipe',
    price: {
      steam: {
        currency: 'usd',
        short: '$0.56',
        long: '21.96 ref',
        raw: 17.910666666666664,
        value: 56.00000000000001,
      },
      suggested: {
        raw: 17.910666666666664,
        short: '17.91 ref',
        long: '17.91 ref, $0.4567',
        usd: 0.45672199999999996,
      },
    },
    level: 1,
    tradable: true,
    craftable: true,
    recipe: {
      estimatedCraftingCost: {
        short: '28.25 ref',
        long: '28.25 ref, $0.72',
        raw: 28.25,
      },
      inputItems: [
        {
          quantity: 2,
          name: 'Specialized Killstreak Item',
        },
        {
          quantity: 13,
          name: 'Battle-Worn Robot KB-808',
        },
        {
          quantity: 3,
          name: 'Battle-Worn Robot Money Furnace',
        },
        {
          quantity: 4,
          name: 'Reinforced Robot Emotion Detector',
        },
        {
          quantity: 2,
          name: 'Reinforced Robot Bomb Stabilizer',
        },
        {
          quantity: 3,
          name: 'Pristine Robot Brainstorm Bulb',
        },
      ],
      outputItem: {
        appid: 440,
        baseName: 'Kit',
        defindex: 6526,
        id: '',
        imageUrl:
          'https://steamcdn-a.akamaihd.net/apps/440/icons/professional_grease_rare.2b28753ad51f725d6438ab08b43074bcaba264b2.png',
        marketName: 'Professional Killstreak Splendid Screen Kit',
        name: 'Professional Killstreak Splendid Screen Kit',
        origin: null,
        originalId: '',
        quality: {
          id: 6,
          name: 'Unique',
          color: '#FFD700',
        },
        summary: 'Level 5 Professional Killstreak Kit',
        price: {
          steam: {
            currency: 'usd',
            short: '$6.01',
            long: '235.69 ref, 3.51 keys',
            raw: 192.21983333333327,
            value: 601,
          },
          suggested: {
            raw: 192.21983333333327,
            short: '2.86 keys',
            long: '192.22 ref, 2.86 keys, $4.90',
            usd: 4.901605749999999,
          },
        },
        tradable: true,
        craftable: true,
        recipe: {
          estimatedCraftingCost: [],
          inputItems: [],
          outputItem: null,
          targetItem: {
            itemName: 'Splendid Screen',
            imageUrl:
              'https://steamcdn-a.akamaihd.net/apps/440/icons/c_persian_shield.41c35ede45c975b46eea3700cfe4e21f0dd19c18.png',
            _source: {
              _id: '440_406',
              name: 'The Splendid Screen',
              defindex: 406,
              item_class: 'tf_wearable_demoshield',
              item_type_name: 'Shield',
              item_name: 'Splendid Screen',
              item_description:
                'Alt-Fire: Charge toward your enemies and remove debuffs.\nGain a critical melee strike after impacting an enemy.',
              proper_name: true,
              item_slot: 'secondary',
              item_quality: 6,
              image_inventory:
                'backpack/workshop/weapons/c_models/c_persian_shield/c_persian_shield',
              min_ilevel: 10,
              max_ilevel: 10,
              image_url:
                'https://steamcdn-a.akamaihd.net/apps/440/icons/c_persian_shield.41c35ede45c975b46eea3700cfe4e21f0dd19c18.png',
              image_url_large:
                'https://steamcdn-a.akamaihd.net/apps/440/icons/c_persian_shield_large.f3f4c2befdfa4ef74ad659ec19c2221a6d16844e.png',
              drop_type: 'none',
              item_set: 'desert_demo',
              craft_class: 'weapon',
              craft_material_type: 'weapon',
              capabilities: {
                nameable: true,
                can_gift_wrap: true,
                can_craft_count: true,
                can_craft_mark: true,
                can_be_restored: true,
                strange_parts: true,
                can_card_upgrade: true,
                can_strangify: true,
                can_killstreakify: true,
                can_consume: true,
              },
              styles: [
                {
                  name: 'Classic',
                },
                {
                  name: 'Spike',
                },
                {
                  name: 'Arrow',
                },
                {
                  name: 'Spike and Arrow',
                },
              ],
              used_by_classes: ['Demoman'],
              attributes: [
                {
                  name: 'charge recharge rate increased',
                  class: 'charge_recharge_rate',
                  value: 1.5,
                },
                {
                  name: 'charge impact damage increased',
                  class: 'charge_impact_damage',
                  value: 1.7000000476837158,
                },
                {
                  name: 'dmg taken from fire reduced',
                  class: 'mult_dmgtaken_from_fire',
                  value: 0.800000011920929,
                },
                {
                  name: 'dmg taken from blast reduced',
                  class: 'mult_dmgtaken_from_explosions',
                  value: 0.800000011920929,
                },
                {
                  name: 'allowed in medieval mode',
                  class: 'allowed_in_medieval_mode',
                  value: 1,
                },
              ],
              first_sale_date: 1300665600,
              release_date: 1309463324,
              appid: 440,
              _keywords: ['Splendid', 'Screen'],
            },
          },
        },
        sheen: {
          id: 7,
          name: 'Hot Rod',
        },
        killstreaker: {
          id: 2004,
          name: 'Tornado',
        },
        priceindex: '3-406',
      },
      targetItem: {
        itemName: 'Splendid Screen',
        imageUrl:
          'https://steamcdn-a.akamaihd.net/apps/440/icons/c_persian_shield.41c35ede45c975b46eea3700cfe4e21f0dd19c18.png',
        _source: {
          _id: '440_406',
          name: 'The Splendid Screen',
          defindex: 406,
          item_class: 'tf_wearable_demoshield',
          item_type_name: 'Shield',
          item_name: 'Splendid Screen',
          item_description:
            'Alt-Fire: Charge toward your enemies and remove debuffs.\nGain a critical melee strike after impacting an enemy.',
          proper_name: true,
          item_slot: 'secondary',
          item_quality: 6,
          image_inventory:
            'backpack/workshop/weapons/c_models/c_persian_shield/c_persian_shield',
          min_ilevel: 10,
          max_ilevel: 10,
          image_url:
            'https://steamcdn-a.akamaihd.net/apps/440/icons/c_persian_shield.41c35ede45c975b46eea3700cfe4e21f0dd19c18.png',
          image_url_large:
            'https://steamcdn-a.akamaihd.net/apps/440/icons/c_persian_shield_large.f3f4c2befdfa4ef74ad659ec19c2221a6d16844e.png',
          drop_type: 'none',
          item_set: 'desert_demo',
          craft_class: 'weapon',
          craft_material_type: 'weapon',
          capabilities: {
            nameable: true,
            can_gift_wrap: true,
            can_craft_count: true,
            can_craft_mark: true,
            can_be_restored: true,
            strange_parts: true,
            can_card_upgrade: true,
            can_strangify: true,
            can_killstreakify: true,
            can_consume: true,
          },
          styles: [
            {
              name: 'Classic',
            },
            {
              name: 'Spike',
            },
            {
              name: 'Arrow',
            },
            {
              name: 'Spike and Arrow',
            },
          ],
          used_by_classes: ['Demoman'],
          attributes: [
            {
              name: 'charge recharge rate increased',
              class: 'charge_recharge_rate',
              value: 1.5,
            },
            {
              name: 'charge impact damage increased',
              class: 'charge_impact_damage',
              value: 1.7000000476837158,
            },
            {
              name: 'dmg taken from fire reduced',
              class: 'mult_dmgtaken_from_fire',
              value: 0.800000011920929,
            },
            {
              name: 'dmg taken from blast reduced',
              class: 'mult_dmgtaken_from_explosions',
              value: 0.800000011920929,
            },
            {
              name: 'allowed in medieval mode',
              class: 'allowed_in_medieval_mode',
              value: 1,
            },
          ],
          first_sale_date: 1300665600,
          release_date: 1309463324,
          appid: 440,
          _keywords: ['Splendid', 'Screen'],
        },
      },
    },
    sheen: {
      id: 7,
      name: 'Hot Rod',
    },
    killstreaker: {
      id: 2004,
      name: 'Tornado',
    },
    priceindex: '6526-6-406',
    tag: null,
  };
}
