import { AddressInfo } from 'net';
import * as http from 'http';
import { S3StorageConfig } from '@tf2-automatic/config';
import { MAX_SOCKETS, S3StorageEngine } from './s3-storage.engine';

/**
 * steam-user emits one storage write per inventory asset, so a large account
 * fans out a thousand putObject calls at once. Given no transport agent, minio
 * falls back to Node's global agent (maxSockets:Infinity) and opens a socket
 * per call. On 2026-10-08 that burst crossed the object store's 1024 file
 * descriptor limit and wedged it for ten hours.
 *
 * So the thing worth pinning is not that an agent is configured, but that a
 * wide fan-out cannot open an unbounded number of connections.
 */
describe('S3StorageEngine connection pooling', () => {
  const WRITES = 200;

  let server: http.Server;
  let peakConnections = 0;
  let openConnections = 0;
  let totalConnections = 0;

  beforeAll((done) => {
    server = http.createServer((req, res) => {
      // Drain the body, otherwise the socket stalls and nothing completes.
      req.resume();
      // Hold briefly so the requests genuinely overlap rather than queueing
      // through a single reused socket.
      setTimeout(() => {
        if (req.url?.includes('location')) {
          res.writeHead(200, { 'Content-Type': 'application/xml' });
          res.end(
            '<?xml version="1.0" encoding="UTF-8"?><LocationConstraint>us-east-1</LocationConstraint>',
          );
        } else {
          res.writeHead(200, { etag: '"d41d8cd98f00b204e9800998ecf8427e"' });
          res.end();
        }
      }, 20);
    });

    server.on('connection', (socket) => {
      totalConnections++;
      openConnections++;
      peakConnections = Math.max(peakConnections, openConnections);
      socket.on('close', () => openConnections--);
    });

    server.listen(0, '127.0.0.1', done);
  });

  afterAll((done) => {
    server.closeAllConnections?.();
    server.close(done);
  });

  it('keeps concurrent connections bounded under a wide fan-out', async () => {
    const { port } = server.address() as AddressInfo;

    const engine = new S3StorageEngine({
      type: 's3',
      directory: 'bot',
      endpoint: '127.0.0.1',
      port,
      useSSL: false,
      bucket: 'tf2-automatic',
      accessKeyId: 'test',
      secretAccessKey: 'test',
    } as S3StorageConfig);

    await Promise.all(
      Array.from({ length: WRITES }, (_, i) =>
        engine.write(`assets/asset_440_${i}.json`, '{"n":' + i + '}'),
      ),
    );

    // Unbounded, this reaches WRITES. The +1 covers the bucket region lookup,
    // which minio issues before it has a cached region.
    expect(peakConnections).toBeLessThanOrEqual(MAX_SOCKETS + 1);
    expect(peakConnections).toBeLessThan(WRITES);

    // And they are pooled, not merely capped: keepAlive returns each socket to
    // the agent's free list, so the writes queued behind the cap reuse the same
    // connections instead of reconnecting. Without it this equals WRITES.
    expect(totalConnections).toBeLessThanOrEqual(MAX_SOCKETS + 1);
  }, 30000);
});
