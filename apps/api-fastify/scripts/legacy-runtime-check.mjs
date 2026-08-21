import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, '../../..');

const roots = [
  path.join(workspaceRoot, 'apps', 'api-fastify', 'src'),
  path.join(workspaceRoot, 'apps', 'api-fastify', 'test'),
  path.join(workspaceRoot, 'apps', 'api-fastify', 'package.json'),
  path.join(workspaceRoot, 'api', 'package.json'),
];

const forbidden = [
  /@nestjs\//i,
  /\bnestjs\b/i,
  /\bexpress\b/i,
  /Express\.(?:Request|Response)/,
  /\bMulter\b/i,
  /\bNestFactory\b/i,
];

function filesUnder(target) {
  if (!existsSync(target)) return [];
  if (statSync(target).isFile()) return [target];
  const stat = readdirSync(target, { withFileTypes: true });
  const files = [];
  for (const entry of stat) {
    const absolute = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...filesUnder(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

const hits = [];
for (const root of roots) {
  for (const file of filesUnder(root)) {
    if (!/\.(?:[cm]?[jt]s|json)$/i.test(file)) continue;
    const source = readFileSync(file, 'utf8');
    for (const pattern of forbidden) {
      if (pattern.test(source)) {
        hits.push(`${path.relative(workspaceRoot, file).replaceAll(path.sep, '/')} -> ${pattern}`);
      }
    }
  }
}

if (hits.length) {
  throw new Error(`Legacy HTTP runtime markers found:\n${hits.join('\n')}`);
}

console.log('Legacy runtime check passed: no NestJS, Express or Multer markers in the Fastify application path.');
