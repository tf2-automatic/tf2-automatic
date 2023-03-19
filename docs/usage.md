# Usage (WIP)

Using the system is relatively straight forward once it has been set up.

## APIs

Swagger is used to document the APIs. Run the application and go to `/docs` on the correct port, for example, `http://localhost:3000/docs`. Here you will see all API methods and examples on how to use them.

## Events

You can search for `.publish(` in the code base to find events being published. You can then create an application and queue that listens to the messages being published.

## Types

If you are using TypeScript to create your applications, you can use the provided types and constants from the `bot-data` and `bot-manager-data` libraries.
