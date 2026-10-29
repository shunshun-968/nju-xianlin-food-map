import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { brotliCompress, gzip, constants } from 'node:zlib';
import { readCatalog, readHealth } from './catalog.mjs';

const encodeBrotli = promisify(brotliCompress);
const encodeGzip = promisify(gzip);

function encodingFor(header = '') {
  const accepted = new Map(
    header.split(',').map((entry) => {
      const [name, ...parameters] = entry.trim().toLowerCase().split(';');
      const quality = parameters.find((parameter) => parameter.trim().startsWith('q='));
      const q = quality ? Number(quality.trim().slice(2)) : 1;
      return [name, Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0];
    }),
  );
  const quality = (name) => accepted.get(name) ?? accepted.get('*') ?? 0;
  const br = quality('br'),
    gz = quality('gzip');
  if ((accepted.get('identity') ?? 0) > Math.max(br, gz)) return undefined;
  if (br > 0 && br >= gz) return 'br';
  if (gz > 0) return 'gzip';
  if ((accepted.get('identity') ?? accepted.get('*')) === 0) return null;
  return undefined;
}

/** 目录每次重新读取数据库；只共享正在进行的请求，不用 TTL 缓存旧菜单或维护状态。 */
export function createApiHandler({ pool, origins, logError = console.error }) {
  let pending;
  let last;
  function currentCatalog() {
    if (pending) return pending;
    pending = readCatalog(pool)
      .then((catalog) => {
        const body = Buffer.from(JSON.stringify(catalog));
        const etag = `W/"${createHash('sha256').update(body).digest('base64url')}"`;
        if (last?.etag === etag) return last;
        last = { body, etag, encoded: new Map() };
        return last;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  }
  return async (req, res) => {
    const origin = req.headers.origin;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');
    if (origin && origins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
    const error = (status, code) => {
      res.writeHead(status);
      res.end(JSON.stringify({ error: code }));
    };
    if (origin && !origins.includes(origin)) return error(403, 'ORIGIN_DENIED');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
      res.writeHead(204);
      return res.end();
    }
    if (req.method !== 'GET') return error(405, 'PHASE_0_READ_ONLY');
    if (req.url !== '/health' && req.url !== '/api/catalog') return error(404, 'NOT_FOUND');
    const encoding = encodingFor(req.headers['accept-encoding']);
    if (req.url === '/api/catalog' && encoding === null)
      return error(406, 'ENCODING_NOT_ACCEPTABLE');
    try {
      if (req.url === '/health') return res.end(JSON.stringify(await readHealth(pool)));
      const catalog = await currentCatalog();
      res.setHeader('Cache-Control', 'private, no-cache');
      res.setHeader('Vary', 'Origin, Accept-Encoding');
      res.setHeader('ETag', catalog.etag);
      const tags = req.headers['if-none-match']
        ?.split(',')
        .map((tag) => tag.trim().replace(/^W\//, ''));
      if (tags?.includes('*') || tags?.includes(catalog.etag.slice(2))) {
        res.writeHead(304);
        return res.end();
      }
      let body = catalog.body;
      if (encoding) {
        if (!catalog.encoded.has(encoding)) {
          const compressed =
            encoding === 'br'
              ? encodeBrotli(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } })
              : encodeGzip(body, { level: 6 });
          catalog.encoded.set(
            encoding,
            compressed.catch((cause) => {
              catalog.encoded.delete(encoding);
              throw cause;
            }),
          );
        }
        body = await catalog.encoded.get(encoding);
        res.setHeader('Content-Encoding', encoding);
      }
      res.setHeader('Content-Length', body.length);
      res.end(body);
    } catch (cause) {
      logError('Database request failed:', cause.code || 'unknown');
      res.setHeader('Cache-Control', 'no-store');
      res.removeHeader('ETag');
      return error(503, 'SERVICE_UNAVAILABLE');
    }
  };
}
