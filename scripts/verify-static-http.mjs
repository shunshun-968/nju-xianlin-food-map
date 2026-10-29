import assert from 'node:assert/strict';

const base = process.argv[2];
if (!base) throw new Error('Usage: node scripts/verify-static-http.mjs http://localhost:8080');
const compressed = await fetch(base, { headers: { 'Accept-Encoding': 'gzip' } });
assert.equal(compressed.status, 200);
assert.equal(compressed.headers.get('content-encoding'), 'gzip');
assert.match(compressed.headers.get('vary') || '', /Accept-Encoding/i);
assert.match(compressed.headers.get('cache-control') || '', /no-cache/);
const html = await compressed.text();
const identity = await fetch(base, { headers: { 'Accept-Encoding': 'identity' } });
assert.equal(identity.headers.get('content-encoding'), null);
assert.equal(await identity.text(), html, 'compression must not change the page');
const scriptPath = html.match(/\bsrc="([^"]*\/assets\/[^"?]+\.js)"/)?.[1];
assert.ok(scriptPath, 'built page must contain a hashed script');
const script = await fetch(new URL(scriptPath, base), { headers: { 'Accept-Encoding': 'gzip' } });
assert.equal(script.status, 200);
assert.equal(script.headers.get('content-encoding'), 'gzip');
assert.match(script.headers.get('cache-control') || '', /immutable/);
assert.equal(script.headers.get('x-content-type-options'), 'nosniff');
await script.arrayBuffer();
for (const path of ['/assets/does-not-exist.js', '/osm/runtime/does-not-exist.json']) {
  const missing = await fetch(new URL(path, base));
  assert.equal(missing.status, 404);
  assert.doesNotMatch(missing.headers.get('cache-control') || '', /immutable/);
  await missing.arrayBuffer();
}
console.log('Static HTTP compression, freshness, security headers and missing-resource responses verified.');
