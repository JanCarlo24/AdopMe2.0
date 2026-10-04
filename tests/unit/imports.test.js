import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(fullPath);
    return entry.name.endsWith('.js') ? [fullPath] : [];
  }));
  return files.flat();
}

test('todos los módulos se importan sin errores de sintaxis ni ciclos', async () => {
  const files = [
    ...await javascriptFiles(path.resolve('src')),
    ...await javascriptFiles(path.resolve('config'))
  ];
  const modules = files.filter((file) => path.basename(file) !== 'main.js');
  assert.ok(modules.length > 20);
  for (const file of modules) {
    const loaded = await import(pathToFileURL(file).href);
    assert.equal(typeof loaded, 'object');
  }
});

test('src/main.js tiene sintaxis válida y no se ejecuta al comprobarlo', () => {
  const result = spawnSync(process.execPath, ['--check', 'src/main.js'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
