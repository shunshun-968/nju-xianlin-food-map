import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
test('PostgreSQL privacy, referential integrity, uniqueness and maintenance guard',async()=>{
  assert(process.env.DATABASE_URL,'Use an isolated database, migrate and seed it first.');
  const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();
  try {
    await c.query('BEGIN');
    const user=(await c.query("INSERT INTO app.users(display_name) VALUES('integration-test') RETURNING id")).rows[0].id;
    const stall=(await c.query('SELECT id FROM app.stalls LIMIT 1')).rows[0].id;
    await c.query('INSERT INTO app.ratings(user_id,stall_id,score) VALUES($1,$2,5)',[user,stall]);
    await c.query('SAVEPOINT constraint_test');
    await assert.rejects(c.query('INSERT INTO app.ratings(user_id,stall_id,score) VALUES($1,$2,4)',[user,stall]),{code:'23505'});
    await c.query('ROLLBACK TO SAVEPOINT constraint_test');
    await assert.rejects(c.query('UPDATE app.ratings SET score=6 WHERE user_id=$1',[user]),{code:'23514'});
    await c.query('ROLLBACK TO SAVEPOINT constraint_test');
    await assert.rejects(c.query("INSERT INTO app.comments(user_id,stall_id,body) VALUES($1,'missing','test')",[user]),{code:'23503'});
    await c.query('ROLLBACK TO SAVEPOINT constraint_test');
    await c.query('SET LOCAL ROLE foodmap_reader');
    assert((await c.query('SELECT count(*)::int AS n FROM app.venues')).rows[0].n>0);
    await c.query('SAVEPOINT privilege_test');
    await assert.rejects(c.query('SELECT * FROM app.auth_identities'),{code:'42501'});
    await c.query('ROLLBACK TO SAVEPOINT privilege_test');
    await assert.rejects(c.query("INSERT INTO app.users(display_name) VALUES('blocked')"),{code:'42501'});
    await c.query('ROLLBACK TO SAVEPOINT privilege_test');
    await c.query('RESET ROLE');
    await c.query("UPDATE app.venues SET published=false WHERE id='v-456'");
    await c.query('SET LOCAL ROLE foodmap_reader');
    assert.equal((await c.query("SELECT count(*)::int AS n FROM app.stalls WHERE floor_id LIKE 'v-456-%'")).rows[0].n,0);
    await c.query('RESET ROLE');
    await c.query('UPDATE app.settings SET read_only=true');
    await c.query('SAVEPOINT maintenance_test');
    await assert.rejects(c.query("INSERT INTO app.comments(user_id,stall_id,body) VALUES($1,$2,'blocked')",[user,stall]),{code:'55000'});
    await c.query('ROLLBACK TO SAVEPOINT maintenance_test');
    await c.query('ROLLBACK');
  }finally{await c.end()}
});
