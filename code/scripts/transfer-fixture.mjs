// Synthetic migration fixture only. Never writes to .wrangler or a real save.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createIslandState } from '../src/game/islandState.js';
import { exportIsland } from '../src/lib/d1Export.js';

export function createFixture(path) {
  const db = new DatabaseSync(path);
  for (const migration of ['0001_island_persistence.sql', '0002_fishing_catches.sql', '0003_seaside_pond.sql']) {
    db.exec(readFileSync(new URL(`../migrations/${migration}`, import.meta.url), 'utf8'));
  }
  db.exec('PRAGMA journal_mode=WAL');
  const state = createIslandState();
  state.name = "Lucas' \\海岛 $transfer_guard$";
  state.wood = 123; state.stone = 45;
  state.catches = { gold: 2, blue: 3, coral: 1, silver: 0 };
  state.pond = { gold: 1, blue: 2, coral: 0, silver: 1 };
  state.resources = state.resources.map((node) => ({ ...node, remaining: 0, ...(node.id.startsWith('tree:') ? { growth: 35 } : {}) }));
  state.buildings = [{ id: 'hut:transfer-test', type: 'hut', x: 0, z: 0 }];
  const updatedAt = Date.parse('2026-11-15T12:00:00.123Z');
  db.prepare(`INSERT INTO "Island" (id,name,wood,stone,playerX,playerZ,resourceState,buildings,catches,pond,revision,updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run('local-island', state.name, state.wood, state.stone,
    state.player.x, state.player.z, JSON.stringify(state.resources), JSON.stringify(state.buildings),
    JSON.stringify(state.catches), JSON.stringify(state.pond), 42, updatedAt);
  return { db, state, updatedAt };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const directory = resolve(process.argv[2]);
  mkdirSync(directory, { recursive: true });
  const source = resolve(directory, 'fixture.sqlite');
  const { db } = createFixture(source);
  try { await exportIsland(source, resolve(directory, 'transfer')); }
  finally { db.close(); }
  const validSql = readFileSync(resolve(directory, 'transfer/island-import.sql'), 'utf8');
  const invalidSql = validSql.replace(', 123, 45,', ', 999, 45,');
  if (validSql === invalidSql) throw new Error('Fixture mutation failed');
  writeFileSync(resolve(directory, 'bad-import.sql'), invalidSql);
  console.log('Synthetic migration package prepared');
}
