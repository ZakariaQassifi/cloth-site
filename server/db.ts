/**
 * The single database client for the whole API.
 *
 * Prisma opens a connection pool per client instance, and SQLite allows only one
 * writer at a time. Instantiating the client in more than one module therefore
 * means more connections competing for the write lock, and it splits the
 * connection tuning (WAL, `busy_timeout`) across pools so only some queries
 * benefit from it. Sharing one instance keeps a single, consistently configured
 * connection for every request.
 */

import { PrismaClient } from '@prisma/client';

/**
 * `connection_limit=1` serialises queries onto one connection, which is what
 * makes the pragmas set in `configureSqlite` apply to every statement rather
 * than to whichever pooled connection happens to serve the next query.
 */
const url = process.env.DATABASE_URL || 'file:./dev.db';

export const prisma = new PrismaClient({
  datasources: { db: { url: `${url}${url.includes('?') ? '&' : '?'}connection_limit=1` } },
});

/**
 * Apply the SQLite settings the API depends on.
 *
 * Write-ahead logging lets readers proceed while a writer holds the lock, and
 * the busy timeout makes competing writers wait their turn instead of failing the
 * moment they cannot take it. Without both, two shoppers racing for the last
 * item produce a driver timeout rather than one order succeeding and one being
 * told the item is gone.
 *
 * Failures are logged but not fatal: these are tuning pragmas and the API still
 * serves traffic without them, just with worse contention behaviour.
 */
export async function configureSqlite(): Promise<void> {
  try {
    // `journal_mode` and `busy_timeout` answer with a row, so they must go
    // through $queryRaw; the setters below return nothing and use $executeRaw.
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 10000;');
    await prisma.$executeRawUnsafe('PRAGMA synchronous = NORMAL;');
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');

    const [mode] = await prisma.$queryRawUnsafe<Array<{ journal_mode: string }>>('PRAGMA journal_mode;');
    // SQLite reports this setting as a BigInt, which JSON cannot serialise.
    const [busy] = await prisma.$queryRawUnsafe<Array<{ timeout: bigint }>>('PRAGMA busy_timeout;');
    console.log(`🗄️  SQLite ready — journal_mode=${mode?.journal_mode}, busy_timeout=${busy?.timeout}ms`);
  } catch (error) {
    console.warn('SQLite pragmas not applied:', error instanceof Error ? error.message : error);
  }
}