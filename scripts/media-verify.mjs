import pg from 'pg';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const [root,status='approved']=process.argv.slice(2);
if(!root||root.startsWith('-')||!['approved','pending','rejected'].includes(status))throw new Error('Usage: media-verify.mjs remote:bucket approved|pending|rejected');
const client=new pg.Client({connectionString:process.env.DATABASE_URL});await client.connect();
try {
  const records=(await client.query('SELECT storage_key,sha256,bytes FROM app.media WHERE status=$1 ORDER BY storage_key',[status])).rows;
  for(const row of records) {
    if(row.storage_key.startsWith('/')||row.storage_key.split('/').some(s=>!s||s==='.'||s==='..')||/[\\?#:]/.test(row.storage_key))throw new Error('Invalid storage key in database');
    const digest=createHash('sha256');let bytes=0;
    const exit=await new Promise((resolve,reject)=>{
      const child=spawn('rclone',['cat',`${root.replace(/\/$/,'')}/${row.storage_key}`],{stdio:['ignore','pipe','inherit']});
      child.stdout.on('data',chunk=>{bytes+=chunk.length;digest.update(chunk)});child.on('error',reject);child.on('close',resolve);
    });
    if(exit!==0 || String(bytes)!==String(row.bytes) || digest.digest('hex')!==row.sha256)throw new Error(`Media verification failed for key: ${row.storage_key}`);
  }
  console.log(`Verified ${records.length} ${status} image objects against database SHA-256 and byte size.`);
}finally{await client.end()}
