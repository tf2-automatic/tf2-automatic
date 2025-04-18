# item-service

The item service stores information about items, such as their prices, stock levels, and stock limits. It also tracks exchanges and maintains a history of bought and sold items. It integrates with the bot and bot-manager applications to monitor stock and trades.

## Features

- <del>Tracks current item prices</del>
- <del>Monitors stock levels</del>
- <del>Keeps a list of items currently in offers to avoid offering the same item multiple times</del>
- <del>Records the history of bought and sold items</del>
- Periodically updates TF2 schema definitions
- Loads and parses inventories into a common format and caches the result
- <del>Integrates with bot and bot-manager applications to oversee stock and trading activities</del>

## Prerequisites

The service needs a standalone Redis server or sentinel with `noeviction` memory policy and a Postgres server.

## Configuration

The item service is configured using environment variables. Below is a list of the environment variables.

| Environment variable | Description | Required | Default |
|---|---|---|---|
| DEBUG | Enable/disable debugging logging | No | `false` |
| RABBITMQ_HOST | Address of the RabbitMQ server | Yes |  |
| RABBITMQ_PORT | Port of the RabbitMQ server | Yes |  |
| RABBITMQ_USERNAME | Username to authenticate with the RabbitMQ server | Yes |  |
| RABBITMQ_PASSWORD | Password to authenticate with the RabbitMQ server | Yes |  |
| RABBITMQ_VHOST | Virtual host to use with the Rabbitmq server | Yes |  |
| REDIS_HOST | Address of the Redis server | Yes |  |
| REDIS_PORT | Port of the Redis server | Yes |  |
| REDIS_PASSWORD | Password to authenticate with the Redis server | Yes |  |
| REDIS_DB | Database to use with the Redis server | No |  |
| REDIS_KEY_PREFIX | A prefix for all keys saved in Redis | No |  |
| STORAGE_TYPE | Type of storage the app will use (only s3) | Yes |  |
| STORAGE_S3_ENDPOINT | Endpoint of the S3 service | If "s3" storage type |  |
| STORAGE_S3_PORT | Port of the S3 service | If "s3" storage type |  |
| STORAGE_S3_PATH | Path to storage directory inside S3 bucket | If "s3" storage type |  |
| STORAGE_S3_BUCKET | Name of the S3 bucket | If "s3" storage type |  |
| STORAGE_ACCESS_KEY_ID | Access key used to authenticate with S3 service | If "s3" storage type |  |
| STORAGE_SECRET_ACCESS_KEY | Secret key used to authenticate with S3 service | If "s3" storage type |  |
| BOT_MANAGER_URL | URL of the bot-manager | Yes |  |
