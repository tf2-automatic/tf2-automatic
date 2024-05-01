# bot

The bot allows a Steam account to be controlled using a HTTP API. One bot can control one Steam account.

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
| TRADE_CANCEL_TIME | Milliseconds a sent offer may be active for before it is canceled. Disabled if no value | No |  |
| TRADE_PENDING_CANCEL_TIME | Milliseconds a sent offer may be pending for before it is canceled. Disabled if no value | No |  |
| TRADE_POLL_INTERVAL | Milliseconds between getting the current state of recent trades. Use `-1` to disable | No | `30000` |
| TRADE_POLL_FULL_UPDATE_INTERVAL | Milliseconds between getting the current state of all trades. Disabled if no value | No | `120000` |
| RABBITMQ_HOST | Address of the RabbitMQ server | Yes |  |
| RABBITMQ_PORT | Port of the RabbitMQ server | Yes |  |
| RABBITMQ_USERNAME | Username to authenticate with the RabbitMQ server | Yes |  |
| RABBITMQ_PASSWORD | Password to authenticate with the RabbitMQ server | Yes |  |
| RABBITMQ_VHOST | Virtual host to use with the Rabbitmq server | Yes |  |
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
| BOT_MANAGER_HEARTBEAT_INTERVAL | Milliseconds between heartbeats sent to the bot-manager | No | `60000` |
| IP_ADDRESS | Manually set IP of the bot in bot-manager heartbeats | No |  |