# Setup

## Minimum setup

The minimum setup, consists of a bot and RabbitMQ.

RabbitMQ can be set up locally using Docker. See the [docker compose file](../apps/bot/docker-compose.yml).

The bot is configured using environment variables. There are many different environment variables, some are required and some are optional. All environment variables can be found [here](https://github.com/tf2-automatic/tf2-automatic/blob/main/apps/bot/src/common/config/validation.ts).

As a minimum, you need to set the following environment variables:

- STEAM_USERNAME
- STEAM_PASSWORD
- STEAM_SHARED_SECRET
- STEAM_IDENTITY_SECRET
- RABBITMQ_HOST
- RABBITMQ_PORT
- RABBITMQ_USERNAME
- RABBITMQ_PASSWORD
- RABBITMQ_VHOST
- STORAGE_TYPE - Choose "local"
- STORAGE_LOCAL_PATH - Full path to folder with where files will be saved

A sample docker compose file can be found [here](../examples/minimum-setup/).

## Recommended setup

The recommended setup consists of one or more bots, the bot manager, Redis, RabbitMQ, and an S3 bucket.

A sample docker compose file can be found [here](../examples/recommended-setup/).
