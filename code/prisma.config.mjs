import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // CLI schema/diff only; the app connects through the D1 binding, never this URL.
  datasource: { url: 'file:./schema-check.db' },
});
