import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { databaseProvider, postgresOptions } from './databaseConfig.js';

test('database selection never switches implicitly or falls back on invalid mode', () => {
  assert.equal(databaseProvider({ DATABASE_URL: 'postgresql://example/db' }), 'd1');
  assert.equal(databaseProvider({ ISLAND_DATABASE_PROVIDER: 'postgresql' }), 'postgresql');
  assert.throws(() => databaseProvider({ ISLAND_DATABASE_PROVIDER: 'postgres' }));
});

test('PostgreSQL requires explicit connection settings and bounds the shared pool', () => {
  for (const value of [undefined, '', 'file:local.db', 'postgresql://host/', 'postgresql://host']) {
    assert.throws(() => postgresOptions({ DATABASE_URL: value }), /valid DATABASE_URL/);
  }
  const connectionString = 'postgresql://island_app:example@nas-postgres:5432/unnamed_island';
  assert.deepEqual(postgresOptions({ DATABASE_URL: connectionString }), {
    connectionString, max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
  });
  assert.throws(() => postgresOptions({ DATABASE_URL: 'secret-password' }), (error) => !error.message.includes('secret-password'));
});

test('deployment refuses a missing URL before invoking a database migration', () => {
  const cli = fileURLToPath(new URL('../../scripts/postgres-cli.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'deploy'], {
    env: { ...process.env, DATABASE_URL: '' }, encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /valid DATABASE_URL/);
});

test('D1 and PostgreSQL schemas retain identical save fields and revision semantics', () => {
  const model = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').split('// Initial persistence model')[1];
  assert.equal(model('../../prisma/schema.prisma'), model('../../prisma/postgresql/schema.prisma'));
});
