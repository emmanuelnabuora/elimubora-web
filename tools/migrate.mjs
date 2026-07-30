#!/usr/bin/env node
/**
 * SQL-first migration runner.
 *
 * - Applies db/migrations/NNNN_name.sql in lexical order, each in its own transaction.
 * - Records applied migrations (with SHA-256 checksum) in core.schema_migrations.
 * - Refuses to run if an already-applied file's checksum has changed (immutability).
 * - Takes a Postgres advisory lock so concurrent deploys cannot race.
 *
 * Usage: MIGRATIONS_DATABASE_URL=postgres://... node tools/migrate.mjs
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'db',
  'migrations'
);
const ADVISORY_LOCK_KEY = 715_001; // arbitrary, stable app-wide key

const url = process.env.MIGRATIONS_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('MIGRATIONS_DATABASE_URL (or DATABASE_URL) is required');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

async function main() {
  await client.connect();
  await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS core');
    await client.query(`
      CREATE TABLE IF NOT EXISTS core.schema_migrations (
        filename   text PRIMARY KEY,
        checksum   text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);

    const applied = new Map(
      (await client.query('SELECT filename, checksum FROM core.schema_migrations')).rows.map(
        (r) => [r.filename, r.checksum]
      )
    );

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => /^\d{4}_.+\.sql$/.test(f))
      .sort();

    let ran = 0;
    for (const file of files) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');

      if (applied.has(file)) {
        if (applied.get(file) !== checksum) {
          throw new Error(
            `${file} was modified after being applied. Migrations are immutable — add a new file.`
          );
        }
        continue;
      }

      process.stdout.write(`Applying ${file} ... `);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO core.schema_migrations (filename, checksum) VALUES ($1, $2)',
          [file, checksum]
        );
        await client.query('COMMIT');
        console.log('ok');
        ran += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        console.log('FAILED');
        throw err;
      }
    }
    console.log(ran === 0 ? 'Database is up to date.' : `Applied ${ran} migration(s).`);
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
