#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

dotenv.config();

const args = process.argv.slice(2);
const dbUrl = (process.env.DATABASE_URL || '').trim();
const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');
const schema = isPostgres ? './prisma/schema.prisma' : './prisma/schema.dev.prisma';

console.log(`[prisma] Target: ${isPostgres ? 'PostgreSQL' : 'SQLite'} (${schema})`);

const result = spawnSync('npx', ['prisma', ...args, `--schema=${schema}`], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 0);
