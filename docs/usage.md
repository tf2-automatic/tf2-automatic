# Usage (WIP)

Using the system is relatively straight forward once it has been set up.

## APIs

Swagger is used to document the APIs. Run the application and go to `/docs` on the correct port, for example, `http://localhost:3000/docs`. Here you will see all API methods and examples on how to use them.

## Events

See [Events](./events.md) for a list of events. You can then create an application and queue that listens to the messages being published.

You can search for `.publish(` in the code base to find events being published.

An example for how to connect to a RabbitMQ server and listen to messages can be found [here](../exampleS/rabbitmq/).

## Types

If you are using TypeScript to create your applications, you can use the provided types and constants from the `bot-data` and `bot-manager-data` libraries.

An example can be found [here](../examples/bot-data-usage) for getting the inventory from a bot, using the bot-data types and constants.
