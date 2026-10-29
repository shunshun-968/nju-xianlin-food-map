import { createServer } from 'node:http';
import pg from 'pg';
import { createApiHandler } from './api.mjs';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 5000,
  statement_timeout: 5000,
});
const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim());
const server = createServer(createApiHandler({ pool, origins }));
server.listen(Number(process.env.PORT || 8787), '0.0.0.0', () =>
  console.log('Foodmap read API ready'),
);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => server.close(() => pool.end().then(() => process.exit(0))));
