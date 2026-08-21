import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import process from 'node:process';
import { actionForPath } from '../src/core/security.ts';
import { buildApp } from '../src/app/build-app.ts';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');
const frontendRoot = join(workspaceRoot, 'web', 'src');
const backendRoot = join(workspaceRoot, 'apps', 'api-fastify', 'src');
const check = process.argv.includes('--check');

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path));
    else if (/\.(?:ts|tsx|mjs)$/.test(entry.name)) files.push(path);
  }
  return files;
}

function normalizePath(value) {
  const withoutQuery = value.split(/[?#]/, 1)[0] || '/';
  const templateStart = withoutQuery.indexOf('${');
  const templatePrefix = templateStart >= 0 ? withoutQuery.slice(0, templateStart) : withoutQuery;
  const bounded = templateStart >= 0 && !templatePrefix.endsWith('/')
    ? templatePrefix
    : withoutQuery;
  return bounded
    .replace(/\$\{[^}]+\}/g, ':param')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '') || '/';
}

function lineAt(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

function routeMatches(pattern, path) {
  const patternParts = normalizePath(pattern).split('/').filter(Boolean);
  const pathParts = normalizePath(path).split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every((part, index) => {
    const candidate = pathParts[index] ?? '';
    return part === '*' || part.startsWith(':') || part === candidate;
  });
}

function methodNear(source, offset, rawPath) {
  const before = source.slice(Math.max(0, offset - 700), offset);
  const after = source.slice(offset, Math.min(source.length, offset + 700));
  const closeCall = after.search(/\}\s*\)\s*[,;]?|\)\s*[,;)]/);
  const currentCall = closeCall >= 0 ? after.slice(0, closeCall) : after;
  const explicitAfter = currentCall.match(/\bmethod\s*:\s*['"]([A-Za-z]+)['"]/i)?.[1]?.toUpperCase();
  if (explicitAfter) return [explicitAfter];
  const methodExpression = currentCall.match(/\bmethod\s*:\s*([^,\n}]+)/i)?.[1] ?? '';
  const inferred = [...methodExpression.matchAll(/['"]([A-Za-z]+)['"]/g)]
    .map((match) => match[1]?.toUpperCase())
    .filter((method, index, methods) => method && methods.indexOf(method) === index);
  if (inferred.length > 1 && methodExpression.includes('?') && rawPath.includes('${')) {
    const branchIndex = /\?\s*$/.test(before) ? 0 : /:\s*$/.test(before) ? 1 : -1;
    if (branchIndex >= 0 && inferred[branchIndex]) return [inferred[branchIndex]];
  }
  if (inferred.length) return inferred;
  if (/\baction\s*\(\s*[`'\"]?$/.test(before)) return ['PATCH'];
  return ['GET'];
}

function isActiveReference(source, offset, raw) {
  if (normalizePath(raw) === '/api') return false;
  const lineStart = source.lastIndexOf('\n', offset) + 1;
  const line = source.slice(lineStart, source.indexOf('\n', offset) < 0 ? source.length : source.indexOf('\n', offset));
  if (/startsWith\(['"]\/api\/?['"]\)|PUBLIC_MUTATION_PATHS|const\s+[A-Z0-9_]+\s*=/.test(line)) return false;
  const before = source.slice(Math.max(0, offset - 180), offset);
  const typedCallPattern = /(?:fetchWithTimeout|apiAdmin|serverTransportFetch|transportFetch(?:WithState)?|secureRequest|action)\s*<[^>\n]*>\s*\([^;\n]*$/i;
  return /(?:fetchWithTimeout|apiAdmin|serverTransportFetch|transportFetch(?:WithState)?|secureRequest|action|return)\s*\([^;{}]*$/i.test(before)
    || typedCallPattern.test(before)
    || /return\s+[`'\"]/.test(line);
}

async function readSources(directory) {
  const result = [];
  for (const path of await filesUnder(directory)) {
    result.push({ path, relative: relative(workspaceRoot, path).replaceAll('\\', '/'), source: await readFile(path, 'utf8') });
  }
  return result;
}

function collectFrontendReferences(sources) {
  const references = new Map();
  const pathPattern = /["'`]((?:\/api\/)[^"'`\\\r\n]*)/g;
  for (const file of sources) {
    for (const match of file.source.matchAll(pathPattern)) {
      const raw = match[1];
      if (raw.includes('://')) continue;
      if (!isActiveReference(file.source, match.index ?? 0, raw)) continue;
      const path = normalizePath(raw);
      for (const method of methodNear(file.source, match.index ?? 0, raw)) {
        const key = `${method} ${path}`;
        const locations = references.get(key) ?? [];
        locations.push(`${file.relative}:${lineAt(file.source, match.index ?? 0)}`);
        references.set(key, locations);
      }
    }
  }
  return [...references.entries()].map(([key, locations]) => {
    const [method, ...parts] = key.split(' ');
    return { method, path: parts.join(' '), locations };
  }).sort((left, right) => `${left.method} ${left.path}`.localeCompare(`${right.method} ${right.path}`));
}

async function collectBackendRoutes() {
  const app = await buildApp({ enforceTransport: false, logger: false });
  try {
    await app.ready();
    const lines = app.printRoutes({ compact: true, commonPrefix: false }).split('\n');
    const parents = [];
    const routes = [];
    for (const line of lines) {
      const match = line.match(/^(?<indent>[│ ]*)(?:├──|└──)\s+(?<path>\S+)\s+\((?<methods>[^)]+)\)/);
      if (!match?.groups) continue;
      const depth = Math.floor((match.groups.indent?.length ?? 0) / 4);
      const localPath = match.groups.path;
      const path = localPath.startsWith('/') && localPath.startsWith('/api/')
        ? localPath
        : localPath.startsWith('/')
          ? `${parents[depth - 1] ?? ''}${localPath}`
          : localPath;
      parents[depth] = normalizePath(path);
      parents.length = depth + 1;
      for (const method of match.groups.methods.split(',').map((value) => value.trim())) {
        routes.push({ method, path: normalizePath(path), source: 'Fastify runtime route table' });
      }
    }
    return routes.filter((route) => route.method !== 'HEAD');
  } finally {
    await app.close();
  }
}

const [frontendSources] = await Promise.all([
  readSources(frontendRoot),
]);
const references = collectFrontendReferences(frontendSources);
const routes = await collectBackendRoutes();

function directRoute(reference) {
  return routes.find((route) => (route.method === 'ALL' || route.method === reference.method) && routeMatches(route.path, reference.path));
}

const report = references.map((reference) => {
  const direct = directRoute(reference);
  const action = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(reference.method)
    ? actionForPath(reference.method, reference.path)
    : null;
  const status = direct ? 'active + direct' : action ? 'active + capability gateway' : 'missing';
  return { ...reference, action, status, backend: direct?.source ?? null };
});

const missing = report.filter((item) => item.status === 'missing');
const actions = [...new Set(report.map((item) => item.action).filter(Boolean))].sort();

console.log(`# Fastify route inventory`);
console.log(`Generated: ${new Date().toISOString()}`);
console.log(`Frontend references: ${report.length}`);
console.log(`Backend route declarations: ${routes.length}`);
console.log(`Capability actions observed: ${actions.length}`);
console.log('');
console.log('| Status | Method | Path | Action | Source |');
console.log('|---|---|---|---|---|');
for (const item of report) {
  console.log(`| ${item.status} | ${item.method} | \`${item.path}\` | ${item.action ? `\`${item.action}\`` : ''} | ${item.locations.join('<br>')} |`);
}
console.log('');
console.log('## Registered backend routes');
for (const route of routes.sort((left, right) => `${left.path} ${left.method}`.localeCompare(`${right.path} ${right.method}`))) {
  console.log(`- ${route.method} \`${route.path}\` — ${route.source}`);
}
console.log('');
console.log(`Summary: ${missing.length} missing active reference(s).`);

if (check && missing.length) process.exitCode = 1;
