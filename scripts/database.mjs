// Backup/restore requires pg_dump and pg_restore of the source major version or newer.
import pg from 'pg';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
const [command, supplied] = process.argv.slice(2);
if (!['backup', 'restore', 'verify'].includes(command))
  throw new Error('Usage: database.mjs backup|restore|verify <directory>');
const directory = resolve(supplied || `backups/${new Date().toISOString().replace(/[:.]/g, '-')}`);
if (command !== 'backup' && !supplied)
  throw new Error('Restore/verify requires an explicit backup directory.');
const connectionString = process.env.DATABASE_URL;
const env = { ...process.env };
// Credentials only enter subprocess environment, never command arguments or logs.
if (connectionString) {
  const url = new URL(connectionString);
  Object.assign(env, {
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
  });
  if (url.searchParams.get('sslmode')) env.PGSSLMODE = url.searchParams.get('sslmode');
}
const client = new pg.Client({ connectionString });
await client.connect();
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function run(binary, args) {
  const result = spawnSync(binary, args, { env, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (result.error) throw new Error(`${binary} unavailable; install PostgreSQL client tools.`);
  if (result.status !== 0)
    throw new Error(
      `${binary} failed: ${result.stderr.replaceAll(env.PGPASSWORD || '__none__', '[redacted]')}`,
    );
}
async function fingerprint() {
  const tables = (
    await client.query("SELECT tablename FROM pg_tables WHERE schemaname='app' ORDER BY tablename")
  ).rows;
  const output = {};
  for (const { tablename } of tables) {
    if (!/^[a-z_]+$/.test(tablename)) throw new Error('Unexpected table name');
    // Deterministic JSONB per-row digests; suitable for the initial small dataset.
    const row = (
      await client.query(
        `SELECT count(*)::int AS count, md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text),'')) AS checksum FROM app."${tablename}" t`,
      )
    ).rows[0];
    output[tablename] = row;
  }
  return output;
}
try {
  if (command === 'backup') {
    await mkdir(dirname(directory), { recursive: true, mode: 0o700 });
    await mkdir(directory, { recursive: false, mode: 0o700 });
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshot = (await client.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
    run('pg_dump', [
      '--format=custom',
      '--no-owner',
      '--no-acl',
      '--schema=app',
      `--snapshot=${snapshot}`,
      `--file=${join(directory, 'app.dump')}`,
    ]);
    const manifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      serverVersion: (await client.query('SHOW server_version')).rows[0].server_version,
      sha256: hash(await readFile(join(directory, 'app.dump'))),
      tables: await fingerprint(),
      migrations: (await client.query('SELECT * FROM public.foodmap_migrations ORDER BY version'))
        .rows,
    };
    await client.query('COMMIT');
    await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), {
      mode: 0o600,
    });
    console.log(
      `Backup complete: ${directory}. Includes app users/identity mappings, not provider password hashes or image bytes.`,
    );
  } else {
    const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
    if (
      manifest.version !== 1 ||
      hash(await readFile(join(directory, 'app.dump'))) !== manifest.sha256
    )
      throw new Error('Backup checksum or version mismatch');
    if (command === 'restore') {
      if (process.env.RESTORE_TO_EMPTY !== '1')
        throw new Error('Set RESTORE_TO_EMPTY=1 after selecting a NEW empty target database.');
      if ((await client.query("SELECT to_regnamespace('app') AS present")).rows[0].present)
        throw new Error('Target contains app schema; refusing to overwrite.');
      run('pg_restore', [
        '--exit-on-error',
        '--single-transaction',
        '--no-owner',
        '--no-acl',
        '--dbname',
        env.PGDATABASE || 'postgres',
        join(directory, 'app.dump'),
      ]);
      await client.query('BEGIN');
      await client.query(
        'CREATE TABLE public.foodmap_migrations(version text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL)',
      );
      for (const m of manifest.migrations)
        await client.query('INSERT INTO public.foodmap_migrations VALUES($1,$2,$3)', [
          m.version,
          m.sha256,
          m.applied_at,
        ]);
      await client.query('REVOKE ALL ON public.foodmap_migrations FROM PUBLIC');
      await client.query(
        await readFile(new URL('../database/access.sql', import.meta.url), 'utf8'),
      );
      // pg_restore --no-acl omits revokes as well as grants.
      await client.query('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC');
      await client.query('COMMIT');
    }
    const actual = await fingerprint();
    if (JSON.stringify(actual) !== JSON.stringify(manifest.tables))
      throw new Error(
        'Data verification failed: table counts or checksums differ. Keep target read-only.',
      );
    console.log(
      `Verified ${Object.keys(actual).length} tables: counts and content checksums match.`,
    );
  }
} finally {
  await client.end();
}
