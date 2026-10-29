import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { gunzipSync, brotliDecompressSync } from 'node:zlib';
import { createApiHandler } from '../server/api.mjs';
import { catalogSql, readCatalog } from '../server/catalog.mjs';

function fixture() {
  const state = { read_only: false };
  const venues = [
    {
      id: 'venue',
      name: '食堂',
      short_name: '食堂',
      area: '校园',
      kind: 'canteen',
      description: '原说明',
      campus_x: 1,
      campus_z: 2,
      footprint_width: 3,
      footprint_depth: 4,
      verified: true,
      coordinate_system: 'CAMPUS_PLAN_V2',
    },
  ];
  const floors = [
    {
      id: 'floor',
      venue_id: 'venue',
      level: 1,
      name: '一层',
      width: 20,
      depth: 30,
      elevation: 0,
      layout_version: 7,
    },
  ];
  const stalls = [
    {
      id: 'stall',
      floor_id: 'floor',
      name: '窗口',
      category: '面食',
      x: 1,
      z: 2,
      rotation_y: 0,
      width: 3,
      depth: 2,
    },
  ];
  const dishes = Array.from({ length: 120 }, (_, i) => ({
    stall_id: 'stall',
    name: `菜品${i}`,
    price_fen: i ? 1250 : null,
    description: '现场菜单原始内容，保持完整。',
  }));
  const queries: string[] = [];
  let connects = 0,
    releases = 0;
  let gate: Promise<void> | undefined;
  let fail = false;
  const pool = {
    connect: async () => {
      connects++;
      return {
        query: async (sql: string) => {
          queries.push(sql);
          if (sql === 'ROLLBACK') return {};
          if (gate) await gate;
          if (fail) throw Object.assign(new Error('Database unavailable'), { code: '08006' });
          const result = [{ rows: [] }, { rows: [] }, { rows: [state] }];
          return sql === catalogSql
            ? [
                ...result,
                { rows: venues },
                { rows: floors },
                { rows: stalls },
                { rows: dishes },
                { rows: [] },
              ]
            : [...result, { rows: [] }];
        },
        release: () => {
          releases++;
        },
      };
    },
  };
  return {
    state,
    venues,
    floors,
    stalls,
    dishes,
    pool,
    queries,
    counts: () => ({ connects, releases }),
    setGate: (value: Promise<void>) => {
      gate = value;
    },
    setFailure: (value: boolean) => {
      fail = value;
    },
  };
}

async function serve(
  f: ReturnType<typeof fixture>,
  run: (get: Function, server: EventEmitter) => Promise<void>,
) {
  // Exercise the same HTTP handler and encoded bytes without requiring a local TCP permission.
  const server = new EventEmitter();
  const handler = createApiHandler({
    pool: f.pool,
    origins: ['https://allowed.example'],
    logError: () => {},
  });
  const get = (path = '/api/catalog', headers = {}, method = 'GET') =>
    new Promise<any>((resolve, reject) => {
      const req = {
        url: path,
        method,
        headers: Object.fromEntries(
          Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
        ),
      };
      const responseHeaders: Record<string, unknown> = {};
      let status = 200;
      const res = {
        setHeader: (name: string, value: unknown) => {
          responseHeaders[name.toLowerCase()] = value;
        },
        removeHeader: (name: string) => {
          delete responseHeaders[name.toLowerCase()];
        },
        writeHead: (code: number) => {
          status = code;
        },
        end: (body?: Buffer | string) =>
          resolve({ status, headers: responseHeaders, body: Buffer.from(body ?? '') }),
      };
      void handler(req, res).catch(reject);
      server.emit('request');
    });
  await run(get, server);
}

test('catalog batches its read-only database transaction and preserves values, order and empty relations', async () => {
  const f = fixture();
  f.stalls.push({ ...f.stalls[0], id: 'empty' });
  const result = await readCatalog(f.pool);
  assert.equal(f.queries.length, 1);
  assert.match(f.queries[0], /BEGIN READ ONLY;\s*SET LOCAL ROLE foodmap_reader;/);
  assert.equal(result.venues[0].floors, 1);
  assert.deepEqual(result.venues[0].campusPosition, [1, 2]);
  assert.equal(result.floors[0].layoutVersion, 7);
  assert.equal(result.stalls[0].dishes[0].price, null);
  assert.equal(result.stalls[0].dishes[1].price, 12.5);
  assert.equal(result.stalls[0].dishes[119].name, '菜品119');
  assert.deepEqual(result.stalls[1].dishes, []);
  assert.deepEqual(f.counts(), { connects: 1, releases: 1 });
});

