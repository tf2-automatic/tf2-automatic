export enum eEconItemFlags {
  kEconItemFlag_CannotTrade = 1 << 0,
  kEconItemFlag_CannotBeUsedInCrafting = 1 << 1,
  kEconItemFlag_CanBeTradedByFreeAccounts = 1 << 2,
  kEconItemFlag_NonEconomy = 1 << 3,
  kEconItemFlag_PurchasedAfterStoreCraftabilityChanges2012 = 1 << 4,
  kEconItemFlagClient_ForceBlueTeam = 1 << 5,
  kEconItemFlagClient_StoreItem = 1 << 6,
  kEconItemFlagClient_Preview = 1 << 7,
  kEconItemFlags_CheckFlags_AllGCFlags = kEconItemFlag_CannotTrade |
    kEconItemFlag_CannotBeUsedInCrafting |
    kEconItemFlag_CanBeTradedByFreeAccounts |
    kEconItemFlag_NonEconomy |
    kEconItemFlag_PurchasedAfterStoreCraftabilityChanges2012,
}

export enum eEconItemOrigin {
  kEconItemOrigin_Invalid = -1,
  kEconItemOrigin_Drop = 0,
  kEconItemOrigin_Achievement,
  kEconItemOrigin_Purchased,
  kEconItemOrigin_Traded,
  kEconItemOrigin_Crafted,
  kEconItemOrigin_StorePromotion,
  kEconItemOrigin_Gifted,
  kEconItemOrigin_SupportGranted,
  kEconItemOrigin_FoundInCrate,
  kEconItemOrigin_Earned,
  kEconItemOrigin_ThirdPartyPromotion,
  kEconItemOrigin_GiftWrapped,
  kEconItemOrigin_HalloweenDrop,
  kEconItemOrigin_PackageItem,
  kEconItemOrigin_Foreign,
  kEconItemOrigin_CDKey,
  kEconItemOrigin_CollectionReward,
  kEconItemOrigin_PreviewItem,
  kEconItemOrigin_SteamWorkshopContribution,
  kEconItemOrigin_PeriodicScoreReward,
  kEconItemOrigin_MvMMissionCompletionReward,
  kEconItemOrigin_MvMSquadSurplusReward,
  kEconItemOrigin_RecipeOutput,
  kEconItemOrigin_QuestDrop,
  kEconItemOrigin_QuestLoanerItem,
  kEconItemOrigin_TradeUp,
  kEconItemOrigin_ViralCompetitiveBetaPassSpread,
  kEconItemOrigin_Max,
}

export enum item_capabilities_t {
  ITEM_CAP_NONE = 0,
  ITEM_CAP_PAINTABLE = 1 << 0,
  ITEM_CAP_NAMEABLE = 1 << 1,
  ITEM_CAP_DECODABLE = 1 << 2,
  ITEM_CAP_CAN_BE_CRAFTED_IF_PURCHASED = 1 << 3,
  ITEM_CAP_CAN_CUSTOMIZE_TEXTURE = 1 << 4,
  ITEM_CAP_USABLE = 1 << 5,
  ITEM_CAP_USABLE_GC = 1 << 6,
  ITEM_CAP_CAN_GIFT_WRAP = 1 << 7,
  ITEM_CAP_USABLE_OUT_OF_GAME = 1 << 8,
  ITEM_CAP_CAN_COLLECT = 1 << 9,
  ITEM_CAP_CAN_CRAFT_COUNT = 1 << 10,
  ITEM_CAP_CAN_CRAFT_MARK = 1 << 11,
  ITEM_CAP_PAINTABLE_TEAM_COLORS = 1 << 12,
  ITEM_CAP_CAN_BE_RESTORED = 1 << 13,
  ITEM_CAP_CAN_USE_STRANGE_PARTS = 1 << 14,
  ITEM_CAP_CAN_CARD_UPGRADE = 1 << 15,
  ITEM_CAP_CAN_STRANGIFY = 1 << 16,
  ITEM_CAP_CAN_KILLSTREAKIFY = 1 << 17,
  ITEM_CAP_CAN_CONSUME = 1 << 18,
  ITEM_CAP_CAN_SPELLBOOK_PAGE = 1 << 19,
  ITEM_CAP_HAS_SLOTS = 1 << 20,
  ITEM_CAP_DUCK_UPGRADABLE = 1 << 21,
  ITEM_CAP_CAN_UNUSUALIFY = 1 << 22,
  NUM_ITEM_CAPS = 23,
}

export enum DynamicRecipeFlags {
  IS_OUTPUT = 1 << 0,
  IS_UNTRADABLE = 1 << 1,
  PARAM_ITEM_DEF_SET = 1 << 2,
  PARAM_QUALITY_SET = 1 << 3,
  PARAM_ATTRIBUTE_SET_ALL = 1 << 4,
  PARAM_ATTRIBUTE_SET_ANY = 1 << 5,
}

export interface CAttribute_DynamicRecipeComponent {
  defIndex?: number;
  itemQuality?: number;
  componentFlags?: number;
  attributesString?: string;
  numRequired?: number;
  numFulfilled?: number;
}

export const KILLSTREAK_FABRICATORS = {
  6527: 1,
  6523: 2,
  6526: 3,
};
