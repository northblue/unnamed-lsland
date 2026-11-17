// A database/schema change requires a manual NAS migration before auto updates resume.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
const root = fileURLToPath(new URL('../prisma/postgresql/', import.meta.url));
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory()
    ? files(join(dir, item.name)) : [join(dir, item.name)]);
}
const hash = createHash('sha256');
for (const path of files(root).sort()) hash.update(relative(root, path)).update('\0').update(readFileSync(path)).update('\0');
console.log(hash.digest('hex'));
