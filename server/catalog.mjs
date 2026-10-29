// 固定只读语句一次发送；保留 pg 原有列类型解析、排序和 foodmap_reader 权限。
export const catalogSql = `
BEGIN READ ONLY;
SET LOCAL ROLE foodmap_reader;
SELECT read_only FROM app.settings WHERE id=true;
SELECT * FROM app.venues ORDER BY id;
SELECT * FROM app.floors ORDER BY venue_id,level;
SELECT * FROM app.stalls ORDER BY id;
SELECT * FROM app.dishes ORDER BY name;
COMMIT;`;

const healthSql = `BEGIN READ ONLY;
SET LOCAL ROLE foodmap_reader;
SELECT read_only FROM app.settings WHERE id=true;
COMMIT;`;

async function readTransaction(pool, sql) {
  const client = await pool.connect();
  let releaseError;
  try {
    return await client.query(sql);
  } catch (error) {
    await client.query('ROLLBACK').catch((cause) => {
      releaseError = cause;
    });
    throw error;
  } finally {
    client.release(releaseError);
  }
}

export async function readHealth(pool) {
  const result = await readTransaction(pool, healthSql);
  return { status: 'ok', readOnly: result[2].rows[0].read_only, phase: 0 };
}

export async function readCatalog(pool) {
  const result = await readTransaction(pool, catalogSql);
  const state = result[2].rows[0];
  const venues = result[3].rows;
  const floors = result[4].rows;
  const stalls = result[5].rows;
  const dishes = result[6].rows;
  const floorCounts = new Map();
  const dishesByStall = new Map();
  for (const floor of floors)
    floorCounts.set(floor.venue_id, (floorCounts.get(floor.venue_id) || 0) + 1);
  for (const dish of dishes) {
    if (!dishesByStall.has(dish.stall_id)) dishesByStall.set(dish.stall_id, []);
    dishesByStall.get(dish.stall_id).push({
      name: dish.name,
      price: dish.price_fen === null ? null : dish.price_fen / 100,
      description: dish.description,
      photoKey: null,
    });
  }
  return {
    version: 1,
    coordinateSystem: venues[0]?.coordinate_system || 'CAMPUS_PLAN_V2',
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
      floors: floorCounts.get(v.id) || 0,
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
      dishes: dishesByStall.get(s.id) || [],
    })),
  };
}
