import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, chmodSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ISLAND_ID, createTransfer, transferSql, sha256 } from './saveTransfer.js';

export function findIslandDatabase(root) {
  const candidates = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.name.endsWith('.sqlite') && entry.name !== 'metadata.sqlite') {
        const db = new DatabaseSync(path, { readOnly: true });
        try {
          if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='Island'").get()
            && db.prepare('SELECT 1 FROM "Island" WHERE id = ?').get(ISLAND_ID)) candidates.push(path);
        } finally { db.close(); }
      }
    }
  }
  visit(root);
  if (candidates.length !== 1) throw new Error(`Expected one local D1 island database; found ${candidates.length}. Select --sqlite explicitly.`);
  return candidates[0];
}

export async function exportIsland(sqlitePath, outputDirectory) {
  const directory = resolve(outputDirectory);
  // Exclusive directory creation prevents replacing a previous export or backup.
  mkdirSync(directory, { mode: 0o700 });
  const original = new DatabaseSync(resolve(sqlitePath), { readOnly: true });
  try { await backup(original, join(directory, 'source.sqlite')); }
  finally { original.close(); }
  chmodSync(join(directory, 'source.sqlite'), 0o600);
  const snapshot = new DatabaseSync(join(directory, 'source.sqlite'), { readOnly: true });
  let record;
  try {
    if (snapshot.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('SQLite backup integrity check failed');
    record = snapshot.prepare('SELECT * FROM "Island" WHERE id = ?').get(ISLAND_ID);
    if (!record) throw new Error('No saved local island; export never initializes an island');
  } finally { snapshot.close(); }
  for (const key of ['resourceState', 'buildings', 'catches', 'pond']) {
    if (typeof record[key] === 'string') record[key] = JSON.parse(record[key]);
  }
  const transfer = createTransfer(record);
  const sql = transferSql(transfer);
  const write = (name, value) => writeFileSync(join(directory, name), value, { flag: 'wx', mode: 0o600 });
  write('island-save.json', JSON.stringify(transfer, null, 2) + '\n');
  write('island-import.sql', sql.importSql);
  write('island-verify.sql', sql.verifySql);
  const hashes = {};
  for (const file of ['source.sqlite', 'island-save.json', 'island-import.sql', 'island-verify.sql']) hashes[file] = sha256(readFileSync(join(directory, file)));
  write('manifest.json', JSON.stringify({ format: 'unnamed-island-transfer-manifest', version: 1,
    exportedAt: transfer.exportedAt, sourceRevision: transfer.source.revision, hashes }, null, 2) + '\n');
  write('README.md', `# 无名岛存档迁移包\n\n只上传 island-save.json、island-import.sql、island-verify.sql、manifest.json、SHA256SUMS 与本说明。source.sqlite 是 Mac 完整本地备份，不上传 NAS 或 Git。\n\n先停止 NAS 小岛 Web 项目，再将上传文件放到 /volume1/backup/nas-postgres/transfers/current。在 PostgreSQL 容器终端执行：\n\n\`\`\`sh\ncd /backups/transfers/current\nsha256sum -c SHA256SUMS\npsql -X -U nas_admin -d unnamed_island -v ON_ERROR_STOP=1 -f island-import.sql\npsql -X -U nas_admin -d unnamed_island -v ON_ERROR_STOP=1 -f island-verify.sql\n\`\`\`\n\n校验和全部 OK 才执行导入；导入和验证的 state_verified 都应为 1。目标存在任意岛屿时拒绝覆盖；不要删除已有记录或修改 SQL 绕过。导入只写 unnamed_island，并切换 island_app 权限，不影响 mind_friend。校验和用于检查完整性，不代表文件来源可信，只执行自己导出的 SQL。\n\n这是一份时间点快照，Mac 后续游玩不会自动同步。导入后再启动 Web 并检查健康状态；此时尚未开放浏览器入口。迁移流程详见项目 doc/island-save-migration.md。\n`);
  const payloadFiles = ['island-save.json', 'island-import.sql', 'island-verify.sql', 'manifest.json', 'README.md'];
  write('SHA256SUMS', payloadFiles.map((name) => `${sha256(readFileSync(join(directory, name)))}  ${name}`).join('\n') + '\n');
  return { directory, transfer };
}
