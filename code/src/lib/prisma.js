import 'server-only';
import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { databaseProvider } from './databaseConfig.js';
import { getPostgresPrisma } from './postgres.js';

// A request-scoped binding: local Wrangler D1 in dev, Cloudflare D1 in production.
export function getPrisma() {
  if (databaseProvider() === 'postgresql') return getPostgresPrisma();
  const { env } = getCloudflareContext();
  if (!env.DB) throw new Error('Missing D1 binding: DB');
  return new PrismaClient({ adapter: new PrismaD1(env.DB) });
}
