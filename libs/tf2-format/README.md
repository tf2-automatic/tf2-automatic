# tf2-format

This is a standard library for working with different formats in Team Fortress 2. It is designed with speed and interoperability in mind, and it is a many times faster than alternatives.

## Why another library?

I created this library because I needed fast, simple, and reliable handling of different formats in Team Fortress 2. Other libraries are slow, complicated, and rely heavily on hard-coded values. This library can parse different formats into a single common format.

## Guides

This library is organized into different classes, each made for working with specific formats. By separating functionality this way, you can easily find and work with the format you need without unnecessary complexity.

### Item parsing

For parsing items, e.g. econ items from inventories and trades, or TF2 items from the TF2 GC ([node-tf2](https://github.com/DoctorMckay/node-tf2)), use one of the implementations of the `Parser` class. For parsing econ items, use the [EconParser](./src/lib/parsing/econ) class. For parsing tf2 items, use the [TF2Parser](./src/lib/parsing/tf2) class.

### SKU

For working with SKUs, use the [SKU](./src/lib/sku) class.
