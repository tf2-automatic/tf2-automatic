import {
  INVENTORY_FULL_PATH,
  Inventory,
} from '@tf2-automatic/bot-data';
import axios from 'axios';

const baseUrl = 'http://localhost:3000';

// Construct url from bot-data constants
const url = `${baseUrl}${INVENTORY_FULL_PATH}`
  // Replace placeholders with actual values
  .replace(':steamid', '76561198120070906')
  .replace(':appid', '440')
  .replace(':contextid', '2');

// Results in "http://localhost:3000/inventories/76561198120070906/440/2"
console.log(url);

// Send request to get the inventory from the bot
axios.get<Inventory>(url).then((response) => {
  // The response is typed, so you can use IntelliSense to find the properties
  const inventory = response.data;

  // Logs the amount of items in the inventory and the name of the first item
  console.log(inventory.length);
  console.log(inventory[0].market_hash_name);
});
