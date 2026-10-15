import path from 'path';
import dotenv from 'dotenv';
import pg from 'pg';
import { Migrator } from '../src/db/migrator';

// Search current working dir and repository root for .env and .env.local
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env.local') });

export async function runStagingMigrations(rawUrl?: string): Promise<{ applied: string[]; skipped: string[]; seeds: string[] }> {
  const connectionString = rawUrl || process.env.STAGING_DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      '[MIGRATION BLOCKER] STAGING_DATABASE_URL is not set. Refusing to run migrations without explicit staging credentials.'
    );
  }

  // Parse connection URI safely
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(connectionString);
  } catch {
    throw new Error('[MIGRATION ERROR] STAGING_DATABASE_URL is not a valid URL.');
  }

  const dbNameFromUrl = parsedUrl.pathname.replace(/^\//, '');

  // 1. Pre-execution Safety Guard
  if (dbNameFromUrl === 'chandil_home_services' || dbNameFromUrl === 'chandil_prod') {
    throw new Error(`[CRITICAL SAFETY GUARD] Refusing migration! Target database "${dbNameFromUrl}" is a production database.`);
  }

  const hostname = parsedUrl.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

  const pool = new pg.Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    // 2. Verified In-Engine Identity Assertion
    const client = await pool.connect();
    try {
      const { rows } = await client.query<{ current_db: string; current_user: string }>(
        'SELECT current_database() AS current_db, current_user;'
      );
      const dbName = rows[0].current_db;
      const dbUser = rows[0].current_user;

      if (dbName !== 'chandil_staging') {
        throw new Error(
          `[CRITICAL SAFETY GUARD] Refusing migration! Target database is "${dbName}", expected strictly "chandil_staging".`
        );
      }

      console.log(`[Safety Guard PASS] Verified target database: "${dbName}" (user: "${dbUser}")`);
    } finally {
      client.release();
    }

    // 3. Execute Migrations via Migrator
    const migrator = new Migrator(pool);
    const result = await migrator.runMigrations();
    console.log(`[Staging Migrations] Applied ${result.applied.length} migrations, skipped ${result.skipped.length} existing.`);

    // 4. Execute Seeds via Migrator
    const seeds = await migrator.runSeeds();
    console.log(`[Staging Seeds] Executed ${seeds.length} seed files.`);

    return { ...result, seeds };
  } finally {
    await pool.end();
  }
}

// CLI Runner
if (process.argv[1] && process.argv[1].includes('run-staging-migrations')) {
  runStagingMigrations()
    .then((res) => {
      console.log('\n[SUCCESS] Staging database migrations completed safely.');
      console.log(`Applied (${res.applied.length}): ${res.applied.join(', ') || 'None'}`);
      console.log(`Skipped (${res.skipped.length}): ${res.skipped.join(', ') || 'None'}`);
      console.log(`Seeds (${res.seeds.length}): ${res.seeds.join(', ')}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n[FATAL ERROR]:', err.message);
      process.exit(1);
    });
}
