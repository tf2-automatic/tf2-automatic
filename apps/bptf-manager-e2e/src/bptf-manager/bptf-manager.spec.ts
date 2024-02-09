import axios, { HttpStatusCode } from 'axios';

const steamid = '76561198120070906';

describe('Tokens', () => {
  afterEach(async () => {
    const steamids = await axios.get(`/tokens`).then((res) => res.data);

    if (steamids.length === 0) {
      return;
    }

    await Promise.all(
      steamids.map((steamid64) => axios.delete(`/tokens/${steamid64}`)),
    );
  });

  describe('POST /tokens', () => {
    it('should fail when invalid body', async () => {
      const res = await axios.post(`/tokens`, 'abc123');

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should fail when missing properties', async () => {
      const res = await axios.post(`/tokens`, {});

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should add a token', async () => {
      const res = await axios.post(`/tokens`, {
        steamid64: steamid,
        value: 'abc123',
      });

      expect(res.status).toBe(HttpStatusCode.Created);
    });
  });

  describe('GET /tokens', () => {
    it('should return no tokens', async () => {
      const res = await axios.get(`/tokens`);

      expect(res.status).toBe(HttpStatusCode.Ok);
      expect(res.data).toEqual([]);
    });

    it('should return added token', async () => {
      await axios.post(`/tokens`, {
        steamid64: steamid,
        value: 'abc123',
      });

      const res = await axios.get(`/tokens`);

      expect(res.status).toBe(HttpStatusCode.Ok);
      expect(res.data).toEqual([steamid]);
    });
  });

  describe('DELETE /tokens/:steamid', () => {
    it('should fail when invalid steamid', async () => {
      const res = await axios.delete(`/tokens/1234`);

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should remove a token', async () => {
      await axios.post(`/tokens`, {
        steamid64: steamid,
        value: 'abc123',
      });

      const res = await axios.delete(`/tokens/${steamid}`);

      expect(res.status).toBe(HttpStatusCode.Ok);
    });
  });
});

describe('Agents', () => {
  afterEach(async () => {
    const agents = await axios.get(`/agents`).then((res) => res.data);

    if (agents.length === 0) {
      return;
    }

    await Promise.all(
      agents.map((agent) =>
        axios.post(`/agents/${agent.steamid64}/unregister`),
      ),
    );
  });

  describe('POST /agents/:steamid/register', () => {
    it('should fail when invalid steamid', async () => {
      const res = await axios.post(`/agents/1234/register`);

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should add an agent', async () => {
      const res = await axios.post(`/agents/${steamid}/register`);

      expect(res.status).toBe(HttpStatusCode.Ok);
      expect(res.data).toEqual({
        steamid64: steamid,
        userAgent: null,
        updatedAt: expect.any(Number),
      });
    });
  });

  describe('GET /agents', () => {
    it('should return no agents', async () => {
      const res = await axios.get(`/agents`);

      expect(res.status).toBe(HttpStatusCode.Ok);
      expect(res.data).toEqual([]);
    });

    it('should return added agent', async () => {
      const res = await axios.post(`/agents/${steamid}/register`);

      const res2 = await axios.get(`/agents`);

      expect(res2.status).toBe(HttpStatusCode.Ok);
      expect(res2.data).toEqual([res.data]);
    });
  });

  describe('POST /agents/:steamid/unregister', () => {
    it('should fail when invalid steamid', async () => {
      const res = await axios.post(`/agents/1234/unregister`);

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should remove an agent', async () => {
      await axios.post(`/agents/${steamid}/register`);

      const res = await axios.post(`/agents/${steamid}/unregister`);
      expect(res.status).toBe(HttpStatusCode.Ok);

      const res2 = await axios.get(`/agents`);
      expect(res2.data).toEqual([]);
    });
  });
});

