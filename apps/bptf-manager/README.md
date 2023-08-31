# bptf-manager

The backpack.tf manager is responsible for interacting with backpack.tf with the focus of managing listings. It is a standalone application that can be used as a replacement for directly managing listings using the backpack.tf APIs.

## Features

- Simple API for managing multiple accounts on backpack.tf
- Efficiently manage thousands of listings using [desired listings](#desired-listings)
- Ability to prioritize listings to be created before other listings
- Prioritizes updating listings over creating new listings to ensure listings are up to date
- Periodically gets listings from backpack.tf and ensures that they match the desired listings
- Handles listing errors when creating listings and retries if possible
- Repeatedly requests inventories to be refreshed until they are
- Uses the newest backpack.tf APIs

## Desired listings

A desired listing is a listing that you want to create on backpack.tf. It can be very tedious to manage listings on backpack.tf. Instead of you manually creating and deleting listings on backpack.tf, you create and delete desired listings. The manager creates and deletes the listings on backpack.tf for you based on your desired listings.

A desired listing contains the raw listing object that will be sent to backpack.tf to create a listing. It is important to note that the manager does not validate the raw listing objects, it simply attempts to create it using the backpack.tf API and keeps track of the results; be it a new listing, or an error. Because of this, it is very easy to modify existing programs to use the manager and its APIs instead of directly using the backpack.tf APIs.

The manager never deletes desired listings unless you tell it to using the API. This means that if you create a desired listing for an item you would like to sell, then you need to tell the manager to delete the desired listing when you sell the item.

A desired listing is internally id'd using a hash of either the item object for buy listings or the item id for sell listings. The item object, or item id, is used as the id for a desired listing. This means that you don't need to keep track of new ids to manage the listings.

## Prerequisites

The manager needs a standalone Redis server or sentinel with `noeviction` memory policy.

## Configuration

The manager is configured using the following environment variables:

- PORT
- REDIS_HOST
- REDIS_PORT
- REDIS_PASSWORD

## Examples

See the [examples](./examples/) folder.
