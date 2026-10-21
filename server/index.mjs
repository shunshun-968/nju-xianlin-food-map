import { createServer } from 'node:http';
import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  statement_timeout: 5000,
});
const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim());
const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  if (origin && origins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  if (origin && !origins.includes(origin)) {
    res.writeHead(403);
    return res.end(JSON.stringify({ error: 'ORIGIN_DENIED' }));
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.writeHead(204);
    return res.end();
  }
  if (req.method !== 'GET') {
    res.writeHead(405);
    return res.end(JSON.stringify({ error: 'PHASE_0_READ_ONLY' }));
  }
  let c;
  try {
    c = await pool.connect();
    await c.query('BEGIN READ ONLY');
    await c.query('SET LOCAL ROLE foodmap_reader');
    const state = (await c.query('SELECT read_only FROM app.settings WHERE id=true')).rows[0];
    if (req.url === '/health') {
      await c.query('COMMIT');
      return res.end(JSON.stringify({ status: 'ok', readOnly: state.read_only, phase: 0 }));
    }
    if (req.url !== '/api/catalog') {
      await c.query('ROLLBACK');
      res.writeHead(404);
      return res.end(JSON.stringify({ error: 'NOT_FOUND' }));
    }
    const venues = (await c.query('SELECT * FROM app.venues ORDER BY id')).rows;
    const floors = (await c.query('SELECT * FROM app.floors ORDER BY venue_id,level')).rows;
    const stalls = (await c.query('SELECT * FROM app.stalls ORDER BY id')).rows;
    const dishes = (await c.query('SELECT * FROM app.dishes ORDER BY name')).rows;
    await c.query('COMMIT');
    res.end(
      JSON.stringify({
        version: 1,
        coordinateSystem: 'CAMPUS_SCHEMATIC_V1',
        readOnly: state.read_only,
        venues: venues.map((v) => ({
          id: v.id,
          name: v.name,
          shortName: v.short_name,
          area: v.area,
          kind: v.kind,
          description: v.description,
          campusPosition: [v.campus_x, v.campus_z],
          footprint: [v.footprint_width, v.footprint_depth],
          floors: floors.filter((f) => f.venue_id === v.id).length,
          verified: v.verified,
        })),
        floors: floors.map((f) => ({
          id: f.id,
          venueId: f.venue_id,
          level: f.level,
          name: f.name,
          width: f.width,
          depth: f.depth,
          elevation: f.elevation,
          layoutVersion: f.layout_version,
        })),
        stalls: stalls.map((s) => ({
          id: s.id,
          floorId: s.floor_id,
          name: s.name,
          category: s.category,
          position: { x: s.x, z: s.z, rotationY: s.rotation_y, width: s.width, depth: s.depth },
          photoKey: null,
          dishes: dishes
            .filter((d) => d.stall_id === s.id)
            .map((d) => ({
              name: d.name,
              price: d.price_fen === null ? null : d.price_fen / 100,
              description: d.description,
              photoKey: null,
            })),
        })),
      }),
    );
  } catch (error) {
    if (c) await c.query('ROLLBACK').catch(() => {});
    console.error('Database request failed:', error.code || 'unknown');
    res.writeHead(503);
    res.end(JSON.stringify({ error: 'SERVICE_UNAVAILABLE' }));
  } finally {
    c?.release();
  }
});
server.listen(Number(process.env.PORT || 8787), '0.0.0.0', () =>
  console.log('Foodmap read API ready'),
);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => server.close(() => pool.end().then(() => process.exit(0))));
