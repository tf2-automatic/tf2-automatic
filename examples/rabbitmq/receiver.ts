import amqp from 'amqp-connection-manager';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { BOT_EXCHANGE_NAME } from '@tf2-automatic/bot-data';
import { BOT_MANAGER_EXCHANGE_NAME } from '@tf2-automatic/bot-manager-data';

// The name of the queue to listen to
const QUEUE_NAME = 'all';

// A function to handle messages from the queue
function messageHandler(data: ConsumeMessage | null) {
  // Type says it can be null, so we need to check for that
  if (!data) {
    return;
  }

  // Wrap in a try catch to catch parsing errors
  try {
    // Parse the contents of the message
    const message = JSON.parse(data.content.toString());
    console.log(message);
  } catch (err) {
    console.log('Failed to parse message', err);
  } finally {
    channelWrapper.ack(data);
  }
}

// Create a new connection manager
const connection = amqp.connect(['amqp://test:test@localhost:5672']);

connection.on('connect', () => {
  console.log('Connected!');
});

connection.on('disconnect', (err) => {
  console.log('Disconnected', err);
});

connection.on('connectFailed', (err) => {
  console.log('Connection failed', err);
});

// Set up a channel listening for messages in the queue.
const channelWrapper = connection.createChannel({
  setup: async (channel: ConfirmChannel) => {
    // Assert the queue, so that it exists
    await channel.assertQueue(QUEUE_NAME);
    // Bind the queue to the exchanges with the routing key `*.*` to route
    // all messages from both exchanges to the queue
    await channel.bindQueue(QUEUE_NAME, BOT_EXCHANGE_NAME, '*.*');
    await channel.bindQueue(QUEUE_NAME, BOT_MANAGER_EXCHANGE_NAME, '*.*');
    // Only request 1 unacked message from queue
    await channel.prefetch(1);
    // Set up a consumer that handles messages from the queue
    await channel.consume(QUEUE_NAME, messageHandler);
  },
});

// Wait for a connection to be made
channelWrapper.waitForConnect().then(() => {
  console.log('Listening for messages');
});
