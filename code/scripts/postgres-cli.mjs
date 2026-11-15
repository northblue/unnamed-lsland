import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { postgresOptions } from '../src/lib/databaseConfig.js';

// Never let a missing URL make a migration appear to succeed without a database.
const action = process.argv[2];
if (!['deploy', 'status'].includes(action)) throw new Error('Expected deploy or status');
postgresOptions();
const cli = fileURLToPath(new URL('index.js', import.meta.resolve('prisma')));
const result = spawnSync(process.execPath, [cli, 'migrate', action, '--config', 'prisma.postgresql.config.mjs'], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
