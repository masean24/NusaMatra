// Writes a maximum-compression `.gz` next to every text file of the build, for nginx `gzip_static`.
// nginx then sends these instead of compressing each response on the fly at its default level 1,
// which left JavaScript about a fifth larger than it needs to be. The originals stay in place
// for clients that do not accept gzip, and a `.gz` is only kept when it is actually smaller.
// Usage: node scripts/precompress.mjs [dir=dist]
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { constants, gzipSync } from 'node:zlib';

const root = process.argv[2] ?? 'dist';
const TEXT = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.xml', '.webmanifest']);
// Below this, the gzip header outweighs the saving (nginx uses the same threshold).
const MIN_BYTES = 1024;

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else yield path;
  }
}

let count = 0;
let before = 0;
let after = 0;
for (const path of files(root)) {
  if (!TEXT.has(extname(path)) || statSync(path).size < MIN_BYTES) continue;
  const source = readFileSync(path);
  const compressed = gzipSync(source, { level: constants.Z_BEST_COMPRESSION, memLevel: 9 });
  if (compressed.length >= source.length) continue;
  writeFileSync(`${path}.gz`, compressed);
  count += 1;
  before += source.length;
  after += compressed.length;
}

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`precompress: ${count} files, ${kb(before)} -> ${kb(after)} gzip`);
