import pg from 'pg';
import { catalog } from '../src/data/catalog';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  if ((await c.query('SELECT count(*) FROM app.venues')).rows[0].count !== '0')
    throw new Error('Seed only accepts an empty catalog.');
  await c.query('BEGIN');
  for (const v of catalog.venues)
    await c.query(
      'INSERT INTO app.venues(id,name,short_name,area,kind,description,campus_x,campus_z,footprint_width,footprint_depth,published) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)',
      [
        v.id,
        v.name,
        v.shortName,
        v.area,
        v.kind,
        v.description,
        ...v.campusPosition,
        ...v.footprint,
      ],
    );
  for (const f of catalog.floors)
    await c.query(
      'INSERT INTO app.floors(id,venue_id,level,name,width,depth,elevation,layout_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [f.id, f.venueId, f.level, f.name, f.width, f.depth, f.elevation, f.layoutVersion],
    );
  for (const s of catalog.stalls) {
    await c.query(
      'INSERT INTO app.stalls(id,floor_id,name,category,x,z,rotation_y,width,depth) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        s.id,
        s.floorId,
        s.name,
        s.category,
        s.position.x,
        s.position.z,
        s.position.rotationY,
        s.position.width,
        s.position.depth,
      ],
    );
    for (const d of s.dishes)
      await c.query(
        'INSERT INTO app.dishes(stall_id,name,description,price_fen) VALUES($1,$2,$3,$4)',
        [s.id, d.name, d.description, d.price === null ? null : Math.round(d.price * 100)],
      );
  }
  await c.query('COMMIT');
  console.log('Demo data seeded (schematic, not verified).');
} catch (e) {
  await c.query('ROLLBACK');
  throw e;
} finally {
  await c.end();
}
