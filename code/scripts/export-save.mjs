import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findIslandDatabase, exportIsland } from '../src/lib/d1Export.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--sqlite', '--out'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Usage: export-save.mjs [--sqlite FILE] [--out NEW_DIRECTORY]');
  if (options[args[i]]) throw new Error('Duplicate option');
  options[args[i]] = args[i + 1];
}
const sqlite = options['--sqlite'] ? resolve(options['--sqlite']) : findIslandDatabase(resolve(root, '.wrangler/state/v3/d1'));
mkdirSync(resolve(root, 'transfers'), { recursive: true, mode: 0o700 });
const output = options['--out'] ? resolve(options['--out']) : resolve(root, 'transfers', new Date().toISOString().replaceAll(/[:.]/g, '-'));
const { directory, transfer } = await exportIsland(sqlite, output);
console.log(JSON.stringify({ directory, exportedAt: transfer.exportedAt, revision: transfer.source.revision,
  name: transfer.state.name, wood: transfer.state.wood, stone: transfer.state.stone,
  buildings: transfer.state.buildings.length, pond: transfer.state.pond, checksum: transfer.checksum }, null, 2));
