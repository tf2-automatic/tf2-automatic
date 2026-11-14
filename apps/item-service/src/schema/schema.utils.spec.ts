import { ItemsGameItem } from '@tf2-automatic/item-service-data';
import { mergeDefinitionPrefab } from './schema.utils';

describe('mergeDefinitionPrefab', () => {
  const prefabs: Record<string, Partial<ItemsGameItem>> = {
    cosmetic: {
      item_class: 'tf_wearable',
      item_slot: 'misc',
      capabilities: {
        nameable: '1',
        can_craft_if_purchased: '1',
      },
    },
    base_hat: {
      item_slot: 'hat',
    },
    hat: {
      prefab: 'cosmetic base_hat',
      item_slot: 'head',
    },
    valve: {
      item_quality: 'unique',
    },
  };

  it('will merge a single prefab', () => {
    const item: Partial<ItemsGameItem> = {};

    mergeDefinitionPrefab(item, { prefab: 'valve', name: 'Item' }, prefabs);

    expect(item).toEqual({ item_quality: 'unique', name: 'Item' });
  });

  it('will merge multiple prefabs', () => {
    const item: Partial<ItemsGameItem> = {};

    mergeDefinitionPrefab(
      item,
      { prefab: 'cosmetic valve', name: 'Item' },
      prefabs,
    );

    expect(item).toEqual({
      item_class: 'tf_wearable',
      item_slot: 'misc',
      item_quality: 'unique',
      capabilities: {
        nameable: '1',
        can_craft_if_purchased: '1',
      },
      name: 'Item',
    });
  });

  it('will merge multiple prefabs inherited through a prefab', () => {
    const item: Partial<ItemsGameItem> = {};

    mergeDefinitionPrefab(
      item,
      {
        prefab: 'hat',
        name: 'Hong Kong Cone',
        capabilities: { paintable: '1' },
      },
      prefabs,
    );

    expect(item).toEqual({
      item_class: 'tf_wearable',
      item_slot: 'head',
      capabilities: {
        nameable: '1',
        can_craft_if_purchased: '1',
        paintable: '1',
      },
      name: 'Hong Kong Cone',
    });
  });

  it('will let earlier prefabs override later ones', () => {
    const item: Partial<ItemsGameItem> = {};

    mergeDefinitionPrefab(item, { prefab: 'base_hat cosmetic' }, prefabs);

    expect(item.item_slot).toEqual('hat');
  });
});
