import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = path.join(webRoot, '.next', 'static');
const manifestPath = path.join(webRoot, '.next', 'artifact-manifest.json');

function walk(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

const files = walk(staticRoot);
const javascript = files.filter((file) => /\.js$/i.test(file));
const encrypted = files.filter((file) => /\.tbc$/i.test(file));
const buildShield = files.filter((file) => file.includes(`${path.sep}build-shield${path.sep}`));
const sourceMaps = files.filter((file) => /\.map$/i.test(file));

const protectedMarkers = [
  'trust.approve',
  'trust.revoke',
  'staff.promote',
  'calculateTrustScore',
  'calculateReviewWeight',
  'detectFraud',
  'fraudWeights',
  'JWT_SECRET',
  'THB_TRANSPORT_PRIVATE_JWK',
];

if (!javascript.length) throw new Error('[obfuscator] no public JavaScript assets found.');
if (!existsSync(manifestPath)) throw new Error('[obfuscator] artifact manifest is missing.');
if (encrypted.length || buildShield.length) {
  throw new Error('[obfuscator] encrypted Build Shield artifacts remain in the public static output.');
}
if (sourceMaps.length) {
  throw new Error(`[obfuscator] public source maps are forbidden: ${sourceMaps.map((file) => path.relative(webRoot, file)).join(', ')}`);
}

const markerHits = [];
for (const file of javascript) {
  const source = readFileSync(file, 'utf8');
  for (const marker of protectedMarkers) {
    if (source.includes(marker)) markerHits.push(`${path.relative(webRoot, file)} -> ${marker}`);
  }
}
if (markerHits.length) {
  throw new Error(`[obfuscator] protected server-only markers found in public JavaScript:\n${markerHits.join('\n')}`);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch {
  throw new Error('[obfuscator] artifact manifest is invalid JSON.');
}
if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.javascriptFiles) || manifest.javascriptFiles.length !== javascript.length) {
  throw new Error('[obfuscator] artifact manifest does not match the discovered JavaScript assets.');
}
for (const entry of manifest.javascriptFiles) {
  if (!entry || typeof entry.path !== 'string' || !/^\.next\/static\/.+\.js$/i.test(entry.path) || !Number.isInteger(entry.sizeBytes) || !/^[a-f0-9]{64}$/i.test(entry.sha256)) {
    throw new Error('[obfuscator] artifact manifest contains an invalid JavaScript entry.');
  }
  const file = path.join(webRoot, entry.path);
  if (!existsSync(file)) throw new Error(`[obfuscator] manifest file is missing: ${entry.path}`);
  const bytes = readFileSync(file);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (bytes.byteLength !== entry.sizeBytes || sha256 !== entry.sha256.toLowerCase()) {
    throw new Error(`[obfuscator] artifact manifest hash mismatch: ${entry.path}`);
  }
}

console.log(`[obfuscator] artifact check passed: ${javascript.length} obfuscated JavaScript assets, manifest verified, no source maps, encrypted chunks or protected server-only markers`);