describe('Desired listings', () => {
  afterEach(async () => {
    const desired = await axios
      .get(`/listings/${steamid}/desired`)
      .then((res) => res.data);

    if (desired.length === 0) {
      return;
    }

    await axios.delete(`/listings/${steamid}/desired`, {
      data: desired.map((d) => ({ hash: d.hash })),
    });
  });

  describe('POST /listings/:steamid/desired', () => {
    it('should fail when invalid steamid', async () => {
      const res = await axios.post(`/listings/1234/desired`, {
        id: '1234',
        currencies: {
          keys: 1,
        },
      });

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should fail when invalid body', async () => {
      const res = await axios.post(`/listings/${steamid}/desired`, 'abc123');

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should fail when missing id and item', async () => {
      const res = await axios.post(`/listings/${steamid}/desired`, [
        {
          listing: {
            currencies: {
              keys: 1,
            },
          },
        },
      ]);

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should fail when missing currencies', async () => {
      const res = await axios.post(`/listings/${steamid}/desired`, [
        {
          listing: {
            id: '1234',
          },
        },
      ]);

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should fail when invalid currencies', async () => {
      const res = await axios.post(`/listings/${steamid}/desired`, [
        {
          listing: {
            id: '1234',
            currencies: {},
          },
        },
      ]);

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should add desired listings', async () => {
      const res = await axios.post(`/listings/${steamid}/desired`, [
        {
          listing: {
            id: '1234',
            currencies: {
              keys: 1,
            },
          },
        },
      ]);

      expect(res.status).toBe(HttpStatusCode.Created);
      expect(res.data).toEqual([
        {
          hash: 'ccb2036e25f8590fec7cdfbb5269406f8267f322',
          id: null,
          listing: {
            id: '1234',
            currencies: {
              keys: 1,
            },
          },
          steamid64: steamid,
          updatedAt: expect.any(Number),
        },
      ]);
    });

    it('should overwrite an existing desired listing', async () => {
      const res = await axios.post(`/listings/${steamid}/desired`, [
        {
          listing: {
            id: '1234',
            currencies: {
              keys: 1,
            },
            details: 'abc123',
          },
        },
      ]);

      const res2 = await axios.post(`/listings/${steamid}/desired`, [
        {
          listing: {
            id: '1234',
            currencies: {
              keys: 2,
            },
          },
        },
      ]);

      expect(res2.status).toBe(HttpStatusCode.Created);
      expect(res2.data).toEqual([
        {
          hash: res.data[0].hash,
          id: null,
          listing: {
            id: '1234',
            currencies: {
              keys: 2,
            },
          },
          steamid64: steamid,
          updatedAt: expect.any(Number),
        },
      ]);
    });
  });

  describe('GET /listings/:steamid/desired', () => {
    it('should fail when invalid steamid', async () => {
      const res = await axios.get(`/listings/1234/desired`);

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should return an empty list', async () => {
      const res = await axios.get(`/listings/${steamid}/desired`);

      expect(res.status).toBe(HttpStatusCode.Ok);
      expect(res.data).toEqual([]);
    });

    it('should get desired listings', async () => {
      await axios.post(`/listings/${steamid}/desired`, [
        {
          listing: {
            id: '1234',
            currencies: {
              keys: 1,
            },
          },
        },
      ]);

      const res = await axios.get(`/listings/${steamid}/desired`);

      expect(res.status).toBe(HttpStatusCode.Ok);
      expect(res.data).toEqual([
        {
          hash: 'ccb2036e25f8590fec7cdfbb5269406f8267f322',
          id: null,
          listing: {
            id: '1234',
            currencies: {
              keys: 1,
            },
          },
          steamid64: steamid,
          updatedAt: expect.any(Number),
        },
      ]);
    });
  });

  describe('DELETE /listings/:steamid/desired', () => {
    it('should fail when invalid steamid', async () => {
      const res = await axios.post(`/listings/1234/desired`);

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should fail when invalid body', async () => {
      const res = await axios.delete(`/listings/${steamid}/desired`, {
        data: 'abc123',
      });

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should fail when missing hash, id, and item', async () => {
      const res = await axios.delete(`/listings/${steamid}/desired`, {
        data: [{}],
      });

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should remove desired listings that does not exist', async () => {
      const res = await axios.delete(`/listings/${steamid}/desired`, {
        data: [{ hash: 'abc123' }],
      });

      expect(res.status).toBe(HttpStatusCode.Ok);
    });

    it('should remove desired listings by hash', async () => {
      const res = await axios.post(`/listings/${steamid}/desired`, [
        {
          listing: {
            id: '1234',
            currencies: {
              keys: 1,
            },
          },
        },
      ]);

      const res2 = await axios.delete(`/listings/${steamid}/desired`, {
        data: [{ hash: res.data[0].hash }],
      });

      expect(res2.status).toBe(HttpStatusCode.Ok);
      expect(res2.data).toStrictEqual(res.data);
    });

    it('should remove desired listings by id', async () => {
      const res = await axios.post(`/listings/${steamid}/desired`, [
        {
          listing: {
            id: '1234',
            currencies: {
              keys: 1,
            },
          },
        },
      ]);

      const res2 = await axios.delete(`/listings/${steamid}/desired`, {
        data: [{ id: '1234' }],
      });

      expect(res2.status).toBe(HttpStatusCode.Ok);
      expect(res2.data).toStrictEqual(res.data);
    });

    it('should remove desired listings by item', async () => {
      const res = await axios.post(`/listings/${steamid}/desired`, [
        {
          listing: {
            item: {},
            currencies: {
              keys: 1,
            },
          },
        },
      ]);

      const res2 = await axios.delete(`/listings/${steamid}/desired`, {
        data: [{ item: {} }],
      });

      expect(res2.status).toBe(HttpStatusCode.Ok);
      expect(res2.data).toStrictEqual(res.data);
    });
  });
});

