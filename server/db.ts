/**
 * The single database client for the whole API.
 *
 * Prisma opens a connection pool per client instance. Sharing one instance keeps
 * a single, consistently configured connection for every request.
 */

import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL || 'file:./dev.db';
const isSqlite = url.startsWith('file:');

export const prisma = new PrismaClient({
  datasources: { db: { url } },
});

/**
 * Apply database-specific settings.
 *
 * For SQLite: enables WAL mode and busy timeout for better concurrency.
 * For PostgreSQL: no special configuration needed.
 */
export async function configureDatabase(): Promise<void> {
  if (!isSqlite) {
    console.log('🗄️  PostgreSQL connected');
    return;
  }

  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 10000;');
    await prisma.$executeRawUnsafe('PRAGMA synchronous = NORMAL;');
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');

    const [mode] = await prisma.$queryRawUnsafe<Array<{ journal_mode: string }>>('PRAGMA journal_mode;');
    const [busy] = await prisma.$queryRawUnsafe<Array<{ timeout: bigint }>>('PRAGMA busy_timeout;');
    console.log(`🗄️  SQLite ready — journal_mode=${mode?.journal_mode}, busy_timeout=${busy?.timeout}ms`);
  } catch (error) {
    console.warn('SQLite pragmas not applied:', error instanceof Error ? error.message : error);
  }
}