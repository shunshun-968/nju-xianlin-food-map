import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('SELECT pg_advisory_lock(781205)');
  await client.query('CREATE TABLE IF NOT EXISTS public.foodmap_migrations(version text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  await client.query('REVOKE ALL ON public.foodmap_migrations FROM PUBLIC');
  const dir = new URL('../database/migrations/',import.meta.url);
  for (const name of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort()) {
    const sql = await readFile(new URL(name,dir),'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');
    const existing = await client.query('SELECT sha256 FROM public.foodmap_migrations WHERE version=$1',[name]);
    if (existing.rows.length) { if (existing.rows[0].sha256 !== hash) throw new Error(`已执行迁移被修改：${name}`); continue; }
    await client.query('BEGIN');
    try { await client.query(sql); await client.query('INSERT INTO public.foodmap_migrations(version,sha256) VALUES($1,$2)',[name,hash]); await client.query('COMMIT'); }
    catch(e) { await client.query('ROLLBACK'); throw e; }
    console.log(`Applied ${name}`);
  }
  await client.query(await readFile(new URL('../database/access.sql',import.meta.url),'utf8'));
} finally { await client.query('SELECT pg_advisory_unlock(781205)').catch(()=>{}); await client.end(); }
