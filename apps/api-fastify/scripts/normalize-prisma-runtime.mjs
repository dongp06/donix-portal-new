import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const generatedDirectory = join(packageDirectory, 'dist', 'api', 'prisma', 'generated', 'prisma');

async function visit(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }
  await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(path);
      return;
    }
    if (!entry.isFile() || !entry.name.endsWith('.js')) return;
    const source = await readFile(path, 'utf8');
    const normalized = source.replace(/(\.\/[^'"`\s]+)\.ts(['"`])/g, '$1.js$2');
    if (normalized !== source) await writeFile(path, normalized, 'utf8');
  }));
}

await visit(generatedDirectory);
