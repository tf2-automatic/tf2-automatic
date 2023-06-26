# Features

These sections highlights different features of the system and how to use them.

## Inventories

Inventories are requested from Steam using a queue. Once an inventory is fetched it will be cached.

https://github.com/tf2-automatic/tf2-automatic/blob/f54cd7e6251be311aeea768bbde22d2e2c72d43b/libs/dto/src/lib/inventories.ts#L7-L49

Above shows the data transfer object for enqueueing inventories to be loaded.

### Exchange details

When the state of a trade becomes accepted, the offer is added to an internal queue to get the exchange details. The exchange details contains the items exchanged and their new assetids.

Relative to each account in the trade, if they have a cached inventory, then their lost items are removed from their cached inventory, and the items they gained are added to their cached inventory. This can be used to reduce the need for an inventory to be fetched but the inventories still need to be updated once in a while. How regularly you fetch the inventory depends on your use.

The system does not fetch inventories, but it tries to keep cached inventories up to date by deleting lost items, and adding items received from trades.

## Trades

Trade actions are added to a queue to ensure that they will happen. Actions can be queued even if the bot that has to make the action is offline.

The trades queue can take 5 different types of jobs - create, remove (decline / cancel), accept, confirm, and counter.
