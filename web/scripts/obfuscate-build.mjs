import { createRequire } from 'node:module';
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const JavaScriptObfuscator = require('javascript-obfuscator');

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = path.join(webRoot, '.next', 'static');
const staleShieldRoot = path.join(staticRoot, 'build-shield');

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

if (!existsSync(staticRoot)) {
  throw new Error('[obfuscator] Next static output is missing.');
}

// Remove artifacts from the previous encrypted-chunk pipeline when Next keeps
// an additional static directory between builds.
rmSync(staleShieldRoot, { recursive: true, force: true });

const files = walk(staticRoot)
  .filter((file) => /\.js$/i.test(file))
  .sort();
if (!files.length) throw new Error('[obfuscator] no JavaScript assets were emitted.');

const options = {
  compact: true,
  simplify: true,
  target: 'browser',
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  renameProperties: false,
  transformObjectKeys: false,
  // Keep delivery small and startup predictable. RC4 string arrays and
  // wrapper chains multiply every shared Next chunk without adding security
  // to server-side authorization or transport crypto.
  stringArray: false,
  splitStrings: false,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
  numbersToExpressions: false,
  unicodeEscapeSequence: false,
  sourceMap: false,
};

let originalBytes = 0;
let obfuscatedBytes = 0;
const startedAt = Date.now();

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const result = JavaScriptObfuscator.obfuscate(source, options).getObfuscatedCode();
  if (!result.trim()) throw new Error(`[obfuscator] empty output for ${path.relative(webRoot, file)}.`);
  writeFileSync(file, `${result}\n`);
  originalBytes += Buffer.byteLength(source);
  obfuscatedBytes += Buffer.byteLength(result);
}

function gitRevision() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: webRoot, encoding: 'utf8' }).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

const artifactManifest = {
  schemaVersion: 1,
  buildId: process.env.BUILD_ID?.trim() || new Date().toISOString(),
  gitRevision: gitRevision(),
  generatedAt: new Date().toISOString(),
  javascriptFiles: files.map((file) => {
    const bytes = readFileSync(file);
    return {
      path: path.relative(webRoot, file).replaceAll(path.sep, '/'),
      sizeBytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }),
};
writeFileSync(path.join(webRoot, '.next', 'artifact-manifest.json'), `${JSON.stringify(artifactManifest, null, 2)}\n`);

console.log(
  `[obfuscator] transformed ${files.length} JavaScript assets ` +
    `(${originalBytes} -> ${obfuscatedBytes} bytes) in ${Date.now() - startedAt}ms`,
);
