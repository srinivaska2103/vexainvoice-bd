const { PrismaClient } = require('@prisma/client');
const env = require('./env');

// Dynamically ensure connection_limit & pool_timeout are set on the DATABASE_URL to avoid connection exhaustion across multiple application servers
const getBoundedDatabaseUrl = () => {
  const rawUrl = env.DATABASE_URL || process.env.DATABASE_URL;
  if (!rawUrl) return undefined;

  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', String(env.DB_CONNECTION_LIMIT || 7));
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', String(env.DB_POOL_TIMEOUT || 10));
    }
    return url.toString();
  } catch (err) {
    // If URL parsing fails, fallback to rawUrl
    return rawUrl;
  }
};

const boundedUrl = getBoundedDatabaseUrl();

const prisma = new PrismaClient({
  datasources: boundedUrl ? { db: { url: boundedUrl } } : undefined,
  log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
});

module.exports = prisma;
