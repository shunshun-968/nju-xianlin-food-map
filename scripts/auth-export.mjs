// Provider credential backup is separate from business data. Never put this output in Git.
import {spawnSync} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const directory=resolve(process.argv[2]||'backups/auth');await mkdir(directory,{recursive:false,mode:0o700});
// libpq PG* variables/.pgpass only; no URL containing a password on the command line.
const result=spawnSync('pg_dump',['--format=custom','--data-only','--no-owner','--no-acl','--schema=auth',`--file=${join(directory,'auth-sensitive.dump')}`],{stdio:'inherit'});
if(result.error||result.status!==0)throw new Error('Auth export failed. Check pg_dump and PG* configuration.');
console.log('Sensitive auth backup created. Encrypt immediately. Restore only using the version-matched Supabase procedure in docs/MIGRATION.md.');
