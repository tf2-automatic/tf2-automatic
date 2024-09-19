# Events

The different applications publishes events. All events are stored as JSON and have the same base structure: 

- `type` - The type of the event (same as the routing key)
- `data` - An object containing data depending on the event type
- `metadata` - An object containing metadata
  - `steamid64` SteamID64 of the bot that made / triggered this event. May be null.
  - `time` - The unix epoch time that the event was made

Because multiple bots can run at the same time there needs to be a way to distinguish between bots. This is done using `steamid64` in `metadata`.

## Steam

React to when the bot is logged in or disconnects due to errors.

### steam.connected (bot)

Event made when the bot connects to Steam.

`STEAM_CONNECTED_EVENT`

- `type` - `bot.connected`
- `data` - Empty object

### steam.disconnected (bot)

Event made when the bot unexpectedly disconnects from Steam.

`STEAM_DISCONNECTED_EVENT`

- `type` - `steam.disconnected`
- `data`
  - `eresult`
  - `msg` - May be undefined

## Bot

Events made to know the state of a bot.

### bot.ready (bot)

Event made when the bot is ready and listening for HTTP requests.

`BOT_READY_EVENT`

- `type` - `bot.ready`
- `data` - Empty object

### bots.heartbeat (bot-manager)

Event made when the bot makes a heartbeat that is received by the bot-manager.

`BOT_HEARTBEAT_EVENT`

- `type` - `bots.heartbeat`
- `data`
  - `steamid64`
  - `ip`
  - `port`
  - `interval`
  - `latseSeen`

### bots.deleted (bot-manager)

Event made when the bot is no longer responsive and is removed from the bots list.

`BOT_DELETED_EVENT`

- `type` - `bots.deleted`
- `data`
  - `steamid64`
  - `ip`
  - `port`
  - `interval`
  - `latseSeen`

## Friends

Events received when friend relationship changes or when receiving messages from friends.

### friends.relationship (bot)

Event made when friend relationship changes.

`FRIEND_RELATIONSHIP_EVENT`

- `type` - `friends.relationship`
- `data`
  - `steamid64`
  - `relationship`
  - `oldRelationship`

### friends.message (bot)

Event made when a message from a friend is received.

`FRIEND_MESSAGE_EVENT`

- `type` - `friends.message`
- `data`
  - `steamid64`
  - `timestamp`
  - `ordinal`
  - `message`

### friends.typing (bot)

Event made when a friend is typing a message.

`FRIEND_TYPING_EVENT`

- `type` - `friends.typing`
- `data`
  - `steamid64`
  - `timestamp`
  - `ordinal`

## Inventories

Inventory events are used to react to the result of inventory load jobs.

### inventories.loaded (bot-manager)

Event is made when an inventory is successfully fetched and saved to the cache.

`INVENTORY_LOADED_EVENT`

- `type` - `inventories.loaded`
- `data`
  - `steamid64`
  - `appid`
  - `contextid`
  - `timestamp`
  - `itemCount`

### inventories.failed (bot-manager)

Event made when a inventory load job fails and will be retried.

`INVENTORY_FAILED_EVENT`

- `type` - `inventories.failed`
- `data`
  - `job` - The job that failed
  - `error` - Error message
  - `response` - Response body associated with the error

### inventories.error (bot-manager)

Event made when a inventory load job fails and won't be retried.

`INVENTORY_ERROR_EVENT`

- `type` - `inventories.error`
- `data`
  - `job` - The job that failed
  - `error` - Error message
  - `response` - Response body associated with the error

## Trades

The trade events are used to react to new trades being made and changes made to them. They are also used to react to errors with trade offer jobs.

A trade offer has the following structure:

- `id`
- `partner`
- `message`
- `state`
- `itemsToGive`
- `itemsToReceive`
- `isGlitched`
- `isOurOffer`
- `createdAt`
- `updatedAt`
- `expiresAt`
- `tradeID`
- `fromRealTimeTrade`
- `confirmationMethod`
- `escrowEndsAt`

The trade offer structure is nearly identical to trade offers from [node-steam-tradeoffer-manager](https://github.com/DoctorMcKay/node-steam-tradeoffer-manager/wiki/TradeOffer).

### trades.received (bot)

Event made when a new trade offer not made by the current bot appears in the polldata.

`TRADE_RECEIVED_EVENT`

- `type` - `trades.received`
- `data` - The trade offer

### trades.sent (bot)

Event made when a new trade offer made by the current bot appears in the polldata.

`TRADE_SENT_EVENT`

- `type` - `trades.sent`
- `data` - The trade offer

### trades.changed (bot)

Event made when a trade offer changes state.

`TRADE_CHANGED_EVENT`

- `type` - `trades.changed`
- `data`
  - `offer` - The trade offer
  - `oldState` - The old state of the trade offer
 
### trades.confirmation_needed (bot)

Event made when a trade offer changes state.

`TRADE_CONFIRMATION_NEEDED_EVENT`

- `type` - `trades.confirmation_needed`
- `data`
  - `offer` - The trade offer
 
### trades.exchange_details (bot-manager)

Event made when the exchange details of a trade are received  
The bot manager keeps track of it's own inventory, but should you want to do anything with the data you can

`EXCHANGE_DETAILS_EVENT`

- `type` - `trades.exchange_details`
- `data`
  - `offer` - The trade offer
  - `details`
    - `status`
    - `tradeInitTime`
    - `receivedItems`
    - `sentItems`

### trades.failed (bot-manager)

Event made when a trade offer job fails and will be retried.

`TRADE_FAILED_EVENT`

- `type` - `trades.failed`
- `data`
  - `job` - The job that failed
  - `error` - Error message
  - `response` - Response body associated with the error

### trades.error (bot-manager)

Event made when a trade offer job fails and won't be retried.

`TRADE_ERROR_EVENT`

- `type` - `trades.error`
- `data`
  - `job` - The job that failed
  - `error` - Error message
  - `response` - Response body associated with the error

## TF2

The TF2 events are used to react to items being added or removed from the inventory.

### tf2.gained (bot)

`TF2_GAINED_EVENT`

- `type` - `tf2.gained`
- `data` - a `TF2Item` object, refer to the type

### tf2.lost (bot)

`TF2_LOST_EVENT`

- `type` - `tf2.lost`
- `data` - a `TF2Item` object, refer to the type

### tf2.schema (bot)

Event made when the TF2 GC notifies clients of a new schema.

`TF2_SCHEMA_EVENT`