describe('Current listings', () => {
  describe('GET /listings/:steamid/current', () => {
    it('should fail when invalid steamid', async () => {
      const res = await axios.get(`/listings/1234/current`);

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should return an empty list', async () => {
      const res = await axios.get(`/listings/${steamid}/current`);

      expect(res.status).toBe(HttpStatusCode.Ok);
      expect(res.data).toEqual([]);
    });

    it('should queue listings to be refreshed', async () => {
      const res = await axios.post(`/listings/${steamid}/current/refresh`);

      expect(res.status).toBe(HttpStatusCode.Created);
    });
  });
});

describe('Listing limits', () => {
  describe('GET /listings/:steamid/limits', () => {
    it('should fail when invalid steamid', async () => {
      const res = await axios.get(`/listings/1234/limits`);

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should return no limits', async () => {
      const res = await axios.get(`/listings/${steamid}/limits`);

      expect(res.status).toBe(HttpStatusCode.NotFound);
    });
  });

  describe('POST /listings/:steamid/limits/refresh', () => {
    it('should fail when invalid steamid', async () => {
      const res = await axios.post(`/listings/1234/limits/refresh`);

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should queue limits to be refreshed', async () => {
      const res = await axios.post(`/listings/${steamid}/limits/refresh`);

      expect(res.status).toBe(HttpStatusCode.Created);
    });
  });
});

describe('Inventories', () => {
  beforeEach(async () => {
    await axios.delete(`/inventories/${steamid}/refresh`);
  });

  describe('GET /inventories/:steamid/status', () => {
    it('should fail when invalid steamid', async () => {
      const res = await axios.get(`/inventories/1234/status`);

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should return no status', async () => {
      const res = await axios.get(`/inventories/${steamid}/status`);

      expect(res.status).toBe(HttpStatusCode.NotFound);
    });
  });

  describe('POST /inventories/:steamid/refresh', () => {
    it('should fail when invalid steamid', async () => {
      const res = await axios.post(`/inventories/1234/refresh`);

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should queue inventory to be refreshed', async () => {
      const res = await axios.post(`/inventories/${steamid}/refresh`);

      expect(res.status).toBe(HttpStatusCode.Ok);
    });
  });

  describe('DELETE /inventories/:steamid/refresh', () => {
    it('should fail when invalid steamid', async () => {
      const res = await axios.delete(`/inventories/1234/refresh`);

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should remove inventory refresh', async () => {
      await axios.post(`/inventories/${steamid}/refresh`);

      const res = await axios.delete(`/inventories/${steamid}/refresh`);

      expect(res.status).toBe(HttpStatusCode.Ok);
    });
  });
});

describe('Notifications', () => {
  describe('GET /notifications/:steamid', () => {
    it('should fail when invalid steamid', async () => {
      const res = await axios.get(`/notifications/1234`);

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should return no notifications', async () => {
      const res = await axios.get(`/notifications/${steamid}`);

      expect(res.status).toBe(HttpStatusCode.Ok);
      expect(res.data).toEqual([]);
    });
  });

  describe('POST /notifications/:steamid/refresh', () => {
    it('should fail when invalid steamid', async () => {
      const res = await axios.post(`/notifications/1234/refresh`);

      expect(res.status).toBe(HttpStatusCode.BadRequest);
    });

    it('should queue notifications to be refreshed', async () => {
      const res = await axios.post(`/notifications/${steamid}/refresh`);

      expect(res.status).toBe(HttpStatusCode.Created);
    });
  });
});
