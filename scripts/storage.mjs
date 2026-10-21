// rclone must be configured outside the repository. Keys are preserved by copying bucket ROOTS.
import { spawnSync } from 'node:child_process';
const [source, target, mode = 'check'] = process.argv.slice(2);
if (!source || !target || !['copy', 'check'].includes(mode))
  throw new Error(
    'Usage: npm run files:sync -- sourceRemote:bucket targetRemote:bucket copy|check',
  );
if (source.startsWith('-') || target.startsWith('-') || source === target)
  throw new Error('Invalid or identical storage endpoints');
const args =
  mode === 'copy'
    ? ['copy', source, target, '--immutable', '--retries', '3']
    : ['check', source, target, '--download', '--one-way'];
const result = spawnSync('rclone', args, { stdio: 'inherit' });
if (result.error)
  throw new Error('Install rclone and configure both endpoints using rclone config.');
if (result.status !== 0) process.exitCode = result.status || 1;
