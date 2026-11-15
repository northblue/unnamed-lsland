import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createFixture } from '../../scripts/transfer-fixture.mjs';
import { exportIsland, findIslandDatabase } from './d1Export.js';
import { validateTransfer, transferSql, sha256 } from './saveTransfer.js';

test('read-only export backs up committed WAL, preserves the source and all saved data', async () => {
  const root = mkdtempSync(join(tmpdir(), 'island-transfer-test-'));
  const source = join(root, 'source.sqlite');
  const { db, state, updatedAt } = createFixture(source);
  try {
    const before = sha256(readFileSync(source));
    const walBefore = sha256(readFileSync(`${source}-wal`));
    const { transfer, directory } = await exportIsland(source, join(root, 'export'));
    assert.deepEqual(transfer.state, state);
    assert.equal(transfer.source.revision, 42);
    assert.equal(transfer.source.updatedAt, new Date(updatedAt).toISOString());
    assert.equal(sha256(readFileSync(source)), before);
    assert.equal(sha256(readFileSync(`${source}-wal`)), walBefore);
    assert.deepEqual(validateTransfer(JSON.parse(readFileSync(join(directory, 'island-save.json'), 'utf8'))), transfer);
    for (const line of readFileSync(join(directory, 'SHA256SUMS'), 'utf8').trim().split('\n')) {
      const [hash, name] = line.split('  ');
      assert.equal(sha256(readFileSync(join(directory, name))), hash);
      assert.equal(statSync(join(directory, name)).mode & 0o777, 0o600);
    }
    db.exec('UPDATE "Island" SET wood = 999');
    const snapshot = new DatabaseSync(join(directory, 'source.sqlite'), { readOnly: true });
    try { assert.equal(snapshot.prepare('SELECT wood FROM "Island"').get().wood, 123); }
    finally { snapshot.close(); }
    await assert.rejects(exportIsland(source, directory), /EEXIST/);
  } finally { db.close(); }
});

test('transfer checksum rejects data or revision edits and SQL generation revalidates', async () => {
  const root = mkdtempSync(join(tmpdir(), 'island-transfer-check-'));
  const source = join(root, 'source.sqlite');
  const { db } = createFixture(source);
  try {
    const { transfer } = await exportIsland(source, join(root, 'export'));
    for (const change of [v => v.state.wood++, v => v.source.revision++, v => v.source.islandId = 'other', v => v.version = 2]) {
      const edited = structuredClone(transfer); change(edited);
      assert.throws(() => transferSql(edited));
    }
    const invalid = structuredClone(transfer); invalid.state.pond.gold = 25;
    assert.throws(() => validateTransfer(invalid));
    const sql = transferSql(transfer);
    assert.ok(sql.importSql.includes('LOCK TABLE public."Island" IN ACCESS EXCLUSIVE MODE'));
    assert.ok(sql.importSql.includes('refusing to overwrite'));
    assert.ok(sql.verifySql.includes('BEGIN READ ONLY'));
  } finally { db.close(); }
});

test('database discovery refuses missing or ambiguous saved islands', () => {
  const root = mkdtempSync(join(tmpdir(), 'island-transfer-find-'));
  mkdirSync(join(root, 'd1'));
  assert.throws(() => findIslandDatabase(root), /found 0/);
  const first = join(root, 'd1', 'first.sqlite');
  const a = createFixture(first);
  try {
    assert.equal(findIslandDatabase(root), first);
    const b = createFixture(join(root, 'd1', 'second.sqlite'));
    try { assert.throws(() => findIslandDatabase(root), /found 2/); }
    finally { b.db.close(); }
  } finally { a.db.close(); }
});
