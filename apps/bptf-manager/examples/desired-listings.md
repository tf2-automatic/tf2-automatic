# Managing desired listings

The following code is an example of how to manage desired listings with TypeScript and Axios.

```ts
import axios from 'axios';
import { DesiredListing } from '@tf2-automatic/bptf-manager-data';

const host = 'http://localhost:3000';

const steamid64 = '76561198120070906';

// Create 3 desired listings (updates them if they already exist)
await axios.post(`${host}/listings/${steamid64}/desired`, [
  // Creates a buy listing for a Mann Co. Supply Crate Key for 50.11 refined with the highest priority.
  {
    listing: {
      item: {
        defindex: 5021,
        quality: 6,
      },
      details: 'Buying keys for 50.11 refined!',
      currencies: {
        metal: 50.11,
      },
    },
    priority: 1,
  },
  // Creates a buy listing for a Burning Flames Team Captain for 100 keys
  {
    listing: {
      item: {
        defindex: 378,
        quality: 5,
        attributes: [
          {
            defindex: 134,
            float_value: 13,
          },
        ],
      },
      currencies: {
        keys: 100,
      },
    },
  },
  // Creates a sell listing for an item with the assetid "1234567890" for 1 key
  {
    listing: {
      id: '1234567890',
      details: 'Selling this item for 1 key!',
      currencies: {
        keys: 1,
      },
    },
  },
]);

// Get a list of all desired listings
const desired = await axios.get<DesiredListing[]>(`${host}/listings/${steamid64}/desired`).then((response) => response.data);

// Delete the 3 desired listings from above
await axios.delete(`${host}/listings/${steamid64}/desired`, {
  data: [
    {
      item: {
        defindex: 5021,
        quality: 6,
      },
    },
    {
      item: {
        defindex: 378,
        quality: 5,
        attributes: [
          {
            defindex: 134,
            float_value: 13,
          },
        ],
      },
    },
    {
      id: '1234567890',
    },
  ],
});
```
