import 'server-only';
import { PrismaClient } from '../generated/postgresql/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { postgresOptions } from './databaseConfig.js';

// One pool per Node process, including development hot reloads; never per request.
export function getPostgresPrisma() {
  if (!globalThis.unnamedIslandPostgres) {
    globalThis.unnamedIslandPostgres = new PrismaClient({ adapter: new PrismaPg(postgresOptions()) });
  }
  return globalThis.unnamedIslandPostgres;
}
