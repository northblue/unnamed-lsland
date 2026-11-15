// Explicit selection keeps an unrelated DATABASE_URL from moving a local save.
export function databaseProvider(env = process.env) {
  const provider = env.ISLAND_DATABASE_PROVIDER || 'd1';
  if (!['d1', 'postgresql'].includes(provider)) {
    throw new Error('ISLAND_DATABASE_PROVIDER must be d1 or postgresql');
  }
  return provider;
}

export function postgresOptions(env = process.env) {
  const connectionString = env.DATABASE_URL;
  let url;
  try { url = new URL(connectionString); } catch { /* Report no credentials. */ }
  if (!url || !['postgresql:', 'postgres:'].includes(url.protocol) || !url.hostname || !url.pathname || url.pathname === '/') {
    throw new Error('PostgreSQL requires a valid DATABASE_URL with a database name');
  }
  return { connectionString, max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 };
}
