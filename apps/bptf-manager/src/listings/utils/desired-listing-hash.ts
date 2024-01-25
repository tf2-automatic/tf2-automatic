import { ListingDto } from '@tf2-automatic/bptf-manager-data';
import hash from 'object-hash';

export default function hashListing(listing: ListingDto): string {
  if (listing.id) {
    return hash(listing.id);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const item: any = Object.assign({}, listing.item);
  delete item.quantity;

  return hash(item);
}
