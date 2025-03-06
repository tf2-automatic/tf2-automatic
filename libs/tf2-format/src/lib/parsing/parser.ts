import { InventoryItem } from '../types';

/**
 * A parser that extracts information from an item and parses it into a common format
 *
 * @template Item A type for the raw item to parse.
 * @template ExtractedItem A type for the result of extracting information from the raw item.
 */
export abstract class Parser<SchemaType, Item, ExtractedItem, Context = null> {
  constructor(protected readonly schema: SchemaType) {}

  /**
   * This method extracts information from the item.
   * @param raw The raw item to extract information from.
   * @returns The extracted information.
   */
  abstract extract(
    raw: Item,
  ): Context extends null ? ExtractedItem : [ExtractedItem, Context];

  /**
   * This method parses the extracted information into a common format.
   * @param extracted The result from the `extract` method.
   * @returns The parsed inventory item.
   * @throws If something goes wrong fetching values using the schema.
   */
  abstract parse(
    extracted: ExtractedItem,
    context?: Context extends null ? never : Context,
  ): Promise<InventoryItem>;
}
