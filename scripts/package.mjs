// Builds dist/github-tab-deduper.zip for the Chrome Web Store, containing
// only the files the extension ships (no dev scripts, tests, or README).
// Pure Node so it works without a system `zip`.
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { crc32 } from './png.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHIPPED = ['manifest.json', 'background.js', 'lib', 'panel', 'icons'];

function collectFiles(entry) {
  const full = join(root, entry);
  if (statSync(full).isFile()) return [entry];
  return readdirSync(full, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => relative(root, join(d.parentPath, d.name)));
}

const files = SHIPPED.flatMap(collectFiles).sort();

const localParts = [];
const centralParts = [];
let offset = 0;

for (const name of files) {
  const data = readFileSync(join(root, name));
  const compressed = deflateRawSync(data, { level: 9 });
  const useDeflate = compressed.length < data.length;
  const payload = useDeflate ? compressed : data;
  const method = useDeflate ? 8 : 0;
  const crc = crc32(data);
  const nameBuf = Buffer.from(name.replaceAll('\\', '/'), 'utf8');

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(payload.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  localParts.push(local, nameBuf, payload);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4); // version made by
  central.writeUInt16LE(20, 6); // version needed
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(payload.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt32LE(offset, 42);
  centralParts.push(central, nameBuf);

  offset += 30 + nameBuf.length + payload.length;
}

const centralSize = centralParts.reduce((n, b) => n + b.length, 0);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(files.length, 8);
eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(centralSize, 12);
eocd.writeUInt32LE(offset, 16);

mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', 'github-tab-deduper.zip');
writeFileSync(out, Buffer.concat([...localParts, ...centralParts, eocd]));
console.log(`wrote ${out} (${files.length} files)`);