test('cold catalog responses negotiate gzip/Brotli without changing any response bytes', async () => {
  const f = fixture();
  await serve(f, async (get) => {
    const plain = await get();
    const gz = await get('/api/catalog', { 'Accept-Encoding': 'gzip' });
    const br = await get('/api/catalog', { 'Accept-Encoding': 'gzip;q=0.5, br' });
    assert.equal(gz.headers['content-encoding'], 'gzip');
    assert.equal(br.headers['content-encoding'], 'br');
    assert.deepEqual(gunzipSync(gz.body), plain.body);
    assert.deepEqual(brotliDecompressSync(br.body), plain.body);
    assert.ok(gz.body.length < plain.body.length * 0.3);
    assert.ok(br.body.length < plain.body.length * 0.3);
    const identity = await get('/api/catalog', { 'Accept-Encoding': 'gzip;q=0, br;q=0' });
    assert.equal(identity.headers['content-encoding'], undefined);
    assert.deepEqual(identity.body, plain.body);
    assert.equal((await get('/api/catalog', { 'Accept-Encoding': '*;q=0' })).status, 406);
  });
});

test('ETag revalidation reads fresh database state and never serves a stale maintenance flag or failed read', async () => {
  const f = fixture();
  await serve(f, async (get) => {
    const first = await get();
    assert.equal(first.headers['cache-control'], 'private, no-cache');
    const same = await get('/api/catalog', { 'If-None-Match': first.headers.etag });
    assert.equal(same.status, 304);
    assert.equal(same.body.length, 0);
    assert.equal(f.counts().connects, 2, 'revalidation is backed by a new database read');
    f.state.read_only = true;
    f.dishes[1].price_fen = 1300;
    const changed = await get('/api/catalog', { 'If-None-Match': first.headers.etag });
    assert.equal(changed.status, 200);
    assert.notEqual(changed.headers.etag, first.headers.etag);
    assert.equal(JSON.parse(changed.body).readOnly, true);
    assert.equal(JSON.parse(changed.body).stalls[0].dishes[1].price, 13);
    f.setFailure(true);
    const failed = await get('/api/catalog', { 'If-None-Match': changed.headers.etag });
    assert.equal(failed.status, 503);
    assert.equal(failed.headers['cache-control'], 'no-store');
    assert.equal(failed.headers.etag, undefined);
    assert.equal(f.queries.at(-1), 'ROLLBACK');
    f.setFailure(false);
    assert.equal((await get()).status, 200);
    assert.equal(f.counts().connects, f.counts().releases);
  });
});

test('simultaneous catalog requests share only the in-flight read, not subsequent fresh reads', async () => {
  const f = fixture();
  let finish!: () => void;
  f.setGate(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  await serve(f, async (get, server) => {
    let received = 0;
    let both!: () => void;
    const arriving = new Promise<void>((resolve) => {
      both = resolve;
    });
    server.on('request', () => {
      if (++received === 2) both();
    });
    const first = get(),
      second = get();
    await arriving;
    assert.equal(f.counts().connects, 1);
    finish();
    const [a, b] = await Promise.all([first, second]);
    assert.deepEqual(a.body, b.body);
    await get();
    assert.equal(f.counts().connects, 2);
  });
});

test('CORS, readonly methods and unknown routes are rejected before opening a database connection', async () => {
  const f = fixture();
  await serve(f, async (get) => {
    assert.equal((await get('/missing')).status, 404);
    assert.equal((await get('/api/catalog', {}, 'POST')).status, 405);
    assert.equal((await get('/api/catalog', { Origin: 'https://denied.example' })).status, 403);
    assert.equal(
      (await get('/api/catalog', { Origin: 'https://allowed.example' }, 'OPTIONS')).status,
      204,
    );
    assert.equal(f.counts().connects, 0);
    const allowed = await get('/api/catalog', { Origin: 'https://allowed.example' });
    assert.equal(allowed.headers['access-control-allow-origin'], 'https://allowed.example');
    assert.equal(allowed.headers.vary, 'Origin, Accept-Encoding');
    const health = await get('/health');
    assert.equal(health.headers['cache-control'], 'no-store');
    assert.deepEqual(JSON.parse(health.body), { status: 'ok', readOnly: false, phase: 0 });
  });
});
