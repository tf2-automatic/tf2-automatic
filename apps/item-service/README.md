# item-service

The item service stores information about items, such as their prices, stock levels, and stock limits. It also tracks exchanges and maintains a history of bought and sold items. It integrates with the bot and bot-manager applications to monitor stock and trades.

## Features

- Tracks current item prices
- Monitors stock levels
- Keeps a list of items currently in offers to avoid offering the same item multiple times
- Records the history of bought and sold items
- Periodically updates TF2 schema definitions
- Integrates with bot and bot-manager applications to oversee stock and trading activities

## Prerequisites

The service needs a standalone Redis server or sentinel with `noeviction` memory policy and a Postgres server.

## Configuration

The manager is configured using the following environment variables:

- PORT
- REDIS_HOST
- REDIS_PORT
- REDIS_PASSWORD
- POSTGRES_HOST
- POSTGRES_PORT
- POSTGRES_PASSWORD
