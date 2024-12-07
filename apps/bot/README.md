# bot

The bot allows a Steam account to be controlled using a HTTP API. One bot can control one Steam account.

## Events

Events can either be published to RabbitMQ or Redis and it is configured using environment variables.

If you choose to use Redis for events, then you can choose to either persist the events, or just publish them directly. If you persist events, then all events are saved to a list with the key `BOT_EXCHANGE_NAME` from the `bot-data` library and a message is published to a channel also named after `BOT_EXCHANGE_NAME` to notify you that a new event is added to the list. If you choose to not persist events, then all events are published directly to the channel called `BOT_EXCHANGE_NAME`. An example of how to use this can be seen [here](../../examples/redis-events/). When using Redis for events, the `bot-manager` will not work properly because it does not support Redis events.

## Configuration

The bot is configured using environment variables. Below is a list of the environment variables.

| Environment variable | Description | Required | Default |
|---|---|---|---|
| DEBUG | Enable/disable debugging logging | No | `false` |
| STEAM_USERNAME | Username of the Steam account | Yes |  |
| STEAM_PASSWORD | Password of the Steam account | Yes |  |
| STEAM_SHARED_SECRET | Shared secret of the Steam account | Yes |  |
| STEAM_IDENTITY_SECRET | Identity secret of the Steam account | Yes |  |
| STEAM_API_KEY | Manually set the Steam API key of the account. See issue [#346](https://github.com/tf2-automatic/tf2-automatic/issues/345) | No |  |
| STEAM_PROXY_URL | Proxy used for all communications with Steam | No |  |
| STEAM_DEFAULT_GAME | The game to play when no list of games to has been set. Use an empty string for no game to play. | No | `440` |
| TRADE_CANCEL_TIME | Milliseconds a sent offer may be active for before it is canceled. Disabled if no value | No |  |
| TRADE_PENDING_CANCEL_TIME | Milliseconds a sent offer may be pending for before it is canceled. Disabled if no value | No |  |
| TRADE_POLL_INTERVAL | Milliseconds between getting the current state of recent trades. Use `-1` to disable | No | 30 seconds |
| TRADE_POLL_FULL_UPDATE_INTERVAL | Milliseconds between getting the current state of all trades. Disabled if no value | No | 2 minutes |
| TRADE_POLL_DATA_FORGET_TIME | Milliseconds a trade has not seen during a full poll before removing it from the polldata | No | 14 days |
| EVENTS_TYPE | How events should be published, can only be "rabbitmq" right now | Yes |  |
| RABBITMQ_HOST | Address of the RabbitMQ server | If "rabbitmq" events type |  |
| RABBITMQ_PORT | Port of the RabbitMQ server | If "rabbitmq" events type |  |
| RABBITMQ_USERNAME | Username to authenticate with the RabbitMQ server | If "rabbitmq" events type |  |
| RABBITMQ_PASSWORD | Password to authenticate with the RabbitMQ server | If "rabbitmq" events type |  |
| RABBITMQ_VHOST | Virtual host to use with the Rabbitmq server | If "rabbitmq" events type |  |
| REDIS_HOST | Address of the Redis server | If "redis" events type |  |
| REDIS_PORT | Port of the Redis server | If "redis" events type |  |
| REDIS_PASSWORD | Password to authenticate with the Redis server | If "redis" events type |  |
| REDIS_DB | Database to use with the Redis server | No |  |
| REDIS_KEY_PREFIX | A prefix for all keys saved in Redis | No |  |
| STORAGE_TYPE | Type of storage the bot will use (local or s3) | Yes |  |
| STORAGE_LOCAL_PATH | Path to storage directory | If "local" storage type |  |
| STORAGE_S3_ENDPOINT | Endpoint of the S3 service | If "s3" storage type |  |
| STORAGE_S3_PORT | Port of the S3 service | If "s3" storage type |  |
| STORAGE_S3_PATH | Path to storage directory inside S3 bucket | If "s3" storage type |  |
| STORAGE_S3_BUCKET | Name of the S3 bucket | If "s3" storage type |  |
| STORAGE_ACCESS_KEY_ID | Access key used to authenticate with S3 service | If "s3" storage type |  |
| STORAGE_SECRET_ACCESS_KEY | Secret key used to authenticate with S3 service | If "s3" storage type |  |
| BOT_MANAGER_ENABLED | If the bot should register itself with a bot-manager | No | `false` |
| BOT_MANAGER_URL | URL of the bot-manager | No |  |
| BOT_MANAGER_HEARTBEAT_INTERVAL | Milliseconds between heartbeats sent to the bot-manager | No | 1 minute |
| IP_ADDRESS | Manually set IP of the bot in bot-manager heartbeats | No |  |