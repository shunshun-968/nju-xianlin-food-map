import pg from 'pg';
const mode=process.argv[2];
if (!['on','off','status'].includes(mode)) throw new Error('Usage: npm run db:maintenance -- on|off|status');
const c=new pg.Client({connectionString:process.env.DATABASE_URL}); await c.connect();
try {
  if(mode!=='status') {
    await c.query('BEGIN');
    await c.query("SET LOCAL lock_timeout='30s'");
    await c.query('SELECT pg_advisory_xact_lock(781204)');
    await c.query('UPDATE app.settings SET read_only=$1 WHERE id=true',[mode==='on']);
    await c.query('COMMIT');
  }
  console.log((await c.query('SELECT read_only FROM app.settings')).rows[0]);
} finally { await c.end(); }
