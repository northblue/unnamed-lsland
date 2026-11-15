import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/postgresql/schema.prisma',
  migrations: { path: 'prisma/postgresql/migrations' },
  // Generation / SQL diff need no live database. Deploy refuses a missing URL.
  ...(process.env.DATABASE_URL ? { datasource: { url: process.env.DATABASE_URL } } : {}),
});
