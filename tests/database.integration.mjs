import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
assert.equal(
  process.env.FOODMAP_TEST_DATABASE,
  '1',
  'Set FOODMAP_TEST_DATABASE=1 only for an isolated disposable test database.',
);

test('seeded windows use their floor layout versions, including versions above one', async () => {
  const expected = JSON.parse(
    await readFile(new URL('../data/demo-catalog.json', import.meta.url), 'utf8'),
  );
  assert(expected.floors.some((floor) => floor.layoutVersion > 1));
  const versions = new Map(expected.floors.map((floor) => [floor.id, floor.layoutVersion]));
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    const { rows } = await c.query(
      'SELECT id, floor_id, layout_version FROM app.stalls ORDER BY id',
    );
    assert.deepEqual(
      rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
      expected.stalls
        .map((stall) => ({
          id: stall.id,
          floor_id: stall.floorId,
          layout_version: versions.get(stall.floorId),
        }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    );
  } finally {
    await c.end();
  }
});
test('PostgreSQL privacy, referential integrity, uniqueness and maintenance guard', async () => {
  assert(process.env.DATABASE_URL, 'Use an isolated database, migrate and seed it first.');
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    await c.query('BEGIN');
    const user = (
      await c.query("INSERT INTO app.users(display_name) VALUES('integration-test') RETURNING id")
    ).rows[0].id;
    const stall = (await c.query('SELECT id FROM app.stalls LIMIT 1')).rows[0].id;
    await c.query('INSERT INTO app.ratings(user_id,stall_id,score) VALUES($1,$2,5)', [user, stall]);
    await c.query('SAVEPOINT constraint_test');
    await assert.rejects(
      c.query('INSERT INTO app.ratings(user_id,stall_id,score) VALUES($1,$2,4)', [user, stall]),
      { code: '23505' },
    );
    await c.query('ROLLBACK TO SAVEPOINT constraint_test');
    await assert.rejects(c.query('UPDATE app.ratings SET score=6 WHERE user_id=$1', [user]), {
      code: '23514',
    });
    await c.query('ROLLBACK TO SAVEPOINT constraint_test');
    await assert.rejects(
      c.query("INSERT INTO app.comments(user_id,stall_id,body) VALUES($1,'missing','test')", [
        user,
      ]),
      { code: '23503' },
    );
    await c.query('ROLLBACK TO SAVEPOINT constraint_test');
    await c.query('SET LOCAL ROLE foodmap_reader');
    assert((await c.query('SELECT count(*)::int AS n FROM app.venues')).rows[0].n > 0);
    await c.query('SAVEPOINT privilege_test');
    await assert.rejects(c.query('SELECT * FROM app.auth_identities'), { code: '42501' });
    await c.query('ROLLBACK TO SAVEPOINT privilege_test');
    await assert.rejects(c.query("INSERT INTO app.users(display_name) VALUES('blocked')"), {
      code: '42501',
    });
    await c.query('ROLLBACK TO SAVEPOINT privilege_test');
    await c.query('RESET ROLE');
    await c.query("UPDATE app.venues SET published=false WHERE id='v-456'");
    await c.query('SET LOCAL ROLE foodmap_reader');
    assert.equal(
      (await c.query("SELECT count(*)::int AS n FROM app.stalls WHERE floor_id LIKE 'v-456-%'"))
        .rows[0].n,
      0,
    );
    await c.query('RESET ROLE');
    await c.query('UPDATE app.settings SET read_only=true');
    await c.query('SAVEPOINT maintenance_test');
    await assert.rejects(
      c.query("INSERT INTO app.comments(user_id,stall_id,body) VALUES($1,$2,'blocked')", [
        user,
        stall,
      ]),
      { code: '55000' },
    );
    await c.query('ROLLBACK TO SAVEPOINT maintenance_test');
    await c.query('ROLLBACK');
  } finally {
    await c.end();
  }
});

test('retain a complete synthetic user-content fixture for backup/restore rehearsal', async () => {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    await c.query('BEGIN');
    const user = (
      await c.query("INSERT INTO app.users(display_name) VALUES('备份演练虚构用户') RETURNING id")
    ).rows[0].id;
    const stall = (await c.query('SELECT id FROM app.stalls LIMIT 1')).rows[0].id;
    await c.query(
      "INSERT INTO app.auth_identities(provider,subject,user_id) VALUES('test-provider','synthetic-subject',$1)",
      [user],
    );
    const comment = (
      await c.query(
        "INSERT INTO app.comments(user_id,stall_id,body) VALUES($1,$2,'仅用于隔离 CI 恢复测试') RETURNING id",
        [user, stall],
      )
    ).rows[0].id;
    await c.query('INSERT INTO app.ratings(user_id,stall_id,score) VALUES($1,$2,4)', [user, stall]);
    await c.query(
      "INSERT INTO app.media(owner_id,storage_key,mime_type,bytes,sha256,width,height,comment_id) VALUES($1,'test/synthetic.webp','image/webp',1,$2,1,1,$3)",
      [user, '0'.repeat(64), comment],
    );
    await c.query(
      "INSERT INTO app.reports(reporter_id,comment_id,reason) VALUES($1,$2,'测试举报')",
      [user, comment],
    );
    await c.query(
      "INSERT INTO app.audit_log(actor_id,action,target_id) VALUES($1,'test_fixture',$2)",
      [user, comment],
    );
    await c.query('COMMIT');
  } catch (error) {
    await c.query('ROLLBACK');
    throw error;
  } finally {
    await c.end();
  }
});
