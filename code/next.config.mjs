import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import { databaseProvider } from './src/lib/databaseConfig.js';

if (process.env.NODE_ENV === 'development' && databaseProvider() === 'd1') initOpenNextCloudflareForDev();

export default {
  ...(process.env.ISLAND_STANDALONE === '1' ? { output: 'standalone' } : {}),
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
};
